# backend/app/db/session.py
"""
Dépendances FastAPI pour les sessions de base de données
"""
from .base import get_session

# Réexporter pour compatibilité
__all__ = ["get_session"]

