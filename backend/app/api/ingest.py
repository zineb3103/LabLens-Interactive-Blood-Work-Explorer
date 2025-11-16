# backend/app/api/ingest.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
import pandas as pd
import io
from datetime import datetime, date
from pathlib import Path
import uuid
from sqlmodel import Session, select, func

from ..services.validator import DataValidator
from ..core.config import settings
from ..db.base import get_session
from ..db.models import Result, File

router = APIRouter()

REQUIRED_COLUMNS = ['numorden', 'sexo', 'edad', 'nombre', 'textores', 'nombre2', 'Date']
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

@router.post("/ingest")
async def ingest_file(file: UploadFile = File(...), session: Session = Depends(get_session)):
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
        
        # 9. Sauvegarder dans la base de données avec SQLModel ORM
        try:
            # Enregistrer les métadonnées du fichier
            file_record = File(
                file_id=file_id,
                original_filename=file.filename,
                row_count=len(cleaned_df),
                status='completed'
            )
            session.add(file_record)
            
            # Préparer les données pour l'insertion
            cleaned_df_db = cleaned_df.copy()
            cleaned_df_db['file_id'] = file_id
            
            # Renommer la colonne Date en date (lowercase pour cohérence)
            if 'Date' in cleaned_df_db.columns:
                cleaned_df_db = cleaned_df_db.rename(columns={'Date': 'date'})
            
            # Convertir les dates en format date Python
            if 'date' in cleaned_df_db.columns:
                cleaned_df_db['date'] = pd.to_datetime(cleaned_df_db['date']).dt.date
            
            # Générer les IDs automatiquement (DuckDB ne supporte pas AUTO_INCREMENT)
            # Récupérer le max ID actuel pour générer les IDs séquentiels
            max_id_stmt = select(func.max(Result.id))
            max_id_result = session.exec(max_id_stmt).one_or_none()
            max_id = max_id_result if max_id_result is not None else 0
            
            # Créer les objets Result à partir du DataFrame
            results_to_insert = []
            for idx, row in cleaned_df_db.iterrows():
                result = Result(
                    id=max_id + idx + 1,
                    file_id=row['file_id'],
                    numorden=str(row['numorden']),
                    sexo=str(row['sexo']),
                    edad=int(row['edad']),
                    nombre=str(row['nombre']),
                    textores=str(row['textores']),
                    nombre2=str(row['nombre2']),
                    date=row['date'] if isinstance(row['date'], date) else pd.to_datetime(row['date']).date(),
                    created_at=datetime.utcnow()
                )
                results_to_insert.append(result)
            
            # Insérer en batch avec SQLModel
            session.add_all(results_to_insert)
            session.commit()
            warnings.append({"message": f"✅ {len(cleaned_df)} lignes insérées dans la base de données"})
        except Exception as e:
            # On continue même si la DB échoue car on a le Parquet
            session.rollback()
            warnings.append({"message": f"⚠️ Erreur base de données: {str(e)}"})
            print(f"⚠️ Erreur lors de l'insertion dans la base de données: {str(e)}")
        
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
async def get_file_data_from_duckdb(
    file_id: str, 
    limit: int = 100, 
    offset: int = 0,
    session: Session = Depends(get_session)
):
    """
    Récupérer les données d'un fichier depuis la base de données avec pagination
    """
    try:
        # Vérifier si le fichier existe
        file_stmt = select(File).where(File.file_id == file_id)
        file_record = session.exec(file_stmt).first()
        
        if not file_record:
            raise HTTPException(status_code=404, detail="Fichier non trouvé dans la base de données")
        
        # Récupérer les données avec pagination
        results_stmt = (
            select(Result)
            .where(Result.file_id == file_id)
            .order_by(Result.created_at)
            .offset(offset)
            .limit(limit)
        )
        results = session.exec(results_stmt).all()
        
        # Convertir en format JSON-friendly
        data = []
        for result in results:
            data.append({
                "numorden": result.numorden,
                "sexo": result.sexo,
                "edad": result.edad,
                "nombre": result.nombre,
                "textores": result.textores,
                "nombre2": result.nombre2,
                "date": result.date.isoformat() if result.date else None
            })
        
        return {
            "file_id": file_id,
            "original_filename": file_record.original_filename,
            "total_rows": file_record.row_count,
            "current_page": offset // limit + 1,
            "page_size": limit,
            "returned_rows": len(data),
            "data": data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files")
async def list_uploaded_files(session: Session = Depends(get_session)):
    """
    Lister tous les fichiers uploadés depuis la base de données
    """
    try:
        # Récupérer tous les fichiers depuis la base de données
        files_stmt = select(File).order_by(File.upload_timestamp.desc())
        files = session.exec(files_stmt).all()
        
        # Convertir en format JSON-friendly
        files_list = []
        for file_record in files:
            files_list.append({
                "file_id": file_record.file_id,
                "original_filename": file_record.original_filename,
                "row_count": file_record.row_count,
                "upload_timestamp": file_record.upload_timestamp.isoformat() if file_record.upload_timestamp else None,
                "status": file_record.status
            })
        
        return {
            "total": len(files_list),
            "files": files_list
        }
    except Exception as e:
        # Fallback: lister depuis le cache Parquet si la DB échoue
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
async def delete_file(file_id: str, session: Session = Depends(get_session)):
    """
    Supprimer un fichier (Parquet + Base de données)
    """
    try:
        # Vérifier que le fichier existe
        file_stmt = select(File).where(File.file_id == file_id)
        file_record = session.exec(file_stmt).first()
        
        if not file_record:
            raise HTTPException(status_code=404, detail="Fichier non trouvé")
        
        # Supprimer tous les résultats associés
        results_stmt = select(Result).where(Result.file_id == file_id)
        results = session.exec(results_stmt).all()
        for result in results:
            session.delete(result)
        
        # Supprimer le fichier
        session.delete(file_record)
        session.commit()
        
        # Supprimer le fichier Parquet
        cache_dir = settings.PARQUET_CACHE_DIR
        file_path = cache_dir / f"{file_id}.parquet"
        
        if file_path.exists():
            file_path.unlink()
        
        return {
            "success": True,
            "message": f"Fichier {file_id} supprimé avec succès"
        }
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))