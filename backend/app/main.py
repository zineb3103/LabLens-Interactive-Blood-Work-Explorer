# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pathlib import Path

from .api import ingest, subset, stats, panels, repeats, coorder, views, llm
from .db.base import init_db
from .core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestionnaire du cycle de vie de l'application
    Exécuté au démarrage et à l'arrêt du serveur
    """
    # ========== STARTUP ==========
    print("🚀 Démarrage de LabLens API...")
    
    # Créer les répertoires nécessaires
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.PARQUET_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"✅ Répertoires créés: {settings.DATA_DIR}")
    
    # Initialiser la base de données avec SQLModel
    try:
        init_db()
        print("✅ Base de données initialisée et prête")
    except Exception as e:
        print(f"⚠️ Erreur base de données: {e}")
    
    print("✅ LabLens API prête!\n")
    
    yield  # L'application s'exécute ici
    
    # ========== SHUTDOWN ==========
    print("\n🛑 Arrêt de LabLens API...")
    
    # Fermer proprement la connexion à la base de données
    try:
        # SQLModel/SQLAlchemy gère automatiquement la fermeture
        print("✅ Base de données fermée proprement")
    except Exception as e:
        print(f"⚠️ Erreur lors de la fermeture: {e}")
    
    print("👋 LabLens API arrêtée")


# Créer l'application FastAPI avec le gestionnaire de cycle de vie
app = FastAPI(
    title="LabLens API",
    description="API pour l'analyse interactive de données de laboratoire",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",  # Au cas où le port change
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclure tous les routers
app.include_router(ingest.router, prefix="/api", tags=["Ingestion"])
app.include_router(subset.router, prefix="/api", tags=["Subset & Filtering"])
app.include_router(stats.router, prefix="/api", tags=["Statistics"])
app.include_router(panels.router, prefix="/api", tags=["Panels"])
app.include_router(repeats.router, prefix="/api", tags=["Repeats"])
app.include_router(coorder.router, prefix="/api", tags=["Co-Ordering"])
app.include_router(views.router, prefix="/api", tags=["Views & Cohorts"])
app.include_router(llm.router, prefix="/api", tags=["AI Assistant"])


@app.get("/", tags=["Root"])
async def root():
    """
    Point d'entrée de l'API
    """
    return {
        "message": "LabLens API - Interactive Blood-Work Explorer",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "endpoints": {
            # Ingestion
            "upload": "POST /api/ingest",
            "get_file": "GET /api/files/{file_id}",
            "get_file_data": "GET /api/files/{file_id}/data",
            "list_files": "GET /api/files",
            "delete_file": "DELETE /api/files/{file_id}",
            
            # Filtering
            "subset_manual": "POST /api/subset/manual",
            "subset_sql": "POST /api/subset/sql",
            "preview_sql": "POST /api/subset/preview",
            "export_data": "GET /api/subset/export?file_id={file_id}&format=csv|xlsx&filters={json}",
            
            # Statistics
            "stats_summary": "POST /api/stats/summary",
            "column_stats": "GET /api/stats/{file_id}/column/{column_name}",
            "missing_summary": "GET /api/stats/{file_id}/missing",
            
            # Panels
            "analyze_panels": "GET /api/panels/{file_id}",
            "patient_panels": "GET /api/panels/{file_id}/patient/{numorden}",
            "top_panels": "GET /api/panels/{file_id}/top",
            
            # Repeats
            "analyze_repeats": "GET /api/repeats/{file_id}",
            "test_repeats": "GET /api/repeats/{file_id}/test/{test_name}",
            "patient_repeats": "GET /api/repeats/{file_id}/patient/{numorden}",
            
            # Co-Ordering
            "analyze_coorder": "GET /api/coorder/{file_id}",
            "coorder_matrix": "GET /api/coorder/{file_id}/matrix",
            "coorder_by_service": "GET /api/coorder/{file_id}/service/{service_name}",
            
            # Views
            "create_view": "POST /api/views",
            "list_views": "GET /api/views",
            "get_view": "GET /api/views/{view_id}",
            "update_view": "PUT /api/views/{view_id}",
            "delete_view": "DELETE /api/views/{view_id}",
            "apply_view": "POST /api/views/{view_id}/apply",
            "share_view": "GET /api/views/{view_id}/share",
            
            # AI Assistant
            "llm_query": "POST /api/llm/query",
            
            "health": "GET /health"
        }
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Vérifier l'état de santé de l'API et de ses composants
    """
    health_status = {
        "status": "healthy",
        "api_version": "1.0.0",
        "components": {}
    }
    
    # Tester la base de données
    try:
        from sqlmodel import Session, select, func
        from .db.base import engine
        from .db.models import File, Result, View
        
        with Session(engine) as session:
            # Compter les fichiers et résultats
            files_count = session.exec(select(func.count(File.file_id))).one()
            results_count = session.exec(select(func.count(Result.id))).one()
            
            # Compter les vues
            try:
                views_count = session.exec(select(func.count(View.view_id))).one()
            except:
                views_count = 0
            
            health_status["components"]["database"] = {
                "status": "healthy",
                "files": files_count,
                "results": results_count,
                "views": views_count
            }
    except Exception as e:
        health_status["components"]["database"] = {
            "status": "error",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    # Vérifier le cache Parquet
    try:
        parquet_files = list(settings.PARQUET_CACHE_DIR.glob("*.parquet"))
        health_status["components"]["parquet_cache"] = {
            "status": "healthy",
            "path": str(settings.PARQUET_CACHE_DIR),
            "files_count": len(parquet_files)
        }
    except Exception as e:
        health_status["components"]["parquet_cache"] = {
            "status": "error",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    return health_status


