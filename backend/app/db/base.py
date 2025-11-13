# backend/app/db/base.py
import duckdb
from pathlib import Path
from ..core.config import settings

class DuckDBConnection:
    """
    Gestionnaire de connexion DuckDB singleton
    """
    _instance = None
    _conn = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._conn is None:
            db_path = settings.DUCKDB_PATH
            db_path.parent.mkdir(parents=True, exist_ok=True)
            self._conn = duckdb.connect(str(db_path))
            self._initialize_schema()
    
    def _initialize_schema(self):
        """Créer les tables si elles n'existent pas"""
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY,
                file_id VARCHAR,
                numorden VARCHAR,
                sexo VARCHAR,
                edad INTEGER,
                nombre VARCHAR,
                textores VARCHAR,
                nombre2 VARCHAR,
                date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS files (
                file_id VARCHAR PRIMARY KEY,
                original_filename VARCHAR,
                row_count INTEGER,
                upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR
            )
        """)
        
        # Index pour améliorer les performances
        self._conn.execute("CREATE INDEX IF NOT EXISTS idx_numorden ON results(numorden)")
        self._conn.execute("CREATE INDEX IF NOT EXISTS idx_nombre ON results(nombre)")
        self._conn.execute("CREATE INDEX IF NOT EXISTS idx_nombre2 ON results(nombre2)")
        self._conn.execute("CREATE INDEX IF NOT EXISTS idx_date ON results(date)")
        self._conn.execute("CREATE INDEX IF NOT EXISTS idx_file_id ON results(file_id)")
    
    def get_connection(self):
        return self._conn
    
    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

# Instance globale
db = DuckDBConnection()
