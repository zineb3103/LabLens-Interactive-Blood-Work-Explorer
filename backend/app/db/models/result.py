# backend/app/db/models/result.py
from sqlmodel import SQLModel, Field, Index, Column
from typing import Optional
from datetime import date as date_type, datetime
from sqlalchemy import Date


class Result(SQLModel, table=True):
    """
    Modèle SQLModel pour la table results
    Représente un résultat de laboratoire
    """
    __tablename__ = "results"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    file_id: str = Field(index=True, max_length=100)
    numorden: str = Field(index=True, max_length=100)
    sexo: str = Field(max_length=10)
    edad: int
    nombre: str = Field(index=True, max_length=200)
    textores: str = Field(max_length=500)
    nombre2: str = Field(index=True, max_length=200)
    date: date_type = Field(sa_column=Column(Date, index=True))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Index composites pour améliorer les performances
    __table_args__ = (
        Index("idx_numorden", "numorden"),
        Index("idx_nombre", "nombre"),
        Index("idx_nombre2", "nombre2"),
        Index("idx_date", "date"),
        Index("idx_file_id", "file_id"),
    )

