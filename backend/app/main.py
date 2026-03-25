"""
RedirectMaster AI — FastAPI Application Factory
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes import parse, rules, match, export

app = FastAPI(
    title="RedirectMaster AI",
    description="Production-grade SEO URL redirect mapping engine",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS Middleware ──────────────────────────────────────────────────────────
origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Error Handler ─────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred",
            "detail": str(exc),
        },
    )


# ── Routes ───────────────────────────────────────────────────────────────────
app.include_router(parse.router, prefix="/api", tags=["parse"])
app.include_router(rules.router, prefix="/api", tags=["rules"])
app.include_router(match.router, prefix="/api", tags=["match"])
app.include_router(export.router, prefix="/api", tags=["export"])


# ── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}
