from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "development"
    database_url: str | None = None
    serve_frontend: bool = False
    frontend_directory: Path = Path("/app/frontend/dist")


@lru_cache
def get_settings() -> Settings:
    return Settings()
