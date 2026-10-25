"""
AICTE Integrated Complaint Monitoring Dashboard - FastAPI main application.
SIH 2026, Problem Statement SIH26264.

⚠️  ALL DEMO DATA IS SYNTHETIC AND DOES NOT REPRESENT OFFICIAL AICTE STATISTICS.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, SessionLocal, Base
from .models import *  # ensure all models are registered before create_all
from .routers import auth, cases, institutions, dashboard, overlaps, notifications, reports, settings
from .seed import seed_database

# Create all tables
Base.metadata.create_all(bind=engine)

# Seed demo data on startup
with SessionLocal() as db:
    seed_database(db)

app = FastAPI(
    title="AICTE Complaint Monitoring Dashboard",
    description="SIH 2026 – Prototype. All data is SYNTHETIC demo data.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
prefix = "/api"
app.include_router(auth.router,          prefix=prefix)
app.include_router(dashboard.router,     prefix=prefix)
app.include_router(cases.router,         prefix=prefix)
app.include_router(institutions.router,  prefix=prefix)
app.include_router(overlaps.router,      prefix=prefix)
app.include_router(notifications.router, prefix=prefix)
app.include_router(reports.router,       prefix=prefix)
app.include_router(settings.router,      prefix=prefix)


@app.get("/api/health")
async def health():
    return {"status": "ok", "note": "All data is synthetic demo data for SIH 2026 prototype."}
