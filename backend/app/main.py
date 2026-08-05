from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from app.settings import get_settings


def create_app() -> FastAPI:
    import os
    os.environ["ANTIGRAVITY_FORCE_FALLBACK"] = "true"
    settings = get_settings()

    app = FastAPI(
        title="MidSphere",
        description="Autonomous Context Command & Circuit-Breaker Engine",
        version="0.1.0",
    )
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix="/v1")
    return app


app = create_app()
