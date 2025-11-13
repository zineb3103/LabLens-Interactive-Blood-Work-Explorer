# ============================================================
# backend/app/services/panel_engine.py
# ============================================================

import pandas as pd
from typing import Dict, Any, List
from collections import Counter


class PanelEngine:
    """
    Service pour analyser les panels de tests
    """
    
    def __init__(self, df: pd.DataFrame):
        self.df = df
    
    def analyze_panels(self) -> Dict[str, Any]:
        """
        Analyse complète des panels
        """
        # Grouper par patient et date
        grouped = self.df.groupby(['numorden', 'date'])
        
        # Nombre de tests par patient-jour
        tests_per_day = grouped.size()
        
        # Statistiques sur les panels
        panel_stats = {
            "total_panels": len(tests_per_day),
            "avg_tests_per_panel": float(tests_per_day.mean()),
            "median_tests_per_panel": float(tests_per_day.median()),
            "min_tests_per_panel": int(tests_per_day.min()),
            "max_tests_per_panel": int(tests_per_day.max()),
            "std_tests_per_panel": float(tests_per_day.std())
        }
        
        # Distribution des tailles de panels
        panel_size_distribution = tests_per_day.value_counts().sort_index().to_dict()
        panel_stats["size_distribution"] = {int(k): int(v) for k, v in panel_size_distribution.items()}
        
        # Tests les plus ordonnés
        most_ordered_tests = self.df['nombre'].value_counts().head(20)
        panel_stats["most_ordered_tests"] = [
            {"test": str(test), "count": int(count)} 
            for test, count in most_ordered_tests.items()
        ]
        
        # Panels les plus fréquents (combinaisons de tests)
        panel_combinations = grouped['nombre'].apply(lambda x: tuple(sorted(x)))
        most_common_panels = panel_combinations.value_counts().head(10)
        
        panel_stats["most_common_panels"] = [
            {
                "tests": list(panel),
                "count": int(count),
                "test_count": len(panel)
            }
            for panel, count in most_common_panels.items()
        ]
        
        # Unique tests per day (tests uniques par jour)
        unique_tests_per_day = self._analyze_unique_tests_per_day()
        panel_stats["unique_tests_per_day"] = unique_tests_per_day
        
        # Analyse par service (nombre2)
        if 'nombre2' in self.df.columns:
            panels_by_service = self._analyze_by_service()
            panel_stats["by_service"] = panels_by_service
        
        return panel_stats
    
    def _analyze_unique_tests_per_day(self) -> Dict[str, Any]:
        """
        Analyser les tests uniques par jour
        Retourne:
        - Tests uniques globaux par jour (tous patients confondus)
        - Tests uniques par patient-jour
        """
        # Tests uniques globaux par jour (tous patients confondus)
        unique_tests_by_date = self.df.groupby('date')['nombre'].nunique()
        
        # Statistiques sur les tests uniques par jour
        stats = {
            "global_by_date": {
                "avg_unique_tests_per_day": float(unique_tests_by_date.mean()) if len(unique_tests_by_date) > 0 else 0,
                "median_unique_tests_per_day": float(unique_tests_by_date.median()) if len(unique_tests_by_date) > 0 else 0,
                "min_unique_tests_per_day": int(unique_tests_by_date.min()) if len(unique_tests_by_date) > 0 else 0,
                "max_unique_tests_per_day": int(unique_tests_by_date.max()) if len(unique_tests_by_date) > 0 else 0,
                "total_unique_days": int(len(unique_tests_by_date))
            }
        }
        
        # Tests uniques par patient-jour
        grouped = self.df.groupby(['numorden', 'date'])
        unique_tests_per_patient_day = grouped['nombre'].nunique()
        
        stats["per_patient_day"] = {
            "avg_unique_tests": float(unique_tests_per_patient_day.mean()) if len(unique_tests_per_patient_day) > 0 else 0,
            "median_unique_tests": float(unique_tests_per_patient_day.median()) if len(unique_tests_per_patient_day) > 0 else 0,
            "min_unique_tests": int(unique_tests_per_patient_day.min()) if len(unique_tests_per_patient_day) > 0 else 0,
            "max_unique_tests": int(unique_tests_per_patient_day.max()) if len(unique_tests_per_patient_day) > 0 else 0
        }
        
        # Top jours avec le plus de tests uniques (globaux)
        top_days = unique_tests_by_date.sort_values(ascending=False).head(10)
        stats["top_days_unique_tests"] = [
            {
                "date": str(date),
                "unique_tests_count": int(count)
            }
            for date, count in top_days.items()
        ]
        
        return stats
    
    def _analyze_by_service(self) -> List[Dict[str, Any]]:
        """
        Analyser les panels par service (nombre2)
        """
        service_stats = []
        
        for service, group in self.df.groupby('nombre2'):
            # Grouper par patient et date
            grouped = group.groupby(['numorden', 'date'])
            tests_per_day = grouped.size()
            
            service_stats.append({
                "service": str(service),
                "total_tests": len(group),
                "total_panels": len(tests_per_day),
                "avg_tests_per_panel": float(tests_per_day.mean()),
                "unique_tests": int(group['nombre'].nunique())
            })
        
        # Trier par nombre de tests décroissant
        service_stats.sort(key=lambda x: x['total_tests'], reverse=True)
        
        return service_stats
    
    def identify_panel_templates(self, min_frequency: int = 3) -> List[Dict[str, Any]]:
        """
        Identifier les "templates" de panels (combinaisons récurrentes)
        """
        # Grouper par patient et date
        grouped = self.df.groupby(['numorden', 'date'])
        
        # Créer des tuples de tests ordonnés
        panel_combinations = grouped['nombre'].apply(lambda x: tuple(sorted(x)))
        
        # Compter les occurrences
        panel_counts = panel_combinations.value_counts()
        
        # Filtrer par fréquence minimale
        frequent_panels = panel_counts[panel_counts >= min_frequency]
        
        # Formater
        templates = []
        for panel, count in frequent_panels.items():
            templates.append({
                "template_id": hash(panel),
                "tests": list(panel),
                "test_count": len(panel),
                "frequency": int(count)
            })
        
        return templates