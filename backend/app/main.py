"""
AICTE Integrated Complaint Monitoring Dashboard - FastAPI main application.
SIH 2026, Problem Statement SIH26264.

All demo data is SYNTHETIC and does not represent official AICTE statistics.
"""

import sys
import os

# Ensure UTF-8 output on Windows (cp1252) and other non-UTF platforms
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


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
# Allow all Vercel deployments (production & branch previews), Render services, and localhost
_extra = os.getenv("ALLOWED_ORIGINS", "").strip()
_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:3000",
]

if _extra == "*":
    # If wildcard is requested, use regex to allow any origin while supporting credentials
    _origin_regex = r".*"
    _origins = []
else:
    if _extra:
        _origins.extend([o.strip() for o in _extra.split(",") if o.strip()])
    _origin_regex = r"^https?://([a-zA-Z0-9-]+\.)*(vercel\.app|onrender\.com)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=_origin_regex,
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
