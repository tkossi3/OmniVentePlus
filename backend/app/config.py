"""Configuration centralisée, lue depuis les variables d'environnement (.env)."""
from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://omnivente:change_me_2026@localhost:5432/omnivente_db"

    app_env: str = "development"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Motif d'origines supplémentaire pour un environnement local particulier.
    cors_origin_regex: str | None = None

    jwt_secret: str = "change-this-secret-before-deploying"
    admin_email: str | None = None
    s3_bucket: str | None = None
    s3_region: str = "us-east-1"
    s3_endpoint_url: str | None = None
    s3_public_base_url: str | None = None
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None

    @model_validator(mode="after")
    def require_production_secret(self):
        if self.app_env == "production" and (
            self.jwt_secret == "change-this-secret-before-deploying"
            or len(self.jwt_secret) < 32
        ):
            raise ValueError("JWT_SECRET doit contenir au moins 32 caractères en production.")
        return self

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        """Accepte les formats PostgreSQL courants utilisés en local."""
        if value.startswith("postgres://"):
            return "postgresql+psycopg2://" + value[len("postgres://"):]
        if value.startswith("postgresql://") and "+psycopg2" not in value:
            return "postgresql+psycopg2://" + value[len("postgresql://"):]
        return value

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
