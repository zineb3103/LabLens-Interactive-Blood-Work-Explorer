# backend/app/db/models/view.py
from sqlmodel import SQLModel, Field, Index, Column
from typing import Optional
from datetime import datetime
from sqlalchemy import Text


class View(SQLModel, table=True):
    """
    Modèle SQLModel pour la table views
    Représente une vue/cohorte sauvegardée
    """
    __tablename__ = "views"
    
    view_id: str = Field(primary_key=True, max_length=100)
    name: str = Field(max_length=200)
    file_id: str = Field(max_length=100, index=True)
    filters: str = Field(sa_column=Column(Text))  # JSON string
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_view_id", "view_id"),
        Index("idx_file_id", "file_id"),
    )

