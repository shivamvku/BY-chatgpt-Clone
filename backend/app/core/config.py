from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "development"
    database_url: str | None = None
    serve_frontend: bool = False
    frontend_directory: Path = Path("/app/frontend/dist")
    allowed_origins: str = "http://localhost:5173,http://localhost:8000"
    session_days: int = Field(7, ge=1, le=30)
    session_idle_hours: int = Field(24, ge=1, le=168)
    public_url: str = "http://localhost:8005"
    resend_api_key: str = ""
    email_from: str = ""
    llm_endpoint: str = ""
    llm_model: str = ""
    llm_api_key: str = ""
    azure_client_id: str | None = None
    daily_requests: int = Field(30, ge=0, le=1000)
    daily_token_limit: int = Field(40000, ge=0, le=1000000)
    global_daily_token_limit: int = Field(100000, ge=0, le=1000000)
    max_output_tokens: int = Field(1024, ge=64, le=4096)
    max_context_chars: int = Field(24000, ge=1000, le=48000)
    generation_timeout: int = Field(120, ge=10, le=300)

    @property
    def secure_cookies(self) -> bool:
        return self.app_env == "production"

    @property
    def session_cookie(self) -> str:
        return "__Host-younderchat" if self.secure_cookies else "younderchat"


@lru_cache
def get_settings() -> Settings:
    return Settings()
