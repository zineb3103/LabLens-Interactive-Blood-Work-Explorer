# backend/app/api/ingest.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
import pandas as pd
import io
from datetime import datetime
from pathlib import Path
import uuid

from ..services.validator import DataValidator
from ..core.config import settings
from ..db.base import db

router = APIRouter()

REQUIRED_COLUMNS = ['numorden', 'sexo', 'edad', 'nombre', 'textores', 'nombre2', 'Date']
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

@router.post("/ingest")
async def ingest_file(file: UploadFile = File(...)):
    """
    Endpoint pour ingérer et valider un fichier CSV ou Excel
    """
    try:
        # 1. Vérifier le type de fichier
        file_extension = file.filename.split('.')[-1].lower()
        if file_extension not in ['csv', 'xlsx', 'xls']:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Format de fichier non supporté",
                    "errors": [{"message": f"Extension .{file_extension} non acceptée"}]
                }
            )
        
        # 2. Lire le fichier
        contents = await file.read()
        
        # Vérifier la taille
        if len(contents) > MAX_FILE_SIZE:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Fichier trop volumineux",
                    "errors": [{"message": f"Taille maximale: 50 MB"}]
                }
            )
        
        # 3. Parser selon le type
        try:
            if file_extension == 'csv':
                # Essayer plusieurs encodages pour les fichiers CSV
                encodings_to_try = [
                    ("utf-8", {}),
                    ("utf-8-sig", {}),
                    ("latin1", {}),
                    ("cp1252", {}),
                    ("latin1", {"errors": "replace"}),
                ]
                df = None
                last_err = None
                
                for enc, extra_kwargs in encodings_to_try:
                    try:
                        df = pd.read_csv(
                            io.BytesIO(contents), 
                            encoding=enc, 
                            dtype=str,
                            sep=",",
                            **extra_kwargs
                        )
                        break  # Succès, sortir de la boucle
                    except UnicodeDecodeError as e:
                        last_err = e
                        continue
                    except Exception as e:
                        # Autres erreurs (format CSV invalide, etc.)
                        last_err = e
                        continue
                
                if df is None:
                    return JSONResponse(
                        status_code=400,
                        content={
                            "success": False,
                            "message": "Erreur de lecture du fichier",
                            "errors": [{"message": f"Impossible de décoder le fichier avec les encodages essayés. Dernière erreur: {str(last_err)}"}]
                        }
                    )
            else:
                df = pd.read_excel(io.BytesIO(contents), dtype=str)
        except Exception as e:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Erreur de lecture du fichier",
                    "errors": [{"message": str(e)}]
                }
            )
        
        # 4. Validation du schéma
        validator = DataValidator(df, REQUIRED_COLUMNS)
        validation_result = validator.validate_all()
        
        if not validation_result['valid']:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Schéma invalide",
                    "errors": validation_result['errors'],
                    "row_count": len(df)
                }
            )
        
        # 5. Nettoyage et transformation
        cleaned_df = validator.clean_data()
        
        # 6. Gérer les doublons
        duplicates = cleaned_df.duplicated(subset=['numorden', 'nombre', 'Date'])
        warnings = []
        if duplicates.any():
            num_duplicates = duplicates.sum()
            cleaned_df = cleaned_df.drop_duplicates(subset=['numorden', 'nombre', 'Date'], keep='first')
            warnings.append({"message": f"{num_duplicates} doublons détectés et supprimés"})
        
        # 7. Générer un file_id unique
        file_id = str(uuid.uuid4())
        
        # 8. Sauvegarder en Parquet
        cache_dir = settings.PARQUET_CACHE_DIR
        cache_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = cache_dir / f"{file_id}.parquet"
        cleaned_df.to_parquet(output_path, index=False)
        
        # 9. Sauvegarder dans DuckDB
        try:
            conn = db.get_connection()
            
            # Enregistrer les métadonnées du fichier
            conn.execute("""
                INSERT INTO files (file_id, original_filename, row_count, status)
                VALUES (?, ?, ?, ?)
            """, [file_id, file.filename, len(cleaned_df), 'completed'])
            
            # Préparer les données pour DuckDB
            cleaned_df_db = cleaned_df.copy()
            cleaned_df_db['file_id'] = file_id
            
            # Renommer la colonne Date en date (lowercase pour cohérence SQL)
            if 'Date' in cleaned_df_db.columns:
                cleaned_df_db = cleaned_df_db.rename(columns={'Date': 'date'})
            
            # Convertir les dates en format compatible DuckDB
            if 'date' in cleaned_df_db.columns:
                cleaned_df_db['date'] = pd.to_datetime(cleaned_df_db['date']).dt.date
            
            # Générer les IDs automatiquement (DuckDB ne supporte pas AUTO_INCREMENT)
            # On récupère le max ID actuel et on ajoute un offset
            max_id_result = conn.execute("SELECT COALESCE(MAX(id), 0) FROM results").fetchone()
            max_id = max_id_result[0] if max_id_result else 0
            
            # Ajouter la colonne id avec des IDs séquentiels
            cleaned_df_db['id'] = range(max_id + 1, max_id + 1 + len(cleaned_df_db))
            
            # Insérer dans DuckDB via pandas directement
            conn.register('cleaned_df_db', cleaned_df_db)
            conn.execute("""
                INSERT INTO results (id, file_id, numorden, sexo, edad, nombre, textores, nombre2, date, created_at)
                SELECT 
                    id,
                    file_id,
                    numorden,
                    sexo,
                    edad,
                    nombre,
                    textores,
                    nombre2,
                    date,
                    CURRENT_TIMESTAMP as created_at
                FROM cleaned_df_db
            """)
            
            warnings.append({"message": f"✅ {len(cleaned_df)} lignes insérées dans DuckDB"})
            
        except Exception as e:
            # On continue même si DuckDB échoue car on a le Parquet
            warnings.append({"message": f"⚠️ Erreur DuckDB: {str(e)}"})
            print(f"⚠️ Erreur lors de l'insertion dans DuckDB: {str(e)}")
        
        # 10. Créer un aperçu (5 premières lignes)
        preview_df = cleaned_df.head(5).copy()
        
        # Convertir les Timestamps et types pandas en types JSON-serialisables
        for col in preview_df.columns:
            if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
                preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d').fillna('')
            elif pd.api.types.is_integer_dtype(preview_df[col]):
                preview_df[col] = preview_df[col].apply(lambda x: int(x) if pd.notna(x) else None)
            elif preview_df[col].dtype == 'object':
                preview_df[col] = preview_df[col].fillna('')
        
        preview = preview_df.to_dict(orient='records')
        for record in preview:
            for key, value in record.items():
                if pd.isna(value) if hasattr(pd, 'isna') else (value is pd.NA or str(value) == '<NA>'):
                    record[key] = None
        
        # 11. Retourner le succès
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": f"Fichier validé avec succès! {len(cleaned_df)} lignes traitées.",
                "file_id": file_id,
                "row_count": len(cleaned_df),
                "preview": preview,
                "warnings": warnings
            }
        )
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Erreur serveur lors du traitement",
                "errors": [{"message": str(e)}]
            }
        )


