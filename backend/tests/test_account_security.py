from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.models.entities import (
    AccountToken,
    Audit,
    Conversation,
    LoginSession,
    User,
    now,
)
from app.services import email_delivery
from app.services.retention import purge
from tests.test_application import app as application_fixture
from tests.test_application import conversation, register, send

app = application_fixture


@pytest.fixture
def emails(monkeypatch):
    sent = []
    monkeypatch.setattr(email_delivery, "configured", lambda: True)
    monkeypatch.setattr(
        email_delivery,
        "send_link",
        lambda email, purpose, token: sent.append((email, purpose, token)) or True,
    )
    return sent


def guest(app):
    client = TestClient(app)
    csrf = client.get("/api/auth/session").json()["csrf"]
    client.headers.update({"Origin": "http://testserver", "X-CSRF-Token": csrf})
    return client


def test_registration_requires_verification_and_single_use_token(app, emails):
    client = guest(app)
    response = client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "name": "New", "password": "long-password-123"},
    )
    assert response.status_code == 201
    assert not response.json()["user"]["verified_user"]
    client.headers["X-CSRF-Token"] = response.json()["csrf"]
    assert client.post("/api/conversations", json={}).status_code == 403
    assert client.get("/api/files").status_code == 403
    token = emails[-1][2]
    with Session(get_engine()) as db:
        assert db.scalar(select(AccountToken)).token_hash != token
    assert client.post("/api/auth/verification/confirm", json={"token": token}).status_code == 200
    assert client.post("/api/auth/verification/confirm", json={"token": token}).status_code == 400
    assert client.get("/api/auth/session").json()["user"]["verified_user"]
    assert client.get("/api/subscription").json()["plan"] == "basic"
    assert client.post("/api/conversations", json={}).status_code == 201


def test_reset_is_generic_single_use_and_revokes_sessions(app, emails):
    first = TestClient(app)
    register(first)
    client = guest(app)
    known = client.post("/api/auth/password/request", json={"email": "user@example.com"})
    unknown = client.post("/api/auth/password/request", json={"email": "unknown@example.com"})
    assert known.json() == unknown.json()
    token = emails[-1][2]
    response = client.post(
        "/api/auth/password/reset", json={"token": token, "password": "replacement-password"}
    )
    assert response.status_code == 200
    assert first.get("/api/conversations").status_code == 401
    assert (
        client.post(
            "/api/auth/password/reset", json={"token": token, "password": "replacement-password"}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": "user@example.com", "password": "long-password-123"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "user@example.com", "password": "replacement-password"},
        ).status_code
        == 200
    )


def test_login_transfer_is_confirmed_and_revokes_previous_device(app, emails):
    first = TestClient(app)
    register(first)
    client = guest(app)
    credentials = {"email": "user@example.com", "password": "long-password-123"}
    response = client.post("/api/auth/login", json=credentials)
    assert response.status_code == 409 and "already signed in" in response.text
    assert first.get("/api/conversations").status_code == 200
    assert client.post("/api/auth/transfer/request", json=credentials).status_code == 200
    token = emails[-1][2]
    response = client.post("/api/auth/transfer/confirm", json={"token": token})
    assert response.status_code == 200
    assert first.get("/api/conversations").status_code == 401
    assert (
        client.post("/api/auth/transfer/confirm", json={"token": token}).status_code == 403
    )  # old CSRF
    with Session(get_engine()) as db:
        assert len(db.scalars(select(LoginSession)).all()) == 1


def test_expired_recovery_link_and_idle_session(app, emails):
    client = TestClient(app)
    register(client)
    client.post("/api/auth/password/request", json={"email": "user@example.com"})
    with Session(get_engine()) as db:
        token = db.scalar(select(AccountToken).where(AccountToken.purpose == "reset"))
        token.expires_at = now() - 1
        db.scalar(select(LoginSession)).last_active_at = now() - 90000
        db.commit()
    assert client.get("/api/auth/session").json()["user"] is None
    guest_client = guest(app)
    assert (
        guest_client.post(
            "/api/auth/password/reset",
            json={"token": emails[-1][2], "password": "new-long-password"},
        ).status_code
        == 400
    )


