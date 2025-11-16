# backend/app/api/repeats.py
from fastapi import APIRouter, HTTPException, Depends
import pandas as pd
from sqlmodel import Session, select

from ..db.base import get_session
from ..db.models import Result, File
from ..services.repeat_engine import RepeatEngine

router = APIRouter()


@router.get("/repeats/{file_id}")
async def analyze_repeats(file_id: str, session: Session = Depends(get_session)):
    """
    Analyser les tests répétés:
    - Nombre de patients avec des tests répétés
    - Répétitions moyennes par patient
    - Tests les plus répétés
    - Intervalles entre répétitions
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
            .order_by(Result.numorden, Result.nombre, Result.date)
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
                "date": result.date.isoformat() if result.date else None,
                "textores": result.textores
            })
        df = pd.DataFrame(data_list)
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée")
        
        # Utiliser le service d'analyse de répétitions
        repeat_engine = RepeatEngine(df)
        analysis = repeat_engine.analyze_repeats()
        
        return {
            "success": True,
            "file_id": file_id,
            "total_tests": len(df),
            "analysis": analysis
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/repeats/{file_id}/test/{test_name}")
async def get_test_repeat_history(file_id: str, test_name: str, session: Session = Depends(get_session)):
    """
    Obtenir l'historique de répétition pour un test spécifique
    """
    try:
        # Charger les données avec SQLModel
        results_stmt = (
            select(Result)
            .where(Result.file_id == file_id)
            .where(Result.nombre == test_name)
            .order_by(Result.numorden, Result.date)
        )
        results = session.exec(results_stmt).all()
        
        if not results:
            raise HTTPException(status_code=404, detail="Test non trouvé")
        
        # Convertir en DataFrame
        data_list = []
        for result in results:
            data_list.append({
                "numorden": result.numorden,
                "date": result.date.isoformat() if result.date else None,
                "textores": result.textores
            })
        df = pd.DataFrame(data_list)
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Test non trouvé")
        
        # Analyser les répétitions par patient
        repeat_history = []
        for patient, group in df.groupby('numorden'):
            if len(group) > 1:  # Seulement les patients avec répétitions
                dates = sorted(group['date'].tolist())
                
                # Calculer les intervalles
                intervals = []
                for i in range(1, len(dates)):
                    delta = (pd.to_datetime(dates[i]) - pd.to_datetime(dates[i-1])).days
                    intervals.append(delta)
                
                repeat_history.append({
                    "numorden": str(patient),
                    "repeat_count": len(group),
                    "dates": [str(d) for d in dates],
                    "intervals_days": intervals,
                    "avg_interval_days": sum(intervals) / len(intervals) if intervals else None,
                    "results": group[['date', 'textores']].to_dict(orient='records')
                })
        
        # Trier par nombre de répétitions décroissant
        repeat_history.sort(key=lambda x: x['repeat_count'], reverse=True)
        
        return {
            "success": True,
            "file_id": file_id,
            "test_name": test_name,
            "total_patients_with_repeats": len(repeat_history),
            "repeat_history": repeat_history[:50]  # Limiter à 50 patients
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/repeats/{file_id}/patient/{numorden}")
async def get_patient_repeats(file_id: str, numorden: str, session: Session = Depends(get_session)):
    """
    Obtenir tous les tests répétés pour un patient spécifique
    """
    try:
        # Charger les données avec SQLModel
        results_stmt = (
            select(Result)
            .where(Result.file_id == file_id)
            .where(Result.numorden == numorden)
            .order_by(Result.nombre, Result.date)
        )
        results = session.exec(results_stmt).all()
        
        if not results:
            raise HTTPException(status_code=404, detail="Patient non trouvé")
        
        # Convertir en DataFrame
        data_list = []
        for result in results:
            data_list.append({
                "nombre": result.nombre,
                "date": result.date.isoformat() if result.date else None,
                "textores": result.textores
            })
        df = pd.DataFrame(data_list)
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Patient non trouvé")
        
        # Identifier les tests répétés
        repeated_tests = []
        for test, group in df.groupby('nombre'):
            if len(group) > 1:  # Seulement les tests répétés
                dates = sorted(group['date'].tolist())
                
                # Calculer les intervalles
                intervals = []
                for i in range(1, len(dates)):
                    delta = (pd.to_datetime(dates[i]) - pd.to_datetime(dates[i-1])).days
                    intervals.append(delta)
                
                repeated_tests.append({
                    "test_name": str(test),
                    "repeat_count": len(group),
                    "dates": [str(d) for d in dates],
                    "intervals_days": intervals,
                    "avg_interval_days": sum(intervals) / len(intervals) if intervals else None,
                    "results": group[['date', 'textores']].to_dict(orient='records')
                })
        
        # Trier par nombre de répétitions décroissant
        repeated_tests.sort(key=lambda x: x['repeat_count'], reverse=True)
        
        return {
            "success": True,
            "file_id": file_id,
            "numorden": numorden,
            "total_repeated_tests": len(repeated_tests),
            "repeated_tests": repeated_tests
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