@router.get("/files/{file_id}")
async def get_file_info(file_id: str):
    """
    Récupérer les informations d'un fichier ingéré depuis Parquet
    """
    cache_dir = settings.PARQUET_CACHE_DIR
    file_path = cache_dir / f"{file_id}.parquet"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Fichier non trouvé")
    
    try:
        df = pd.read_parquet(file_path)
        
        preview_df = df.head(10).copy()
        
        for col in preview_df.columns:
            if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
                preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d').fillna('')
            elif pd.api.types.is_integer_dtype(preview_df[col]):
                preview_df[col] = preview_df[col].apply(lambda x: int(x) if pd.notna(x) else None)
            elif preview_df[col].dtype == 'object':
                preview_df[col] = preview_df[col].fillna('')
        
        preview = preview_df.to_dict(orient='records')
        for record in preview:
            for key, value in record.items():
                if pd.isna(value) if hasattr(pd, 'isna') else (value is pd.NA or str(value) == '<NA>'):
                    record[key] = None
        
        return {
            "file_id": file_id,
            "row_count": len(df),
            "columns": list(df.columns),
            "preview": preview
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files/{file_id}/data")
async def get_file_data_from_duckdb(file_id: str, limit: int = 100, offset: int = 0):
    """
    Récupérer les données d'un fichier depuis DuckDB avec pagination
    """
    try:
        conn = db.get_connection()
        
        # Vérifier si le fichier existe
        file_info = conn.execute("""
            SELECT * FROM files WHERE file_id = ?
        """, [file_id]).fetchone()
        
        if not file_info:
            raise HTTPException(status_code=404, detail="Fichier non trouvé dans DuckDB")
        
        # Récupérer les données avec pagination
        results = conn.execute("""
            SELECT numorden, sexo, edad, nombre, textores, nombre2, date
            FROM results 
            WHERE file_id = ?
            ORDER BY created_at
            LIMIT ? OFFSET ?
        """, [file_id, limit, offset]).fetchdf()
        
        # Convertir en format JSON-friendly
        data = results.to_dict(orient='records')
        
        return {
            "file_id": file_id,
            "original_filename": file_info[1],
            "total_rows": file_info[2],
            "current_page": offset // limit + 1,
            "page_size": limit,
            "returned_rows": len(data),
            "data": data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files")
async def list_uploaded_files():
    """
    Lister tous les fichiers uploadés (depuis DuckDB)
    """
    try:
        conn = db.get_connection()
        files = conn.execute("""
            SELECT file_id, original_filename, row_count, upload_timestamp, status
            FROM files
            ORDER BY upload_timestamp DESC
        """).fetchdf()
        
        return {
            "total": len(files),
            "files": files.to_dict(orient='records')
        }
    except Exception as e:
        # Fallback: lister depuis le cache Parquet si DuckDB échoue
        try:
            cache_dir = settings.PARQUET_CACHE_DIR
            parquet_files = list(cache_dir.glob("*.parquet"))
            
            files_list = []
            for file_path in parquet_files:
                file_id = file_path.stem
                df = pd.read_parquet(file_path)
                files_list.append({
                    "file_id": file_id,
                    "original_filename": "Unknown",
                    "row_count": len(df),
                    "status": "completed"
                })
            
            return {
                "total": len(files_list),
                "files": files_list,
                "source": "parquet_cache"
            }
        except Exception as fallback_error:
            raise HTTPException(status_code=500, detail=str(e))


@router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """
    Supprimer un fichier (Parquet + DuckDB)
    """
    try:
        # Supprimer de DuckDB
        conn = db.get_connection()
        conn.execute("DELETE FROM results WHERE file_id = ?", [file_id])
        conn.execute("DELETE FROM files WHERE file_id = ?", [file_id])
        
        # Supprimer le fichier Parquet
        cache_dir = settings.PARQUET_CACHE_DIR
        file_path = cache_dir / f"{file_id}.parquet"
        
        if file_path.exists():
            file_path.unlink()
        
        return {
            "success": True,
            "message": f"Fichier {file_id} supprimé avec succès"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))