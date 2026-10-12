from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_engine
from app.models.entities import Message, RateBucket, Usage, UsageEvent, now
from app.services import provider
from app.services.conversations import reconcile_stale_generations, release_reservation
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

def test_late_persist_cannot_resurrect_reconciled_generation(app):
    client = TestClient(app)
    user = register(client)
    conversation_id = conversation(client)
    response = send(client, conversation_id)
    assert response.status_code == 200
    message_id = response.json()["id"]

    before = _usage_for_user(user["id"])
    assert before.reserved_tokens > 0

    with Session(get_engine()) as db:
        row = db.get(Message, message_id)
        original_content = row.content
        row.updated_at = now() - get_settings().generation_timeout - 61
        db.commit()

        assert reconcile_stale_generations(db, batch_size=10) == 1
        assert db.get(Message, message_id).status == "failed"

        # A duplicate release must not decrement per-user or global counters again.
        usage_before = db.scalar(select(Usage).where(Usage.user_id == user["id"]))
        reserved_before = usage_before.reserved_tokens
        buckets_before = {
            bucket.key: bucket.count for bucket in db.scalars(select(RateBucket)).all()
        }
        release_reservation(db, message_id, "failed")
        db.commit()
        db.expire_all()
        usage_after = db.scalar(select(Usage).where(Usage.user_id == user["id"]))
        buckets_after = {
            bucket.key: bucket.count for bucket in db.scalars(select(RateBucket)).all()
        }
        assert usage_after.reserved_tokens == reserved_before
        assert buckets_after == buckets_before

    # Simulate a delayed generation worker completing after the stale-job won.
    from app.services.generation import persist

    assert persist(message_id, "late provider output", "complete") is False

    with Session(get_engine()) as db:
        row = db.get(Message, message_id)
        assert row.status == "failed"
        assert row.content == original_content

    assert _usage_for_user(user["id"]).reserved_tokens == 0
    event = _event_for_message(message_id)
    assert event.status == "failed"
    assert event.reserved_tokens > 0  # Keep reservation amount for audit.



def test_late_streaming_persist_cannot_continue_completed_generation(app):
    client = TestClient(app)
    user = register(client)
    conversation_id = conversation(client)
    response = send(client, conversation_id)
    assert response.status_code == 200
    message_id = response.json()["id"]

    with Session(get_engine()) as db:
        row = db.get(Message, message_id)
        row.status = "complete"
        row.content = "authoritative completed answer"
        usage_event = db.get(UsageEvent, message_id)
        usage_event.status = "complete"
        db.commit()

    # A delayed periodic save must not be reported as active after completion.
    from app.services.generation import persist

    assert persist(message_id, "late streaming overwrite", "streaming") is False

    with Session(get_engine()) as db:
        row = db.get(Message, message_id)
        assert row.status == "complete"
        assert row.content == "authoritative completed answer"
        assert db.get(UsageEvent, message_id).status == "complete"
