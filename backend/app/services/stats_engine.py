# ============================================================
# backend/app/services/stats_engine.py
# ============================================================

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional


class StatsEngine:
    """
    Service pour calculer les statistiques descriptives
    """
    
    def __init__(self, df: pd.DataFrame):
        self.df = df
    
    def compute_full_summary(self, columns: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Calculer un résumé complet des statistiques
        """
        if columns is None:
            # Exclure les colonnes système
            columns = [col for col in self.df.columns 
                      if col not in ['id', 'file_id', 'created_at']]
        
        summary = {
            "overview": self._compute_overview(),
            "numeric_stats": {},
            "categorical_stats": {},
            "missing_summary": self._compute_missing_summary()
        }
        
        for col in columns:
            if col not in self.df.columns:
                continue
            
            column_data = self.df[col]
            
            if pd.api.types.is_numeric_dtype(column_data):
                summary["numeric_stats"][col] = self._compute_numeric_stats(column_data)
            else:
                summary["categorical_stats"][col] = self._compute_categorical_stats(column_data)
        
        return summary
    
    def _compute_overview(self) -> Dict[str, Any]:
        """Vue d'ensemble des données"""
        return {
            "total_rows": len(self.df),
            "total_columns": len(self.df.columns),
            "memory_usage_mb": float(self.df.memory_usage(deep=True).sum() / 1024 / 1024)
        }
    
    def _compute_numeric_stats(self, series: pd.Series) -> Dict[str, Any]:
        """Statistiques pour colonnes numériques"""
        return {
            "count": int(series.count()),
            "missing": int(series.isna().sum()),
            "missing_pct": float(series.isna().sum() / len(series) * 100),
            "mean": float(series.mean()) if series.count() > 0 else None,
            "std": float(series.std()) if series.count() > 0 else None,
            "min": float(series.min()) if series.count() > 0 else None,
            "max": float(series.max()) if series.count() > 0 else None,
            "median": float(series.median()) if series.count() > 0 else None,
            "q25": float(series.quantile(0.25)) if series.count() > 0 else None,
            "q75": float(series.quantile(0.75)) if series.count() > 0 else None,
            "skew": float(series.skew()) if series.count() > 2 else None,
            "kurtosis": float(series.kurtosis()) if series.count() > 3 else None
        }
    
    def _compute_categorical_stats(self, series: pd.Series) -> Dict[str, Any]:
        """Statistiques pour colonnes catégorielles"""
        value_counts = series.value_counts()
        
        stats = {
            "count": int(series.count()),
            "missing": int(series.isna().sum()),
            "missing_pct": float(series.isna().sum() / len(series) * 100),
            "unique": int(series.nunique()),
            "top_value": str(value_counts.index[0]) if len(value_counts) > 0 else None,
            "top_freq": int(value_counts.iloc[0]) if len(value_counts) > 0 else 0,
            "top_freq_pct": float(value_counts.iloc[0] / series.count() * 100) if series.count() > 0 else 0,
            "distribution": {str(k): int(v) for k, v in value_counts.head(10).items()}
        }
        
        # Traitement spécial pour textores (valeurs mixtes numériques/textuelles)
        if series.name == 'textores':
            stats["qualitative_rates"] = self._compute_textores_qualitative_rates(series)
        
        return stats
    
    def _compute_textores_qualitative_rates(self, series: pd.Series) -> Dict[str, Any]:
        """
        Calculer les taux qualitatifs pour textores (détecter valeurs numériques vs textuelles)
        """
        # Détecter les valeurs numériques
        numeric_mask = series.astype(str).str.strip().str.match(r'^-?\d+\.?\d*$', na=False)
        numeric_count = numeric_mask.sum()
        text_count = (~numeric_mask & series.notna()).sum()
        total_valid = series.notna().sum()
        
        rates = {
            "numeric_count": int(numeric_count),
            "text_count": int(text_count),
            "numeric_rate": float(numeric_count / total_valid * 100) if total_valid > 0 else 0,
            "text_rate": float(text_count / total_valid * 100) if total_valid > 0 else 0,
            "mixed_type": numeric_count > 0 and text_count > 0
        }
        
        # Si valeurs numériques présentes, calculer des stats numériques
        if numeric_count > 0:
            numeric_values = pd.to_numeric(series[numeric_mask], errors='coerce')
            numeric_values = numeric_values.dropna()
            if len(numeric_values) > 0:
                rates["numeric_stats"] = {
                    "mean": float(numeric_values.mean()),
                    "std": float(numeric_values.std()),
                    "min": float(numeric_values.min()),
                    "max": float(numeric_values.max()),
                    "median": float(numeric_values.median())
                }
        
        # Statistiques sur les valeurs textuelles
        if text_count > 0:
            text_values = series[~numeric_mask & series.notna()]
            text_value_counts = text_values.value_counts()
            rates["text_stats"] = {
                "unique_text_values": int(text_values.nunique()),
                "top_text_values": {str(k): int(v) for k, v in text_value_counts.head(10).items()}
            }
        
        return rates
    
    def _compute_missing_summary(self) -> List[Dict[str, Any]]:
        """Résumé des valeurs manquantes"""
        missing_stats = []
        
        for col in self.df.columns:
            if col not in ['id', 'file_id', 'created_at']:
                missing_count = self.df[col].isna().sum()
                missing_pct = (missing_count / len(self.df)) * 100
                
                if missing_count > 0:  # Ne garder que les colonnes avec des valeurs manquantes
                    missing_stats.append({
                        "column": col,
                        "missing_count": int(missing_count),
                        "missing_pct": float(missing_pct)
                    })
        
        # Trier par pourcentage décroissant
        missing_stats.sort(key=lambda x: x['missing_pct'], reverse=True)
        
        return missing_stats