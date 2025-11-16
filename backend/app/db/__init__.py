# backend/app/db/__init__.py
"""
Module de gestion de base de données avec SQLModel + SQLAlchemy
"""

from .base import engine, init_db, get_session
from .models import Result, File, View

__all__ = ["engine", "init_db", "get_session", "Result", "File", "View"]