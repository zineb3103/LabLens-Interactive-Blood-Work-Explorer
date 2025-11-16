# backend/app/api/panels.py
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import pandas as pd
from sqlmodel import Session, select

from ..db.base import get_session
from ..db.models import Result, File
from ..services.panel_engine import PanelEngine

router = APIRouter()


@router.get("/panels/{file_id}")
async def analyze_panels(file_id: str, session: Session = Depends(get_session)):
    """
    Analyser les panels de tests:
    - Nombre de tests par patient par jour
    - Tests uniques par jour
    - Panels les plus fréquents
    """
    try:
        # Vérifier que le fichier existe
        file_stmt = select(File).where(File.file_id == file_id)
        file_record = session.exec(file_stmt).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="Fichier non trouvé")
        
        # Charger les données avec SQLModel
        results_stmt = (
            select(Result)
            .where(Result.file_id == file_id)
            .order_by(Result.numorden, Result.date)
        )
        results = session.exec(results_stmt).all()
        
        if not results:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée")
        
        # Convertir en DataFrame
        data_list = []
        for result in results:
            data_list.append({
                "numorden": result.numorden,
                "nombre": result.nombre,
                "date": result.date.isoformat() if result.date else None
            })
        df = pd.DataFrame(data_list)
        
        # Utiliser le service d'analyse de panels
        panel_engine = PanelEngine(df)
        analysis = panel_engine.analyze_panels()
        
        return {
            "success": True,
            "file_id": file_id,
            "total_tests": len(df),
            "analysis": analysis
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/panels/{file_id}/patient/{numorden}")
async def get_patient_panels(file_id: str, numorden: str, session: Session = Depends(get_session)):
    """
    Obtenir l'historique des panels pour un patient spécifique
    """
    try:
        # Charger les données avec SQLModel
        results_stmt = (
            select(Result)
            .where(Result.file_id == file_id)
            .where(Result.numorden == numorden)
            .order_by(Result.date, Result.nombre)
        )
        results = session.exec(results_stmt).all()
        
        if not results:
            raise HTTPException(status_code=404, detail="Patient non trouvé")
        
        # Convertir en DataFrame
        data_list = []
        for result in results:
            data_list.append({
                "date": result.date.isoformat() if result.date else None,
                "nombre": result.nombre,
                "textores": result.textores
            })
        df = pd.DataFrame(data_list)
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Patient non trouvé")
        
        # Grouper par date
        panels_by_date = []
        for date, group in df.groupby('date'):
            panels_by_date.append({
                "date": str(date),
                "tests": group[['nombre', 'textores']].to_dict(orient='records'),
                "test_count": len(group)
            })
        
        # Trier par date
        panels_by_date.sort(key=lambda x: x['date'])
        
        return {
            "success": True,
            "file_id": file_id,
            "numorden": numorden,
            "total_dates": len(panels_by_date),
            "panels": panels_by_date
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/panels/{file_id}/top")
async def get_top_panels(file_id: str, limit: int = 10, session: Session = Depends(get_session)):
    """
    Obtenir les combinaisons de tests les plus fréquentes
    """
    try:
        # Vérifier que le fichier existe
        file_stmt = select(File).where(File.file_id == file_id)
        file_record = session.exec(file_stmt).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="Fichier non trouvé")
        
        # Charger les données avec SQLModel
        results_stmt = (
            select(Result)
            .where(Result.file_id == file_id)
            .order_by(Result.numorden, Result.date)
        )
        results = session.exec(results_stmt).all()
        
        if not results:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée")
        
        # Convertir en DataFrame
        data_list = []
        for result in results:
            data_list.append({
                "numorden": result.numorden,
                "date": result.date.isoformat() if result.date else None,
                "nombre": result.nombre
            })
        df = pd.DataFrame(data_list)
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée")
        
        # Grouper par patient + date pour identifier les panels
        panels = df.groupby(['numorden', 'date'])['nombre'].apply(lambda x: tuple(sorted(x))).reset_index()
        panels.columns = ['numorden', 'date', 'panel']
        
        # Compter les occurrences de chaque panel
        panel_counts = panels['panel'].value_counts().head(limit)
        
        # Formater le résultat
        top_panels = []
        for panel_tuple, count in panel_counts.items():
            top_panels.append({
                "tests": list(panel_tuple),
                "count": int(count),
                "test_count": len(panel_tuple)
            })
        
        return {
            "success": True,
            "file_id": file_id,
            "top_panels": top_panels
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

