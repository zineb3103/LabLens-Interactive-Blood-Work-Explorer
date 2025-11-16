# backend/app/db/models/file.py
from sqlmodel import SQLModel, Field, Index
from typing import Optional
from datetime import datetime


class File(SQLModel, table=True):
    """
    Modèle SQLModel pour la table files
    Représente un fichier uploadé et ingéré
    """
    __tablename__ = "files"
    
    file_id: str = Field(primary_key=True, max_length=100)
    original_filename: str = Field(max_length=500)
    row_count: int
    upload_timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="completed", max_length=50)
    
    __table_args__ = (
        Index("idx_file_id", "file_id"),
    )

