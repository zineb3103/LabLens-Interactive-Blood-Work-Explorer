# backend/app/api/views.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import uuid
from datetime import datetime
from sqlmodel import Session, select

from ..db.base import get_session
from ..db.models import View, File, Result

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
async def create_view(request: CreateViewRequest, session: Session = Depends(get_session)):
    """
    Créer une nouvelle vue (cohort) sauvegardée
    """
    try:
        # Vérifier que le fichier existe
        file_stmt = select(File).where(File.file_id == request.file_id)
        file_record = session.exec(file_stmt).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="Fichier non trouvé")
        
        # Créer la vue
        view_record = View(
            view_id=str(uuid.uuid4()),
            name=request.name,
            file_id=request.file_id,
            filters=json.dumps([f.dict() for f in request.filters]),
            description=request.description
        )
        session.add(view_record)
        session.commit()
        
        return {
            "success": True,
            "view_id": view_record.view_id,
            "name": view_record.name,
            "message": "Vue créée avec succès"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/views")
async def list_views(file_id: Optional[str] = None, session: Session = Depends(get_session)):
    """
    Lister toutes les vues sauvegardées (optionnellement filtrées par file_id)
    """
    try:
        # Construire la requête
        if file_id:
            views_stmt = select(View).where(View.file_id == file_id).order_by(View.created_at.desc())
        else:
            views_stmt = select(View).order_by(View.created_at.desc())
        
        views = session.exec(views_stmt).all()
        
        # Convertir en format JSON
        views_list = []
        for view in views:
            view_dict = {
                "view_id": view.view_id,
                "name": view.name,
                "file_id": view.file_id,
                "filters": json.loads(view.filters) if view.filters else [],
                "description": view.description,
                "created_at": view.created_at.isoformat() if view.created_at else None,
                "updated_at": view.updated_at.isoformat() if view.updated_at else None
            }
            views_list.append(view_dict)
        
        return {
            "success": True,
            "total": len(views_list),
            "views": views_list
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/views/{view_id}")
async def get_view(view_id: str, session: Session = Depends(get_session)):
    """
    Obtenir les détails d'une vue spécifique
    """
    try:
        view_stmt = select(View).where(View.view_id == view_id)
        view = session.exec(view_stmt).first()
        
        if not view:
            raise HTTPException(status_code=404, detail="Vue non trouvée")
        
        # Convertir en dictionnaire
        view_dict = {
            "view_id": view.view_id,
            "name": view.name,
            "file_id": view.file_id,
            "filters": json.loads(view.filters) if view.filters else [],
            "description": view.description,
            "created_at": view.created_at.isoformat() if view.created_at else None,
            "updated_at": view.updated_at.isoformat() if view.updated_at else None
        }
        
        return {
            "success": True,
            "view": view_dict
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/views/{view_id}")
async def update_view(view_id: str, request: UpdateViewRequest, session: Session = Depends(get_session)):
    """
    Mettre à jour une vue existante
    """
    try:
        # Vérifier que la vue existe
        view_stmt = select(View).where(View.view_id == view_id)
        view = session.exec(view_stmt).first()
        
        if not view:
            raise HTTPException(status_code=404, detail="Vue non trouvée")
        
        # Mettre à jour les champs
        if request.name is not None:
            view.name = request.name
        
        if request.filters is not None:
            view.filters = json.dumps([f.dict() for f in request.filters])
        
        if request.description is not None:
            view.description = request.description
        
        view.updated_at = datetime.utcnow()
        
        session.add(view)
        session.commit()
        
        return {
            "success": True,
            "view_id": view_id,
            "message": "Vue mise à jour avec succès"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/views/{view_id}")
async def delete_view(view_id: str, session: Session = Depends(get_session)):
    """
    Supprimer une vue
    """
    try:
        # Vérifier que la vue existe
        view_stmt = select(View).where(View.view_id == view_id)
        view = session.exec(view_stmt).first()
        
        if not view:
            raise HTTPException(status_code=404, detail="Vue non trouvée")
        
        # Supprimer la vue
        session.delete(view)
        session.commit()
        
        return {
            "success": True,
            "view_id": view_id,
            "message": "Vue supprimée avec succès"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/views/{view_id}/apply")
async def apply_view(view_id: str, session: Session = Depends(get_session)):
    """
    Appliquer une vue sauvegardée et retourner les données filtrées
    """
    try:
        # Récupérer la vue
        view_stmt = select(View).where(View.view_id == view_id)
        view = session.exec(view_stmt).first()
        
        if not view:
            raise HTTPException(status_code=404, detail="Vue non trouvée")
        
        filters = json.loads(view.filters) if view.filters else []
        
        # Construire la requête avec SQLModel
        query = select(Result).where(Result.file_id == view.file_id)
        
        # Appliquer les filtres (similaire à subset_manual)
        from sqlmodel import and_, or_

        if filters:
            conditions = []
            for filter_cond in filters:
                col = filter_cond['column']
                op = filter_cond['operator']
                val = filter_cond['value']
                
                if not val:
                    continue
                
                column_attr = getattr(Result, col, None)
                if column_attr is None:
                    continue
                
                if op == 'LIKE':
                    conditions.append(column_attr.like(f'%{val}%'))
                elif op == 'IN':
                    values = [v.strip() for v in val.split(',')]
                    conditions.append(column_attr.in_(values))
                elif op == '=':
                    if col == 'edad':
                        conditions.append(column_attr == int(val))
                    else:
                        conditions.append(column_attr == val)
                elif op == '!=':
                    if col == 'edad':
                        conditions.append(column_attr != int(val))
                    else:
                        conditions.append(column_attr != val)
                elif op == '>':
                    if col == 'edad':
                        conditions.append(column_attr > int(val))
                    else:
                        conditions.append(column_attr > val)
                elif op == '<':
                    if col == 'edad':
                        conditions.append(column_attr < int(val))
                    else:
                        conditions.append(column_attr < val)
                elif op == '>=':
                    if col == 'edad':
                        conditions.append(column_attr >= int(val))
                    else:
                        conditions.append(column_attr >= val)
                elif op == '<=':
                    if col == 'edad':
                        conditions.append(column_attr <= int(val))
                    else:
                        conditions.append(column_attr <= val)
            
            query = query.where(and_(*conditions))
        
        results = session.exec(query).all()
        
        # Convertir en format JSON-friendly
        data = []
        for result in results:
            data.append({
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
            })
        
        return {
            "success": True,
            "view_id": view_id,
            "file_id": view.file_id,
            "total_rows": len(data),
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/views/{view_id}/share")
async def get_shareable_link(view_id: str, session: Session = Depends(get_session)):
    """
    Générer un lien partageable pour une vue
    """
    try:
        # Vérifier que la vue existe
        view_stmt = select(View).where(View.view_id == view_id)
        view = session.exec(view_stmt).first()
        if not view:
            raise HTTPException(status_code=404, detail="Vue non trouvée")
        
        # Générer le lien (à adapter selon votre domaine)
        share_link = f"http://localhost:3000/explorer?view_id={view_id}"
        
        return {
            "success": True,
            "view_id": view_id,
            "view_name": view.name,
            "share_link": share_link
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))