# ============================================================
# backend/app/services/repeat_engine.py
# ============================================================

import pandas as pd
from typing import Dict, Any, List
import numpy as np


class RepeatEngine:
    """
    Service pour analyser les tests répétés
    """
    
    def __init__(self, df: pd.DataFrame):
        self.df = df
        # Convertir les dates en datetime
        self.df['date'] = pd.to_datetime(self.df['date'])
    
    def analyze_repeats(self) -> Dict[str, Any]:
        """
        Analyse complète des tests répétés
        """
        # Grouper par patient et test
        grouped = self.df.groupby(['numorden', 'nombre'])
        
        # Compter les occurrences
        repeat_counts = grouped.size()
        
        # Identifier les tests répétés (> 1 occurrence)
        repeated_tests = repeat_counts[repeat_counts > 1]
        
        # Statistiques globales
        total_patients = self.df['numorden'].nunique()
        patients_with_repeats = repeated_tests.reset_index()['numorden'].nunique()
        
        stats = {
            "total_patients": int(total_patients),
            "patients_with_repeats": int(patients_with_repeats),
            "patients_with_repeats_pct": float(patients_with_repeats / total_patients * 100),
            "total_repeat_instances": int(len(repeated_tests)),
            "avg_repeats_per_patient": float(repeated_tests.groupby(level=0).size().mean()) if len(repeated_tests) > 0 else 0
        }
        
        # Tests les plus répétés
        most_repeated = self._get_most_repeated_tests()
        stats["most_repeated_tests"] = most_repeated
        
        # Analyse des intervalles de répétition
        interval_analysis = self._analyze_repeat_intervals()
        stats["interval_analysis"] = interval_analysis
        
        # Distribution des nombres de répétitions
        repeat_distribution = repeat_counts.value_counts().sort_index()
        stats["repeat_distribution"] = {int(k): int(v) for k, v in repeat_distribution.items()}
        
        return stats
    
    def _get_most_repeated_tests(self, top_n: int = 20) -> List[Dict[str, Any]]:
        """
        Obtenir les tests les plus fréquemment répétés
        """
        # Grouper par test et compter les patients avec répétitions
        grouped = self.df.groupby(['numorden', 'nombre']).size()
        repeated = grouped[grouped > 1]
        
        # Compter par test
        test_repeat_counts = repeated.groupby(level='nombre').size()
        top_repeated = test_repeat_counts.sort_values(ascending=False).head(top_n)
        
        result = []
        for test_name, patient_count in top_repeated.items():
            # Calculer le nombre moyen de répétitions
            test_repeats = repeated.xs(test_name, level='nombre')
            avg_repeats = test_repeats.mean()
            max_repeats = test_repeats.max()
            
            result.append({
                "test": str(test_name),
                "patients_with_repeats": int(patient_count),
                "avg_repeats_per_patient": float(avg_repeats),
                "max_repeats": int(max_repeats)
            })
        
        return result
    
    def _analyze_repeat_intervals(self) -> Dict[str, Any]:
        """
        Analyser les intervalles entre répétitions
        """
        all_intervals = []
        
        # Pour chaque patient et test
        for (patient, test), group in self.df.groupby(['numorden', 'nombre']):
            if len(group) > 1:
                dates = sorted(group['date'])
                
                # Calculer les intervalles
                for i in range(1, len(dates)):
                    delta_days = (dates[i] - dates[i-1]).days
                    all_intervals.append(delta_days)
        
        if not all_intervals:
            return {
                "total_intervals": 0,
                "avg_interval_days": None,
                "median_interval_days": None,
                "min_interval_days": None,
                "max_interval_days": None
            }
        
        intervals_series = pd.Series(all_intervals)
        
        return {
            "total_intervals": len(all_intervals),
            "avg_interval_days": float(intervals_series.mean()),
            "median_interval_days": float(intervals_series.median()),
            "min_interval_days": int(intervals_series.min()),
            "max_interval_days": int(intervals_series.max()),
            "std_interval_days": float(intervals_series.std()),
            "q25_interval_days": float(intervals_series.quantile(0.25)),
            "q75_interval_days": float(intervals_series.quantile(0.75))
        }
    
    def get_repeat_patterns(self, min_repeats: int = 3) -> List[Dict[str, Any]]:
        """
        Identifier les patterns de répétition (ex: tests mensuels, trimestriels)
        """
        patterns = []
        
        for (patient, test), group in self.df.groupby(['numorden', 'nombre']):
            if len(group) >= min_repeats:
                dates = sorted(group['date'])
                
                # Calculer les intervalles
                intervals = []
                for i in range(1, len(dates)):
                    delta_days = (dates[i] - dates[i-1]).days
                    intervals.append(delta_days)
                
                # Détecter la régularité (coefficient de variation)
                if intervals:
                    avg_interval = np.mean(intervals)
                    std_interval = np.std(intervals)
                    cv = (std_interval / avg_interval) if avg_interval > 0 else float('inf')
                    
                    # Si CV < 0.3, considérer comme régulier
                    if cv < 0.3:
                        pattern_type = self._classify_interval(avg_interval)
                        
                        patterns.append({
                            "patient": str(patient),
                            "test": str(test),
                            "repeat_count": len(group),
                            "avg_interval_days": float(avg_interval),
                            "pattern_type": pattern_type,
                            "regularity_score": float(1 - cv)  # Plus proche de 1 = plus régulier
                        })
        
        # Trier par score de régularité
        patterns.sort(key=lambda x: x['regularity_score'], reverse=True)
        
        return patterns
    
    def _classify_interval(self, days: float) -> str:
        """
        Classifier l'intervalle en pattern temporel
        """
        if days < 10:
            return "Hebdomadaire"
        elif days < 20:
            return "Bi-hebdomadaire"
        elif days < 40:
            return "Mensuel"
        elif days < 70:
            return "Bi-mensuel"
        elif days < 100:
            return "Trimestriel"
        elif days < 200:
            return "Semestriel"
        else:
            return "Annuel"