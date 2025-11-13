# backend/app/core/config.py
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Configuration de l'application"""
    
    # Répertoires
    BASE_DIR: Path = Path(__file__).resolve().parents[2]
    DATA_DIR: Path = BASE_DIR / "data"
    PARQUET_CACHE_DIR: Path = DATA_DIR / "parquet_cache"
    DUCKDB_PATH: Path = DATA_DIR / "lablens.duckdb"
    
    # API
    API_PREFIX: str = "/api"
    PROJECT_NAME: str = "LabLens"
    VERSION: str = "1.0.0"
    
    # ========== Sécurité ==========
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    DUCKDB_READONLY: bool = False
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    LOG_LEVEL: str = "INFO"
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()

