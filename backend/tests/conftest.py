import os

import pytest

from app.core.config import get_settings
from app.db.session import Base, get_engine
from app.main import create_app


@pytest.fixture
def app(monkeypatch, tmp_path):
    test_url = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'app.db'}")
    if not test_url.startswith("sqlite") and not test_url.endswith("/younderchat_test"):
        raise RuntimeError("Integration tests require the isolated younderchat_test database")
    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SERVE_FRONTEND", "false")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://testserver")
    monkeypatch.setenv("GEMINI_API_KEY", "test-provider-key")
    monkeypatch.setenv("GROQ_API_KEY", "test-groq-key")
    get_settings.cache_clear()
    get_engine.cache_clear()
    Base.metadata.create_all(get_engine())
    yield create_app()
    Base.metadata.drop_all(get_engine())
    get_engine().dispose()
    get_engine.cache_clear()
    get_settings.cache_clear()
