"""FastAPI application for the OmniVente marketplace."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.marketplace_models import (  # noqa: F401 — register marketplace tables in SQLAlchemy metadata.
    MarketplaceConversation,
    MarketplaceMessage,
    MarketplaceOrder,
    MarketplaceProduct,
    ProductImage,
    User,
)
from app.routers.marketplace import router as marketplace_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s · %(levelname)s · %(message)s")

app = FastAPI(
    title="OmniVente",
    description="Marketplace local pour découvrir, vendre et commander des produits.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins or ["http://localhost:5173"],
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(marketplace_router)


@app.get("/health", tags=["Service"])
def health():
    return {
        "status": "ok",
        "environment": settings.app_env,
        "image_storage": "configured" if settings.s3_bucket else "not_configured",
        "admin_account": "configured" if settings.admin_email else "not_configured",
    }
