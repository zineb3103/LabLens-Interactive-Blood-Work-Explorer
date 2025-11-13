# backend/app/api/views.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import uuid
from datetime import datetime

from ..db.base import db

router = APIRouter()


class FilterCondition(BaseModel):
    column: str
    operator: str
    value: str


class CreateViewRequest(BaseModel):
    name: str
    file_id: str
    filters: List[FilterCondition]
    description: Optional[str] = None


class UpdateViewRequest(BaseModel):
    name: Optional[str] = None
    filters: Optional[List[FilterCondition]] = None
    description: Optional[str] = None


@router.post("/views")
async def create_view(request: CreateViewRequest):
    """
    Créer une nouvelle vue (cohort) sauvegardée
    """
    try:
        conn = db.get_connection()
        
        # Créer la table views si elle n'existe pas
        conn.execute("""
            CREATE TABLE IF NOT EXISTS views (
                view_id VARCHAR PRIMARY KEY,
                name VARCHAR NOT NULL,
                file_id VARCHAR NOT NULL,
                filters TEXT,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Générer un ID unique
        view_id = str(uuid.uuid4())
        
        # Sérialiser les filtres en JSON
        filters_json = json.dumps([f.dict() for f in request.filters])
        
        # Insérer la vue
        conn.execute("""
            INSERT INTO views (view_id, name, file_id, filters, description)
            VALUES (?, ?, ?, ?, ?)
        """, [view_id, request.name, request.file_id, filters_json, request.description])
        
        return {
            "success": True,
            "view_id": view_id,
            "name": request.name,
            "message": "Vue créée avec succès"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/views")
async def list_views(file_id: Optional[str] = None):
    """
    Lister toutes les vues sauvegardées (optionnellement filtrées par file_id)
    """
    try:
        conn = db.get_connection()
        
        # Vérifier si la table existe
        try:
            if file_id:
                query = "SELECT * FROM views WHERE file_id = ? ORDER BY created_at DESC"
                result = conn.execute(query, [file_id]).fetchdf()
            else:
                query = "SELECT * FROM views ORDER BY created_at DESC"
                result = conn.execute(query).fetchdf()
            
            # Convertir en liste de dictionnaires
            views = result.to_dict(orient='records')
            
            # Parser les filtres JSON
            for view in views:
                if view.get('filters'):
                    view['filters'] = json.loads(view['filters'])
            
            return {
                "success": True,
                "total": len(views),
                "views": views
            }
            
        except:
            # Table n'existe pas encore
            return {
                "success": True,
                "total": 0,
                "views": []
            }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/views/{view_id}")
async def get_view(view_id: str):
    """
    Obtenir les détails d'une vue spécifique
    """
    try:
        conn = db.get_connection()
        
        result = conn.execute("""
            SELECT * FROM views WHERE view_id = ?
        """, [view_id]).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Vue non trouvée")
        
        # Convertir en dictionnaire
        columns = ['view_id', 'name', 'file_id', 'filters', 'description', 'created_at', 'updated_at']
        view = dict(zip(columns, result))
        
        # Parser les filtres JSON
        if view.get('filters'):
            view['filters'] = json.loads(view['filters'])
        
        return {
            "success": True,
            "view": view
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/views/{view_id}")
async def update_view(view_id: str, request: UpdateViewRequest):
    """
    Mettre à jour une vue existante
    """
    try:
        conn = db.get_connection()
        
        # Vérifier que la vue existe
        existing = conn.execute("SELECT * FROM views WHERE view_id = ?", [view_id]).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Vue non trouvée")
        
        # Construire la requête de mise à jour
        updates = []
        params = []
        
        if request.name is not None:
            updates.append("name = ?")
            params.append(request.name)
        
        if request.filters is not None:
            updates.append("filters = ?")
            params.append(json.dumps([f.dict() for f in request.filters]))
        
        if request.description is not None:
            updates.append("description = ?")
            params.append(request.description)
        
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(view_id)
            
            query = f"UPDATE views SET {', '.join(updates)} WHERE view_id = ?"
            conn.execute(query, params)
        
        return {
            "success": True,
            "view_id": view_id,
            "message": "Vue mise à jour avec succès"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/views/{view_id}")
async def delete_view(view_id: str):
    """
    Supprimer une vue
    """
    try:
        conn = db.get_connection()
        
        # Vérifier que la vue existe
        existing = conn.execute("SELECT * FROM views WHERE view_id = ?", [view_id]).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Vue non trouvée")
        
        # Supprimer la vue
        conn.execute("DELETE FROM views WHERE view_id = ?", [view_id])
        
        return {
            "success": True,
            "view_id": view_id,
            "message": "Vue supprimée avec succès"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/views/{view_id}/apply")
async def apply_view(view_id: str):
    """
    Appliquer une vue sauvegardée et retourner les données filtrées
    """
    try:
        conn = db.get_connection()
        
        # Récupérer la vue
        result = conn.execute("""
            SELECT file_id, filters FROM views WHERE view_id = ?
        """, [view_id]).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Vue non trouvée")
        
        file_id, filters_json = result
        filters = json.loads(filters_json)
        
        # Construire la requête SQL
        base_query = f"SELECT * FROM results WHERE file_id = '{file_id}'"
        
        if filters:
            conditions = []
            for filter_cond in filters:
                col = filter_cond['column']
                op = filter_cond['operator']
                val = filter_cond['value']
                
                if not val:
                    continue
                
                if op == 'LIKE':
                    conditions.append(f"{col} LIKE '%{val}%'")
                elif op == 'IN':
                    values = [v.strip() for v in val.split(',')]
                    values_str = ', '.join([f"'{v}'" for v in values])
                    conditions.append(f"{col} IN ({values_str})")
                elif col == 'edad':
                    conditions.append(f"{col} {op} {val}")
                else:
                    conditions.append(f"{col} {op} '{val}'")
            
            if conditions:
                base_query += " AND " + " AND ".join(conditions)
        
        # Exécuter la requête
        result_df = conn.execute(base_query).fetchdf()
        data = result_df.to_dict(orient='records')
        
        return {
            "success": True,
            "view_id": view_id,
            "file_id": file_id,
            "total_rows": len(data),
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/views/{view_id}/share")
async def get_shareable_link(view_id: str):
    """
    Générer un lien partageable pour une vue
    """
    try:
        conn = db.get_connection()
        
        # Vérifier que la vue existe
        result = conn.execute("SELECT name FROM views WHERE view_id = ?", [view_id]).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Vue non trouvée")
        
        # Générer le lien (à adapter selon votre domaine)
        share_link = f"http://localhost:3000/explorer?view_id={view_id}"
        
        return {
            "success": True,
            "view_id": view_id,
            "view_name": result[0],
            "share_link": share_link
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))