def test_profile_cannot_change_email_or_verify_itself(app):
    client = TestClient(app)
    register(client)
    assert (
        client.patch(
            "/api/auth/profile", json={"name": "New", "email": "stolen@example.com"}
        ).status_code
        == 422
    )
    assert (
        client.patch("/api/auth/profile", json={"name": "New", "verified_user": True}).status_code
        == 422
    )
    assert (
        client.patch(
            "/api/auth/profile", json={"name": "New", "timezone": "invalid/place"}
        ).status_code
        == 422
    )
    assert (
        client.patch(
            "/api/auth/profile", json={"name": "New", "bio": "Hello", "timezone": "UTC"}
        ).status_code
        == 200
    )


def test_admin_limits_subscription_and_usage_isolation(app):
    admin_client, client = TestClient(app), TestClient(app)
    admin_user = register(admin_client, "admin@example.com")
    user = register(client)
    with Session(get_engine()) as db:
        db.get(User, admin_user["id"]).role = "admin"
        db.commit()
    assert client.get("/api/admin/plans").status_code == 403
    assert (
        admin_client.patch(
            "/api/admin/plans/basic", json={"daily_requests": 0, "daily_tokens": 0}
        ).status_code
        == 200
    )
    assert send(client, conversation(client)).status_code == 429
    assert (
        admin_client.patch(
            f"/api/admin/users/{user['id']}/subscription", json={"plan": "pro"}
        ).status_code
        == 200
    )
    identifier = conversation(client)
    assert send(client, identifier).status_code == 200
    assert len(client.get("/api/usage/events").json()) == 1
    assert admin_client.get("/api/usage/events").json() == []
    client.delete(f"/api/conversations/{identifier}")
    assert len(client.get("/api/usage/events").json()) == 1
    assert (
        admin_client.patch(
            f"/api/admin/users/{user['id']}/subscription",
            json={"plan": "pro", "status": "suspended"},
        ).status_code
        == 200
    )
    assert send(client, conversation(client)).status_code == 403
    assert len(admin_client.get("/api/admin/audit").json()) > 0


def test_seats_have_separate_accounts_and_private_chats(app, emails):
    owner, member, other = TestClient(app), TestClient(app), TestClient(app)
    owner_user = register(owner, "owner@example.com")
    member_user = register(member, "member@example.com")
    register(other, "other@example.com")
    with Session(get_engine()) as db:
        db.get(User, owner_user["id"]).role = "admin"
        db.commit()
    owner.patch(f"/api/admin/users/{owner_user['id']}/subscription", json={"plan": "pro"})
    private_chat = conversation(member)
    assert (
        owner.post(
            "/api/subscription/invitations", json={"email": "member@example.com"}
        ).status_code
        == 200
    )
    token = emails[-1][2]
    assert (
        other.post("/api/subscription/invitations/accept", json={"token": token}).status_code == 400
    )
    assert (
        member.post("/api/subscription/invitations/accept", json={"token": token}).status_code
        == 200
    )
    assert (
        member.post("/api/subscription/invitations/accept", json={"token": token}).status_code
        == 400
    )
    assert owner.get(f"/api/conversations/{private_chat}/messages").status_code == 404
    assert member.get("/api/subscription/members").status_code == 403
    assert (
        owner.post("/api/subscription/invitations", json={"email": "other@example.com"}).status_code
        == 409
    )
    assert owner.delete(f"/api/subscription/members/{member_user['id']}").status_code == 204
    assert member.get("/api/subscription").json()["plan"] == "basic"
    assert member.get(f"/api/conversations/{private_chat}/messages").status_code == 200


def test_retention_hides_and_purges_expired_chat_without_usage_loss(app):
    client = TestClient(app)
    register(client)
    identifier = conversation(client)
    send(client, identifier)
    with Session(get_engine()) as db:
        db.get(Conversation, identifier).updated_at = now() - 8 * 86400
        db.commit()
    assert client.get(f"/api/conversations/{identifier}/messages").status_code == 404
    assert client.get("/api/conversations").json()["items"] == []
    with Session(get_engine()) as db:
        assert purge(db) == 1
        assert db.get(Conversation, identifier) is None
        assert db.scalar(select(Audit).where(Audit.action == "storage.retention_purged"))
    assert len(client.get("/api/usage/events").json()) == 1


def test_postgres_concurrent_logins_allow_only_one_session(app):
    if get_engine().dialect.name != "postgresql":
        pytest.skip("Row-lock concurrency is verified against PostgreSQL")
    client = TestClient(app)
    register(client)
    client.post("/api/auth/logout")
    clients = [guest(app), guest(app)]
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda c: (
                    c.post(
                        "/api/auth/login",
                        json={"email": "user@example.com", "password": "long-password-123"},
                    ).status_code
                ),
                clients,
            )
        )
    assert sorted(results) == [200, 409]
