# backend/app/api/subset.py
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import pandas as pd
import re
from sqlmodel import Session, select, or_, and_, text
from sqlalchemy import text as sql_text

from ..db.base import get_session
from ..db.models import Result, File
from ..core.config import settings

router = APIRouter()


class FilterCondition(BaseModel):
    column: str
    operator: str
    value: str


class ManualFilterRequest(BaseModel):
    file_id: str
    filters: List[FilterCondition]


class SQLFilterRequest(BaseModel):
    file_id: str
    query: str


@router.post("/subset/manual")
async def subset_manual(request: ManualFilterRequest, session: Session = Depends(get_session)):
    """
    Appliquer des filtres manuels sur un dataset avec SQLModel ORM
    """
    try:
        # Vérifier que le fichier existe
        file_stmt = select(File).where(File.file_id == request.file_id)
        file_record = session.exec(file_stmt).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="Fichier non trouvé")
        
        # Construire la requête de base
        query = select(Result).where(Result.file_id == request.file_id)
        
        # Construire les conditions dynamiquement
        filter_conditions = []
        for filter_cond in request.filters:
            if not filter_cond.value:  # Skip empty filters
                continue
            
            column_name = filter_cond.column
            operator = filter_cond.operator
            value = filter_cond.value
            
            # Obtenir l'attribut de la colonne
            column_attr = getattr(Result, column_name, None)
            if column_attr is None:
                continue  # Colonne invalide, skip
            
            # Construire la condition selon l'opérateur
            if operator == 'LIKE':
                filter_conditions.append(column_attr.like(f"%{value}%"))
            elif operator == 'IN':
                values_list = [v.strip() for v in value.split(',')]
                filter_conditions.append(column_attr.in_(values_list))
            elif operator == '=':
                if column_name == 'edad':
                    filter_conditions.append(column_attr == int(value))
                else:
                    filter_conditions.append(column_attr == value)
            elif operator == '!=':
                if column_name == 'edad':
                    filter_conditions.append(column_attr != int(value))
                else:
                    filter_conditions.append(column_attr != value)
            elif operator == '>':
                if column_name == 'edad':
                    filter_conditions.append(column_attr > int(value))
                else:
                    filter_conditions.append(column_attr > value)
            elif operator == '<':
                if column_name == 'edad':
                    filter_conditions.append(column_attr < int(value))
                else:
                    filter_conditions.append(column_attr < value)
            elif operator == '>=':
                if column_name == 'edad':
                    filter_conditions.append(column_attr >= int(value))
                else:
                    filter_conditions.append(column_attr >= value)
            elif operator == '<=':
                if column_name == 'edad':
                    filter_conditions.append(column_attr <= int(value))
                else:
                    filter_conditions.append(column_attr <= value)
        
        # Appliquer les conditions à la requête
        if filter_conditions:
            query = query.where(and_(*filter_conditions))
        
        # Exécuter la requête avec SQLModel ORM
        results = session.exec(query).all()
        
        # Convertir en format JSON-friendly
        data = []
        for result in results:
            result_dict = {
                "id": result.id,
                "file_id": result.file_id,
                "numorden": result.numorden,
                "sexo": result.sexo,
                "edad": result.edad,
                "nombre": result.nombre,
                "textores": result.textores,
                "nombre2": result.nombre2,
                "date": result.date.isoformat() if result.date else None,
                "created_at": result.created_at.isoformat() if result.created_at else None
            }
            data.append(result_dict)
        
        return {
            "success": True,
            "data": data,
            "total_rows": len(data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subset/sql")
async def subset_sql(request: SQLFilterRequest, session: Session = Depends(get_session)):
    """
    Exécuter une requête SQL personnalisée (en lecture seule)
    
    SÉCURITÉ: Valider que la requête est en lecture seule et inclut file_id
    Note: Cet endpoint accepte du SQL brut pour des requêtes avancées.
    """
    try:
        # Valider le format de file_id (UUID ou alphanumérique)
        import uuid
        # Vérifier que file_id est un UUID valide ou alphanumérique
        file_id_clean = request.file_id.strip()
        if not file_id_clean or len(file_id_clean) > 100:
            raise HTTPException(
                status_code=400,
                detail="File ID invalide"
            )
        
        # Vérifier que file_id ne contient que des caractères sûrs (alphanumériques, tirets, underscores)
        if not re.match(r'^[a-zA-Z0-9_-]+$', file_id_clean):
            raise HTTPException(
                status_code=400,
                detail="File ID contient des caractères invalides"
            )
        
        # Vérifier que le file_id existe avec SQLModel
        file_stmt = select(File).where(File.file_id == file_id_clean)
        file_record = session.exec(file_stmt).first()
        
        if not file_record:
            raise HTTPException(
                status_code=404,
                detail=f"File ID '{file_id_clean}' non trouvé"
            )
        
        # Validation de sécurité
        query_lower = request.query.lower().strip()
        original_query_raw = request.query.strip()  # Garder la requête originale pour les messages d'erreur
        original_query = request.query.strip()
        
        # Normaliser la requête SQL (corriger les erreurs courantes)
        # Remplacer == par = (DuckDB utilise =, pas ==)
        original_query = re.sub(r'==', '=', original_query)
        
        # Remplacer les guillemets doubles par simples dans les valeurs (après les opérateurs de comparaison)
        # DuckDB utilise des guillemets simples ' pour les valeurs et des guillemets doubles " pour les identifiants
        original_query = re.sub(
            r'([=<>!]+)\s*"([^"]+)"',
            lambda m: m.group(1) + " '" + m.group(2) + "'",
            original_query
        )
        
        # Colonnes texte dans le schéma (VARCHAR) - doivent être comparées avec des chaînes
        TEXT_COLUMNS = {'file_id', 'numorden', 'sexo', 'nombre', 'textores', 'nombre2'}
        
        # Détecter et corriger les comparaisons de colonnes texte avec des nombres
        # Pattern: colonne_text opérateur nombre (sans guillemets)
        # Exemple: sexo=0 -> sexo='0' (mais en fait sexo devrait être 'F' ou 'M')
        def fix_text_column_comparison(match):
            column = match.group(1)
            operator = match.group(2)
            value = match.group(3)
            
            # Si c'est une colonne texte et la valeur est un nombre sans guillemets
            if column.lower() in TEXT_COLUMNS and value.isdigit():
                # Ajouter des guillemets simples autour de la valeur
                return f"{column}{operator}'{value}'"
            return match.group(0)
        
        # Chercher les patterns: colonne opérateur nombre (sans guillemets)
        original_query = re.sub(
            r'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*([=<>!]+)\s*(\d+)',
            fix_text_column_comparison,
            original_query,
            flags=re.IGNORECASE
        )
        
        # Mettre à jour query_lower après normalisation
        query_lower = original_query.lower().strip()
        
        # Supprimer les commentaires SQL (-- et /* */)
        query_no_comments = re.sub(r'--.*?$', '', query_lower, flags=re.MULTILINE)
        query_no_comments = re.sub(r'/\*.*?\*/', '', query_no_comments, flags=re.DOTALL)
        query_no_comments = query_no_comments.strip()
        
        # Re-normaliser après suppression des commentaires
        query_no_comments = re.sub(r'==', '=', query_no_comments)
        
        # Bloquer toute requête qui n'est pas SELECT
        if not query_no_comments.startswith('select'):
            raise HTTPException(
                status_code=400,
                detail="Seules les requêtes SELECT sont autorisées"
            )
        
        # Bloquer les mots-clés dangereux (plus complet)
        dangerous_keywords = [
            'insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate',
            'exec', 'execute', 'grant', 'revoke', 'commit', 'rollback',
            'union', 'script', 'javascript', 'vbscript', 'onload', 'onerror'
        ]
        for keyword in dangerous_keywords:
            if re.search(r'\b' + re.escape(keyword) + r'\b', query_no_comments):
                raise HTTPException(
                    status_code=400,
                    detail=f"Mot-clé interdit détecté: {keyword}"
                )
        
        # Construire la requête finale avec file_id
        # S'assurer que la requête filtre par file_id (validation améliorée)
        final_query = original_query
        
        # Utiliser file_id_clean au lieu de request.file_id
        if 'file_id' not in query_lower:
            # Si file_id n'est pas dans la requête, l'ajouter automatiquement
            if 'where' in query_lower:
                # Ajouter file_id à la clause WHERE existante
                final_query = re.sub(
                    r'\bwhere\b',
                    f"WHERE file_id = '{file_id_clean}' AND",
                    final_query,
                    flags=re.IGNORECASE,
                    count=1
                )
            else:
                # Ajouter une clause WHERE
                if final_query.rstrip().endswith(';'):
                    final_query = final_query.rstrip()[:-1] + f" WHERE file_id = '{file_id_clean}';"
                else:
                    final_query = final_query.rstrip() + f" WHERE file_id = '{file_id_clean}'"
        else:
            # Vérifier que le file_id dans la requête correspond à celui fourni
            # Protection contre SQL injection : vérifier que le file_id apparaît littéralement et est sécurisé
            if file_id_clean not in final_query:
                raise HTTPException(
                    status_code=400,
                    detail="Le file_id dans la requête doit correspondre au file_id fourni"
                )
            # Vérification supplémentaire : s'assurer que le file_id n'est pas dans une chaîne SQL dangereuse
            # Chercher des patterns suspects comme file_id suivi d'opérateurs SQL
            if re.search(rf"file_id\s*[=<>!]+\s*['\"]?[^'\"\s]+", final_query, re.IGNORECASE):
                # Vérifier que le file_id_clean est présent dans cette condition
                if not re.search(rf"file_id\s*=\s*['\"]?{re.escape(file_id_clean)}['\"]?", final_query, re.IGNORECASE):
                    raise HTTPException(
                        status_code=400,
                        detail="La condition file_id doit utiliser le file_id fourni"
                    )
        
        # Limiter la taille des résultats (protection contre les requêtes trop lourdes)
        MAX_RESULTS = 100000  # Limite de sécurité
        
        # Exécuter la requête avec limite
        try:
            # Ajouter LIMIT si pas déjà présent
            query_with_limit = final_query.rstrip()
            final_query_lower = query_with_limit.lower()
            if 'limit' not in final_query_lower:
                if query_with_limit.endswith(';'):
                    query_with_limit = query_with_limit[:-1] + f" LIMIT {MAX_RESULTS};"
                else:
                    query_with_limit = query_with_limit + f" LIMIT {MAX_RESULTS}"
            
            # Exécuter la requête SQL brute avec SQLAlchemy text()
            result = session.execute(sql_text(query_with_limit))
            rows = result.fetchall()
            columns = result.keys()
            
            # Convertir en DataFrame
            data_list = [dict(zip(columns, row)) for row in rows]
            result_df = pd.DataFrame(data_list)
            
            # Convertir en JSON (gérer les types datetime, etc.)
            data = result_df.to_dict(orient='records')
            
            # Nettoyer les données pour JSON
            for record in data:
                for key, value in record.items():
                    if pd.isna(value):
                        record[key] = None
                    elif hasattr(value, 'isoformat'):  # Pour datetime, date, etc.
                        try:
                            record[key] = value.isoformat()
                        except:
                            record[key] = str(value)
                    elif isinstance(value, (int, float, str, bool, type(None))):
                        # Types JSON-natifs, pas besoin de conversion
                        pass
                    else:
                        # Fallback : convertir en string
                        record[key] = str(value)
            
            return {
                "success": True,
                "data": data,
                "total_rows": len(data),
                "query_executed": query_with_limit,
                "has_more": len(data) >= MAX_RESULTS
            }
            
        except Exception as sql_error:
            error_msg = str(sql_error)
            # Améliorer les messages d'erreur pour être plus clairs
            # Utiliser original_query_raw pour vérifier les erreurs avant normalisation
            if '==' in original_query_raw:
                error_msg += " (Astuce: utilisez = au lieu de == pour les comparaisons - correction automatique appliquée)"
            if 'Referenced column' in error_msg and 'not found' in error_msg:
                # DuckDB utilise des guillemets simples pour les valeurs, pas des doubles
                if '"' in original_query_raw:
                    error_msg += " (Astuce: utilisez des guillemets simples ' pour les valeurs, pas des guillemets doubles \" - correction automatique appliquée)"
            if 'Could not convert string' in error_msg and 'when casting' in error_msg:
                # Erreur de type : comparaison d'une colonne texte avec un nombre
                # Colonnes texte: file_id, numorden, sexo, nombre, textores, nombre2
                # Colonnes numériques: id, edad
                if 'sexo' in error_msg.lower():
                    error_msg += " (Astuce: 'sexo' est une colonne texte (VARCHAR) contenant 'F' ou 'M', utilisez sexo='F' ou sexo='M' au lieu de sexo=0)"
                elif any(col in error_msg.lower() for col in ['file_id', 'numorden', 'nombre', 'textores', 'nombre2']):
                    error_msg += " (Astuce: cette colonne est de type texte (VARCHAR), utilisez des guillemets simples autour de la valeur, ex: colonne='valeur')"
            raise HTTPException(
                status_code=400,
                detail=f"Erreur SQL: {error_msg}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'exécution SQL: {str(e)}")


@router.post("/subset/preview")
async def preview_sql_query(request: SQLFilterRequest, session: Session = Depends(get_session)):
    """
    Prévisualiser une requête SQL sans l'exécuter (validation uniquement)
    Note: L'estimation du nombre de lignes nécessite l'exécution de la requête SQL brute,
    ce qui n'est plus supporté avec SQLModel ORM. Cette fonction valide uniquement la syntaxe.
    """
    try:
        query_lower = request.query.lower().strip()
        
        # Validation
        issues = []
        
        if not query_lower.startswith('select'):
            issues.append("La requête doit commencer par SELECT")
        
        dangerous_keywords = ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate']
        for keyword in dangerous_keywords:
            if keyword in query_lower:
                issues.append(f"Mot-clé interdit: {keyword}")
        
        if 'file_id' not in query_lower:
            issues.append("La requête devrait inclure un filtre sur file_id")
        
        # Note: L'estimation du nombre de lignes nécessiterait l'exécution de SQL brut
        # Avec SQLModel ORM, on ne peut pas facilement exécuter du SQL brut pour l'estimation
        # sans compromettre la sécurité. On retourne None pour l'estimation.
        estimated_rows = None
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "estimated_rows": estimated_rows,
            "query": request.query
        }
        
    except Exception as e:
        return {
            "valid": False,
            "issues": [str(e)],
            "estimated_rows": None,
            "query": request.query
        }