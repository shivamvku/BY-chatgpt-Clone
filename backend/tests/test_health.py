from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


def test_liveness_and_unknown_api(monkeypatch):
    monkeypatch.setenv("SERVE_FRONTEND", "false")
    get_settings.cache_clear()
    client = TestClient(create_app())
    assert client.get("/api/health/live").json() == {"status": "ok"}
    assert client.get("/api/missing").status_code == 404


def test_readiness_requires_database(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("SERVE_FRONTEND", "false")
    get_settings.cache_clear()
    client = TestClient(create_app())
    assert client.get("/api/health/ready").status_code == 503


def test_spa_routes_do_not_mask_missing_api_or_assets(monkeypatch, tmp_path):
    (tmp_path / "index.html").write_text("<html>BY Chat</html>")
    monkeypatch.setenv("SERVE_FRONTEND", "true")
    monkeypatch.setenv("FRONTEND_DIRECTORY", str(tmp_path))
    get_settings.cache_clear()
    client = TestClient(create_app())
    assert client.get("/conversations/example").text == "<html>BY Chat</html>"
    assert client.get("/assets/missing.js").status_code == 404
    assert client.get("/api/missing").status_code == 404
    get_settings.cache_clear()
