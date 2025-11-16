# backend/app/db/base.py
"""
Configuration de la base de données avec SQLAlchemy + SQLModel
"""
from sqlmodel import SQLModel, Session, create_engine
from pathlib import Path

from ..core.config import settings

# Créer le répertoire de la base de données si nécessaire
settings.DUCKDB_PATH.parent.mkdir(parents=True, exist_ok=True)

# Créer le moteur SQLAlchemy pour DuckDB
# Utilise duckdb-engine qui fournit le dialecte duckdb:// pour SQLAlchemy
# Format: duckdb:///path/to/file.duckdb
engine = create_engine(
    f"duckdb:///{settings.DUCKDB_PATH}",
    echo=False,  # Mettre à True pour voir les requêtes SQL générées
    pool_pre_ping=True,  # Vérifier la connexion avant utilisation
)


def init_db():
    """
    Initialiser la base de données en créant toutes les tables
    Cette fonction doit être appelée au démarrage de l'application
    """
    # Importer tous les modèles pour que SQLModel les enregistre
    from .models import Result, File, View
    
    # Créer toutes les tables
    SQLModel.metadata.create_all(engine)
    print("✅ Tables créées avec succès")


def get_session():
    """
    Dependency pour FastAPI - retourne une session de base de données
    Usage:
        @router.get("/endpoint")
        async def my_endpoint(session: Session = Depends(get_session)):
            results = session.exec(select(Result)).all()
            ...
    """
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
