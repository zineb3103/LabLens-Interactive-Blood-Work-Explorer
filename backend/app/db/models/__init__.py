# backend/app/db/models/__init__.py
"""
Modèles SQLModel pour LabLens
"""
from .result import Result
from .file import File
from .view import View

__all__ = ["Result", "File", "View"]

