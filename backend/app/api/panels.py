# backend/app/api/panels.py
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import pandas as pd

from ..db.base import db
from ..services.panel_engine import PanelEngine

router = APIRouter()


@router.get("/panels/{file_id}")
async def analyze_panels(file_id: str):
    """
    Analyser les panels de tests:
    - Nombre de tests par patient par jour
    - Tests uniques par jour
    - Panels les plus fréquents
    """
    try:
        conn = db.get_connection()
        
        # Charger les données
        query = f"""
            SELECT numorden, nombre, date 
            FROM results 
            WHERE file_id = '{file_id}'
            ORDER BY numorden, date
        """
        df = conn.execute(query).fetchdf()
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée")
        
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
async def get_patient_panels(file_id: str, numorden: str):
    """
    Obtenir l'historique des panels pour un patient spécifique
    """
    try:
        conn = db.get_connection()
        
        query = f"""
            SELECT date, nombre, textores
            FROM results 
            WHERE file_id = '{file_id}' AND numorden = '{numorden}'
            ORDER BY date, nombre
        """
        df = conn.execute(query).fetchdf()
        
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
async def get_top_panels(file_id: str, limit: int = 10):
    """
    Obtenir les combinaisons de tests les plus fréquentes
    """
    try:
        conn = db.get_connection()
        
        query = f"""
            SELECT numorden, date, nombre
            FROM results 
            WHERE file_id = '{file_id}'
            ORDER BY numorden, date
        """
        df = conn.execute(query).fetchdf()
        
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

