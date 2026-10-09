import os
import uuid
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import Base, get_engine
from app.main import create_app
from app.models.entities import LoginSession, Message, User, now
from app.services import provider


@pytest.fixture
def app(monkeypatch, tmp_path):
    test_url = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'app.db'}")
    if not test_url.startswith("sqlite") and not test_url.endswith("/younderchat_test"):
        raise RuntimeError("Integration tests require the isolated younderchat_test database")
    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SERVE_FRONTEND", "false")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://testserver")
    monkeypatch.setenv("LLM_ENDPOINT", "https://example.invalid/openai/v1")
    monkeypatch.setenv("LLM_MODEL", "test-provider")
    get_settings.cache_clear()
    get_engine.cache_clear()
    Base.metadata.create_all(get_engine())
    yield create_app()
    Base.metadata.drop_all(get_engine())
    get_engine().dispose()
    get_engine.cache_clear()
    get_settings.cache_clear()


def register(client, email="user@example.com"):
    csrf = client.get("/api/auth/session").json()["csrf"]
    client.headers.update({"Origin": "http://testserver", "X-CSRF-Token": csrf})
    response = client.post(
        "/api/auth/register",
        json={"email": email, "name": "Test User", "password": "long-password-123"},
    )
    assert response.status_code == 201, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf"]
    return response.json()["user"]


def conversation(client):
    response = client.post("/api/conversations", json={})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def send(client, identifier, request_id=None):
    return client.post(
        f"/api/conversations/{identifier}/messages",
        json={"content": "Hello", "request_id": request_id or str(uuid.uuid4())},
    )


def test_session_csrf_origin_and_revocation(app):
    client = TestClient(app)
    register(client)
    assert client.get("/api/auth/session").json()["user"]["role"] == "user"
    assert "httponly" in str(client.cookies).lower() or client.cookies.get("younderchat")
    assert (
        client.post("/api/conversations", json={}, headers={"X-CSRF-Token": "wrong"}).status_code
        == 403
    )
    assert (
        client.post(
            "/api/conversations", json={}, headers={"Origin": "https://evil.invalid"}
        ).status_code
        == 403
    )
    assert client.get("/api/admin/users").status_code == 403
    cookie = client.cookies.get("younderchat")
    assert client.delete("/api/auth/sessions").status_code == 204
    client.cookies.set("younderchat", cookie)
    assert client.get("/api/conversations").status_code == 401


def test_expired_and_disabled_sessions(app):
    client = TestClient(app)
    user = register(client)
    with Session(get_engine()) as db:
        session = db.scalar(select(LoginSession))
        session.expires_at = now() - 1
        db.commit()
    assert client.get("/api/conversations").status_code == 401
    with Session(get_engine()) as db:
        db.get(User, user["id"]).active = False
        db.commit()
    client.get("/api/auth/session")
    assert client.get("/api/conversations").status_code == 401


def test_cross_user_conversation_isolation(app):
    first, second = TestClient(app), TestClient(app)
    register(first)
    identifier = conversation(first)
    register(second, "other@example.com")
    assert second.get(f"/api/conversations/{identifier}/messages").status_code == 404
    assert (
        second.patch(f"/api/conversations/{identifier}", json={"title": "stolen"}).status_code
        == 404
    )
    assert second.delete(f"/api/conversations/{identifier}").status_code == 404
    assert second.get(f"/api/conversations/{identifier}/export").status_code == 404
    assert send(second, identifier).status_code == 404


def test_stream_persistence_idempotency_and_branches(app, monkeypatch):
    async def fake(messages):
        assert messages[-1]["content"] == "Hello"
        yield "A real "
        yield "test fixture"

    monkeypatch.setattr(provider, "stream_completion", fake)
    client = TestClient(app)
    register(client)
    identifier = conversation(client)
    key = str(uuid.uuid4())
    answer = send(client, identifier, key).json()
    assert send(client, identifier, key).json()["id"] == answer["id"]
    response = client.post(f"/api/generations/{answer['id']}/stream")
    assert '"status": "complete"' in response.text
    rows = client.get(f"/api/conversations/{identifier}/messages").json()
    assistant = next(row for row in rows if row["id"] == answer["id"])
    assert assistant["content"] == "A real test fixture"
    assert assistant["status"] == "complete"
    assert client.post(f"/api/generations/{answer['id']}/stream").status_code == 409
    new = client.post(
        f"/api/conversations/{identifier}/messages/{answer['id']}/regenerate",
        json={"request_id": str(uuid.uuid4())},
    ).json()
    assert new["parent_id"] == assistant["parent_id"]
    assert client.post(f"/api/generations/{new['id']}/stop").status_code == 204
    assert client.post(f"/api/generations/{new['id']}/stream").status_code == 409


def test_provider_failure_does_not_complete_partial_output(app, monkeypatch):
    async def failing(messages):
        yield "partial"
        raise RuntimeError("secret upstream diagnostic")

    monkeypatch.setattr(provider, "stream_completion", failing)
    client = TestClient(app)
    register(client)
    identifier = conversation(client)
    answer = send(client, identifier).json()
    response = client.post(f"/api/generations/{answer['id']}/stream")
    assert "event: error" in response.text
    assert "secret upstream" not in response.text
    with Session(get_engine()) as db:
        row = db.get(Message, answer["id"])
        assert row.status == "failed" and row.content == "partial"


