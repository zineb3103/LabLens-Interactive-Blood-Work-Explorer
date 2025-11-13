# backend/app/api/stats.py
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from pydantic import BaseModel
import pandas as pd
import numpy as np

from ..db.base import db
from ..services.stats_engine import StatsEngine

router = APIRouter()


class StatsRequest(BaseModel):
    file_id: str
    columns: list = None  # Si None, calculer pour toutes les colonnes


@router.post("/stats/summary")
async def compute_summary_stats(request: StatsRequest):
    """
    Calculer les statistiques descriptives pour un fichier
    
    Retourne:
    - Statistiques numériques: mean, std, min, max, quantiles
    - Statistiques catégorielles: unique counts, mode, distribution
    - Missingness par colonne
    """
    try:
        conn = db.get_connection()
        
        # Charger les données
        query = f"SELECT * FROM results WHERE file_id = '{request.file_id}'"
        df = conn.execute(query).fetchdf()
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée")
        
        # Utiliser le service de statistiques
        stats_engine = StatsEngine(df)
        summary = stats_engine.compute_full_summary(request.columns)
        
        return {
            "success": True,
            "file_id": request.file_id,
            "total_rows": len(df),
            "summary": summary
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/{file_id}/column/{column_name}")
async def get_column_stats(file_id: str, column_name: str):
    """
    Obtenir les statistiques détaillées pour une colonne spécifique
    """
    try:
        conn = db.get_connection()
        
        query = f"SELECT {column_name} FROM results WHERE file_id = '{file_id}'"
        df = conn.execute(query).fetchdf()
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée")
        
        column_data = df[column_name]
        
        # Déterminer le type de colonne
        is_numeric = pd.api.types.is_numeric_dtype(column_data)
        
        if is_numeric:
            # Statistiques numériques
            stats = {
                "type": "numeric",
                "count": int(column_data.count()),
                "missing": int(column_data.isna().sum()),
                "missing_pct": float(column_data.isna().sum() / len(column_data) * 100),
                "mean": float(column_data.mean()),
                "std": float(column_data.std()),
                "min": float(column_data.min()),
                "max": float(column_data.max()),
                "median": float(column_data.median()),
                "q25": float(column_data.quantile(0.25)),
                "q75": float(column_data.quantile(0.75)),
                "distribution": column_data.value_counts().head(20).to_dict()
            }
        else:
            # Statistiques catégorielles
            value_counts = column_data.value_counts()
            stats = {
                "type": "categorical",
                "count": int(column_data.count()),
                "missing": int(column_data.isna().sum()),
                "missing_pct": float(column_data.isna().sum() / len(column_data) * 100),
                "unique": int(column_data.nunique()),
                "top": str(value_counts.index[0]) if len(value_counts) > 0 else None,
                "freq": int(value_counts.iloc[0]) if len(value_counts) > 0 else 0,
                "distribution": value_counts.head(20).to_dict()
            }
        
        return {
            "success": True,
            "column": column_name,
            "file_id": file_id,
            "stats": stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/{file_id}/missing")
async def get_missing_summary(file_id: str):
    """
    Obtenir un résumé des valeurs manquantes par colonne
    """
    try:
        conn = db.get_connection()
        
        query = f"SELECT * FROM results WHERE file_id = '{file_id}'"
        df = conn.execute(query).fetchdf()
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée")
        
        # Calculer les valeurs manquantes
        missing_stats = []
        for col in df.columns:
            if col not in ['id', 'file_id', 'created_at']:
                missing_count = df[col].isna().sum()
                missing_pct = (missing_count / len(df)) * 100
                
                missing_stats.append({
                    "column": col,
                    "missing_count": int(missing_count),
                    "missing_pct": float(missing_pct),
                    "present_count": int(len(df) - missing_count)
                })
        
        # Trier par pourcentage de valeurs manquantes
        missing_stats.sort(key=lambda x: x['missing_pct'], reverse=True)
        
        return {
            "success": True,
            "file_id": file_id,
            "total_rows": len(df),
            "missing_summary": missing_stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

