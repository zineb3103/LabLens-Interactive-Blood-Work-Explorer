# backend/app/core/config.py
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
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

    # ========== LLM / OpenRouter ==========
    QWEN_API_KEY: str | None = None
    QWEN_BASE_URL: AnyHttpUrl | None = None
    LLM_MODEL: str = "deepseek/deepseek-r1-distill-qwen-32b"
    model: str | None = None  # Support legacy env var name

    # ========== Téléversement ==========
    MAX_FILE_SIZE: int = 50_000_000  # 50 MB par défaut

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()

