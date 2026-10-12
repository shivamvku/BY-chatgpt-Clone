from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_engine
from app.models.entities import Message, RateBucket, UsageEvent
from app.services.conversations import prepare_generation
from app.services.security import digest
from tests.test_application import conversation, register


def _is_postgres_test_database() -> bool:
    url = get_settings().database_url or ""
    return url.startswith(("postgresql://", "postgresql+psycopg://", "postgresql+psycopg2://"))


@pytest.mark.skipif(
    not _is_postgres_test_database(),
    reason="Concurrency guarantees must be exercised against PostgreSQL, not SQLite",
)
def test_global_token_reservation_is_atomic_and_rejected_request_rolls_back(app, monkeypatch):
    clients_and_contexts = []
    for email in ("quota-first@example.com", "quota-second@example.com"):
        from fastapi.testclient import TestClient

        client = TestClient(app)
        user = register(client, email)
        clients_and_contexts.append((user["id"], conversation(client)))

    settings = get_settings()
    # One normal reservation fits, but two concurrent reservations cannot both fit.
    monkeypatch.setenv("GLOBAL_DAILY_TOKEN_LIMIT", str(settings.max_output_tokens + 1200))
    get_settings.cache_clear()
    request_ids = [str(uuid4()), str(uuid4())]

    def reserve(index: int):
        user_id, conversation_id = clients_and_contexts[index]
        try:
            with Session(get_engine()) as db:
                message = prepare_generation(
                    db,
                    user_id,
                    conversation_id,
                    "Concurrent quota test",
                    None,
                    request_ids[index],
                    "gemini-flash",
                )
                return ("accepted", message.id)
        except HTTPException as exc:
            return ("rejected", exc.status_code)

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            outcomes = list(executor.map(reserve, (0, 1)))

        assert sorted(outcome[0] for outcome in outcomes) == ["accepted", "rejected"]
        rejected = next(outcome for outcome in outcomes if outcome[0] == "rejected")
        assert rejected[1] == 429

        with Session(get_engine()) as db:
            events = db.scalars(
                select(UsageEvent).where(UsageEvent.id.in_([
                    outcome[1] for outcome in outcomes if outcome[0] == "accepted"
                ]))
            ).all()
            assert len(events) == 1
            assert events[0].reserved_tokens > 0

            day_key = digest(f"global-tokens:{events[0].created_at and __import__('datetime').datetime.fromtimestamp(events[0].created_at, __import__('datetime').UTC).date().isoformat()}")
            bucket = db.get(RateBucket, day_key)
            assert bucket is not None
            assert bucket.count == events[0].reserved_tokens

            # The rejected transaction must not leave a message behind.
            accepted_ids = {outcome[1] for outcome in outcomes if outcome[0] == "accepted"}
            rows = db.scalars(
                select(Message).where(Message.request_id.in_(request_ids))
            ).all()
            assert len(rows) == 1
            assert rows[0].id in accepted_ids
    finally:
        get_settings.cache_clear()
