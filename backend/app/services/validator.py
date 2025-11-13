# backend/app/services/validator.py
import pandas as pd
from typing import List, Dict, Any
from datetime import datetime
import re

class DataValidator:
    """
    Service de validation pour les données de laboratoire
    """
    
    def __init__(self, df: pd.DataFrame, required_columns: List[str]):
        self.df = df
        self.required_columns = required_columns
        self.errors = []
        self.warnings = []
    
    def validate_all(self) -> Dict[str, Any]:
        """
        Exécute toutes les validations
        """
        self.errors = []
        self.warnings = []
        
        # 1. Vérifier les colonnes requises
        self._validate_columns()
        
        if not self.errors:
            # 2. Valider les types de données
            self._validate_data_types()
        
        return {
            'valid': len(self.errors) == 0,
            'errors': self.errors,
            'warnings': self.warnings
        }
    
    def _validate_columns(self):
        """
        Vérifie que toutes les colonnes requises sont présentes
        """
        missing_columns = set(self.required_columns) - set(self.df.columns)
        
        if missing_columns:
            self.errors.append({
                'column': ', '.join(missing_columns),
                'message': f"Colonnes manquantes: {', '.join(missing_columns)}"
            })
        
        # Vérifier les colonnes supplémentaires
        extra_columns = set(self.df.columns) - set(self.required_columns)
        if extra_columns:
            self.warnings.append({
                'message': f"Colonnes supplémentaires détectées (seront ignorées): {', '.join(extra_columns)}"
            })
    
    def _validate_data_types(self):
        """
        Valide les types de données pour chaque colonne
        """
        # Validation de 'edad' (doit être un entier ou flottant, y compris 0.0)
        if 'edad' in self.df.columns:
            try:
                # Sauvegarder la série originale pour comparaison
                edad_original = self.df['edad'].copy()
                
                # Nettoyer les chaînes vides, espaces et valeurs représentant NaN
                edad_series = self.df['edad'].astype(str).str.strip()
                edad_series = edad_series.replace(['', 'nan', 'null', 'None', 'N/A', 'n/a', 'NaN', 'NULL'], pd.NA)
                
                # Tenter de convertir en numérique (accepte les entiers et flottants, y compris 0.0)
                edad_numeric = pd.to_numeric(edad_series, errors='coerce')
                
                # Identifier les valeurs invalides : celles qui sont NaN après conversion
                # mais qui n'étaient pas déjà NaN/chaîne vide avant conversion
                # IMPORTANT: 0.0 converti en numérique donne 0.0, pas NaN
                invalid_mask = edad_numeric.isna() & edad_series.notna()
                invalid_count = invalid_mask.sum()
                
                if invalid_count > 0:
                    # Afficher quelques exemples de valeurs invalides pour debug
                    invalid_examples = edad_original[invalid_mask].head(5).tolist()
                    self.errors.append({
                        'column': 'edad',
                        'message': f"{invalid_count} valeurs non numériques détectées dans la colonne 'edad'. Exemples: {invalid_examples}"
                    })
                
                # Convertir en Int64 (nullable) pour stocker dans le DataFrame
                # Les valeurs 0.0 seront converties en 0 (entier)
                self.df['edad'] = edad_numeric.astype("Int64")
                
                # Vérifier les valeurs négatives (seulement les valeurs non-nulles)
                edad_not_null = self.df['edad'].notna()
                if edad_not_null.any() and (self.df.loc[edad_not_null, 'edad'] < 0).any():
                    self.errors.append({
                        'column': 'edad',
                        'message': "Des valeurs négatives ont été détectées dans 'edad'"
                    })
                    
            except Exception as e:
                self.errors.append({
                    'column': 'edad',
                    'message': f"Erreur lors de la validation de 'edad': {str(e)}"
                })
        
        # Validation de 'Date' (format dd/mm/yyyy)
        if 'Date' in self.df.columns:
            self._validate_dates()
        
        # Validation de 'sexo'
        if 'sexo' in self.df.columns:
            valid_sexo = ['M', 'F', 'H', 'm', 'f', 'h']
            invalid_sexo = self.df[~self.df['sexo'].isin(valid_sexo)]
            if len(invalid_sexo) > 0:
                self.warnings.append({
                    'column': 'sexo',
                    'message': f"{len(invalid_sexo)} valeurs non standard détectées dans 'sexo'"
                })
        
        # Validation de 'numorden' (ne doit pas être vide)
        if 'numorden' in self.df.columns:
            null_count = self.df['numorden'].isna().sum()
            if null_count > 0:
                self.errors.append({
                    'column': 'numorden',
                    'message': f"{null_count} valeurs manquantes dans 'numorden'"
                })
    
    def _validate_dates(self):
        """
        Valide le format des dates (dd/mm/yyyy)
        """
        try:
            # Essayer différents formats de date
            self.df['Date'] = pd.to_datetime(
                self.df['Date'], 
                format='%d/%m/%Y', 
                errors='coerce'
            )
            
            # Si le premier format échoue, essayer d'autres formats courants
            if self.df['Date'].isna().any():
                self.df['Date'] = pd.to_datetime(
                    self.df['Date'], 
                    dayfirst=True,
                    errors='coerce'
                )
            
            # Vérifier les dates invalides
            null_count = self.df['Date'].isna().sum()
            if null_count > 0:
                self.errors.append({
                    'column': 'Date',
                    'message': f"{null_count} dates invalides détectées. Format attendu: dd/mm/yyyy"
                })
            
            # Vérifier les dates futures
            future_dates = self.df[self.df['Date'] > datetime.now()]
            if len(future_dates) > 0:
                self.warnings.append({
                    'column': 'Date',
                    'message': f"{len(future_dates)} dates futures détectées"
                })
                
        except Exception as e:
            self.errors.append({
                'column': 'Date',
                'message': f"Erreur lors de la validation des dates: {str(e)}"
            })
    
    def clean_data(self) -> pd.DataFrame:
        """
        Nettoie et transforme les données après validation
        """
        cleaned_df = self.df.copy()
        
        # Ne garder que les colonnes requises
        cleaned_df = cleaned_df[self.required_columns]
        
        # Convertir 'edad' en entier
        if 'edad' in cleaned_df.columns:
            cleaned_df['edad'] = cleaned_df['edad'].astype('Int64')
        
        # Normaliser 'sexo'
        if 'sexo' in cleaned_df.columns:
            cleaned_df['sexo'] = cleaned_df['sexo'].str.upper()
            cleaned_df['sexo'] = cleaned_df['sexo'].replace({'H': 'M'})
        
        # Nettoyer les espaces
        string_columns = cleaned_df.select_dtypes(include=['object']).columns
        for col in string_columns:
            if col != 'Date':  # Ne pas toucher aux dates
                cleaned_df[col] = cleaned_df[col].str.strip()
        
        # Supprimer les lignes avec des valeurs critiques manquantes
        cleaned_df = cleaned_df.dropna(subset=['numorden', 'nombre'])
        
        return cleaned_df