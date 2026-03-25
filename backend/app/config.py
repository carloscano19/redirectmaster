"""
RedirectMaster AI — Application Settings
"""
from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    auto_approve_threshold: float = 85.0
    max_urls_per_request: int = 100_000
    levenshtein_weight: float = 0.35
    cosine_weight: float = 0.40
    structural_weight: float = 0.25
    cors_origins: str = "*"
    max_upload_size_mb: int = 50


settings = Settings()
