from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import health, components, workflows, runs, portal
from app.db.init_db import init_db

init_db()

app = FastAPI(title="AI Orchestrator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(components.router)
app.include_router(workflows.router)
app.include_router(runs.router)
app.include_router(portal.router)