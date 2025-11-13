# backend/app/db/__init__.py
"""
Module de gestion de base de données (DuckDB)
"""

from .base import db, DuckDBConnection

__all__ = ["db", "DuckDBConnection"]