def test_quota_provider_disabled_and_archive(app, monkeypatch):
    client = TestClient(app)
    register(client)
    identifier = conversation(client)
    monkeypatch.setenv("DAILY_REQUESTS", "0")
    get_settings.cache_clear()
    assert send(client, identifier).status_code == 429
    assert client.get(f"/api/conversations/{identifier}/messages").json() == []
    monkeypatch.setenv("LLM_ENDPOINT", "")
    get_settings.cache_clear()
    assert send(client, identifier).status_code == 503
    assert not client.get("/api/models").json()["configured"]


def test_private_image_validation_and_isolation(app):
    first, second = TestClient(app), TestClient(app)
    register(first)
    assert first.post("/api/files", content=b"not an image").status_code == 415
    output = BytesIO()
    Image.new("RGB", (4, 4)).save(output, "PNG")
    response = first.post("/api/files", content=output.getvalue())
    assert response.status_code == 201
    path = response.json()["url"]
    assert first.get(path).headers["content-type"] == "image/jpeg"
    register(second, "other@example.com")
    assert second.get(path).status_code == 404
    assert second.delete(path).status_code == 404


def test_admin_enforcement_and_session_revocation(app):
    first, second = TestClient(app), TestClient(app)
    owner = register(first)
    target = register(second, "other@example.com")
    with Session(get_engine()) as db:
        db.get(User, owner["id"]).role = "admin"
        db.commit()
    assert first.get("/api/admin/users").status_code == 200
    assert (
        first.patch(
            f"/api/admin/users/{owner['id']}", json={"role": "user", "active": True}
        ).status_code
        == 400
    )
    assert (
        first.patch(
            f"/api/admin/users/{target['id']}", json={"role": "user", "active": False}
        ).status_code
        == 200
    )
    assert second.get("/api/conversations").status_code == 401


def test_login_throttling(app):
    client = TestClient(app)
    csrf = client.get("/api/auth/session").json()["csrf"]
    client.headers.update({"Origin": "http://testserver", "X-CSRF-Token": csrf})
    for _ in range(10):
        assert (
            client.post(
                "/api/auth/login",
                json={"email": "missing@example.com", "password": "wrong-password"},
            ).status_code
            == 401
        )
    assert (
        client.post(
            "/api/auth/login", json={"email": "missing@example.com", "password": "wrong-password"}
        ).status_code
        == 429
    )


def test_global_quota_is_transactional(app, monkeypatch):
    client = TestClient(app)
    register(client)
    identifier = conversation(client)
    monkeypatch.setenv("GLOBAL_DAILY_TOKEN_LIMIT", "0")
    get_settings.cache_clear()
    assert send(client, identifier).status_code == 429
    assert client.get(f"/api/conversations/{identifier}/messages").json() == []
    assert client.get("/api/usage").json()["requests"] == 0


def test_stop_cancels_a_silent_upstream(app, monkeypatch):
    import asyncio

    from app.services.generation import claim, events

    async def silent(messages):
        await asyncio.sleep(60)
        yield "should never be emitted"

    class Connected:
        async def is_disconnected(self):
            return False

    monkeypatch.setattr(provider, "stream_completion", silent)
    client = TestClient(app)
    user = register(client)
    answer = send(client, conversation(client)).json()
    context = claim(user["id"], answer["id"])

    async def exercise():
        stream = events(answer["id"], context, Connected())
        await anext(stream)
        waiting = asyncio.create_task(anext(stream))
        await asyncio.sleep(0.05)
        assert client.post(f"/api/generations/{answer['id']}/stop").status_code == 204
        result = await asyncio.wait_for(waiting, timeout=2)
        assert '"status": "stopped"' in result
        await stream.aclose()

    asyncio.run(exercise())
    with Session(get_engine()) as db:
        assert db.get(Message, answer["id"]).status == "stopped"


def test_asgi_cancel_scope_preserves_final_state(app, monkeypatch):
    import asyncio

    import anyio

    from app.services.generation import claim, events

    async def silent(messages):
        await asyncio.sleep(60)
        yield "unreachable"

    class Connected:
        async def is_disconnected(self):
            return False

    monkeypatch.setattr(provider, "stream_completion", silent)
    client = TestClient(app)
    user = register(client)
    answer = send(client, conversation(client)).json()
    context = claim(user["id"], answer["id"])

    async def exercise():
        started = anyio.Event()

        async def consume():
            async for event in events(answer["id"], context, Connected()):
                started.set()

        async with anyio.create_task_group() as group:
            group.start_soon(consume)
            await started.wait()
            await anyio.sleep(0.05)
            group.cancel_scope.cancel()

    anyio.run(exercise)
    with Session(get_engine()) as db:
        assert db.get(Message, answer["id"]).status == "stopped"


def test_production_cookie_attributes(app, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://testserver")
    get_settings.cache_clear()
    client = TestClient(create_app(), base_url="https://testserver")
    csrf = client.get("/api/auth/session").json()["csrf"]
    client.headers.update({"Origin": "https://testserver", "X-CSRF-Token": csrf})
    response = client.post(
        "/api/auth/register",
        json={
            "email": "secure@example.com",
            "name": "Secure User",
            "password": "secure-password-123",
        },
    )
    assert response.status_code == 201
    cookie = next(
        value
        for value in response.headers.get_list("set-cookie")
        if value.startswith("__Host-younderchat=")
    )
    assert all(value in cookie for value in ["HttpOnly", "Secure", "SameSite=lax", "Path=/"])
    assert "Domain=" not in cookie
    assert client.get("/api/docs").status_code == 404
