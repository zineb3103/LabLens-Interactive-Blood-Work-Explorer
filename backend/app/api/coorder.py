# backend/app/api/coorder.py
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import pandas as pd

from ..db.base import db

router = APIRouter()


@router.get("/coorder/{file_id}")
async def analyze_coorder(file_id: str, top_n: int = 50):
    """
    Analyser le co-ordonnancement:
    - Paires de tests ordonnés le même jour
    - Matrice de co-occurrence
    - Analyse par service
    """
    try:
        conn = db.get_connection()
        
        query = f"""
            SELECT numorden, nombre, nombre2, date
            FROM results 
            WHERE file_id = '{file_id}'
            ORDER BY numorden, date
        """
        df = conn.execute(query).fetchdf()
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée")
        
        # Analyser les paires co-ordonnées
        top_pairs = _compute_test_pairs(df, top_n)
        
        # Analyser par service
        by_service = _compute_coorder_by_service(df)
        
        return {
            "success": True,
            "file_id": file_id,
            "total_tests": len(df),
            "top_pairs": top_pairs,
            "by_service": by_service
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/coorder/{file_id}/matrix")
async def get_coorder_matrix(file_id: str, tests: str = None):
    """
    Obtenir une matrice de co-occurrence pour visualisation (heatmap)
    
    Args:
        tests: Liste de tests séparés par des virgules (optionnel)
    """
    try:
        conn = db.get_connection()
        
        query = f"""
            SELECT numorden, nombre, date
            FROM results 
            WHERE file_id = '{file_id}'
        """
        df = conn.execute(query).fetchdf()
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée")
        
        # Filtrer par tests si spécifié
        if tests:
            test_list = [t.strip() for t in tests.split(',')]
            df = df[df['nombre'].isin(test_list)]
        
        # Créer la matrice de co-occurrence
        matrix = _create_cooccurrence_matrix(df)
        
        return {
            "success": True,
            "file_id": file_id,
            "matrix": matrix
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/coorder/{file_id}/service/{service_name}")
async def get_coorder_by_service(file_id: str, service_name: str):
    """
    Analyser le co-ordonnancement pour un service spécifique
    """
    try:
        conn = db.get_connection()
        
        query = f"""
            SELECT numorden, nombre, date
            FROM results 
            WHERE file_id = '{file_id}' AND nombre2 = '{service_name}'
            ORDER BY numorden, date
        """
        df = conn.execute(query).fetchdf()
        
        if len(df) == 0:
            raise HTTPException(status_code=404, detail="Service non trouvé")
        
        # Calculer les paires pour ce service
        top_pairs = _compute_test_pairs(df, 20)
        
        return {
            "success": True,
            "file_id": file_id,
            "service": service_name,
            "total_tests": len(df),
            "top_pairs": top_pairs
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _compute_test_pairs(df: pd.DataFrame, top_n: int = 50):
    """
    Calculer les paires de tests co-ordonnés le même jour
    """
    from itertools import combinations
    from collections import Counter
    
    # Grouper par patient et date
    grouped = df.groupby(['numorden', 'date'])['nombre'].apply(list)
    
    # Compter les paires
    pair_counter = Counter()
    
    for tests in grouped:
        if len(tests) > 1:
            # Générer toutes les paires de tests pour ce jour
            for pair in combinations(sorted(tests), 2):
                pair_counter[pair] += 1
    
    # Obtenir les top N paires
    top_pairs = pair_counter.most_common(top_n)
    
    # Formater
    result = []
    for (test1, test2), count in top_pairs:
        result.append({
            "test1": str(test1),
            "test2": str(test2),
            "count": int(count)
        })
    
    return result


def _compute_coorder_by_service(df: pd.DataFrame):
    """
    Analyser le co-ordonnancement par service (nombre2)
    """
    if 'nombre2' not in df.columns:
        return []
    
    service_stats = []
    
    for service, group in df.groupby('nombre2'):
        # Calculer les paires pour ce service
        top_pairs = _compute_test_pairs(group, 10)
        
        # Compter le nombre total de co-ordonnancements
        grouped = group.groupby(['numorden', 'date']).size()
        multi_test_days = (grouped > 1).sum()
        
        service_stats.append({
            "service": str(service),
            "total_tests": len(group),
            "days_with_multiple_tests": int(multi_test_days),
            "top_pairs": top_pairs[:5]  # Top 5 paires pour ce service
        })
    
    # Trier par nombre de tests décroissant
    service_stats.sort(key=lambda x: x['total_tests'], reverse=True)
    
    return service_stats


def _create_cooccurrence_matrix(df: pd.DataFrame):
    """
    Créer une matrice de co-occurrence pour tous les tests
    """
    # Grouper par patient et date
    grouped = df.groupby(['numorden', 'date'])['nombre'].apply(list)
    
    # Obtenir tous les tests uniques
    all_tests = sorted(df['nombre'].unique())
    
    # Initialiser la matrice
    matrix = {test: {other: 0 for other in all_tests} for test in all_tests}
    
    # Remplir la matrice
    for tests in grouped:
        if len(tests) > 1:
            for i, test1 in enumerate(tests):
                for test2 in tests[i+1:]:
                    # Incrémenter les deux directions (matrice symétrique)
                    matrix[test1][test2] += 1
                    matrix[test2][test1] += 1
    
    # Convertir en format plus compact pour le frontend
    result = {
        "tests": all_tests,
        "matrix": [[matrix[t1][t2] for t2 in all_tests] for t1 in all_tests]
    }
    
    return result