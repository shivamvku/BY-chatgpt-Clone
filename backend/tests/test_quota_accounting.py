from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.models.entities import Message, Usage, UsageEvent, now
from app.services import provider
from app.services.conversations import reconcile_stale_generations
from app.core.config import get_settings
from tests.test_application import app as application_fixture
from tests.test_application import conversation, register, send

app = application_fixture


def _usage_for_user(user_id: str):
    with Session(get_engine()) as db:
        return db.scalar(select(Usage).where(Usage.user_id == user_id))


def _event_for_message(message_id: str):
    with Session(get_engine()) as db:
        return db.get(UsageEvent, message_id)


def test_stopping_pending_generation_releases_reservation(app):
    client = TestClient(app)
    user = register(client)
    conversation_id = conversation(client)
    response = send(client, conversation_id, request_id=str(uuid4()))
    assert response.status_code == 200
    message_id = response.json()["id"]

    before = _usage_for_user(user["id"])
    assert before.reserved_tokens > 0

    assert client.post(f"/api/generations/{message_id}/stop").status_code == 204

    after = _usage_for_user(user["id"])
    assert after.reserved_tokens == 0
    assert _event_for_message(message_id).status == "stopped"


def test_failed_provider_generation_releases_reservation(app, monkeypatch):
    async def failing(messages, model_id):
        yield "partial"
        raise RuntimeError("provider failure fixture")

    monkeypatch.setattr(provider, "stream_completion", failing)
    client = TestClient(app)
    user = register(client)
    conversation_id = conversation(client)
    response = send(client, conversation_id)
    assert response.status_code == 200
    message_id = response.json()["id"]
    assert _usage_for_user(user["id"]).reserved_tokens > 0

    stream = client.post(f"/api/generations/{message_id}/stream")
    assert "event: error" in stream.text

    assert _usage_for_user(user["id"]).reserved_tokens == 0
    event = _event_for_message(message_id)
    assert event.status == "failed"
    assert event.reserved_tokens > 0  # Preserve the attempted reservation for audit.



def test_stale_generation_reconciliation_releases_reservation(app):
    client = TestClient(app)
    user = register(client)
    conversation_id = conversation(client)
    response = send(client, conversation_id)
    assert response.status_code == 200
    message_id = response.json()["id"]
    assert _usage_for_user(user["id"]).reserved_tokens > 0

    with Session(get_engine()) as db:
        row = db.get(Message, message_id)
        row.updated_at = now() - get_settings().generation_timeout - 61
        db.commit()
        assert reconcile_stale_generations(db, batch_size=10) == 1
        assert db.get(Message, message_id).status == "failed"

    assert _usage_for_user(user["id"]).reserved_tokens == 0
    assert _event_for_message(message_id).status == "failed"
