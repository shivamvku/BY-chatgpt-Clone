from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.models.entities import Message
from app.services.conversations import branch
from tests.test_application import app as application_fixture
from tests.test_application import conversation, register

app = application_fixture


def test_branch_rejects_missing_and_cross_conversation_parents(app):
    client = TestClient(app)
    register(client)
    conversation_id = conversation(client)
    other_conversation_id = conversation(client)

    with Session(get_engine()) as db:
        with pytest.raises(HTTPException) as missing:
            branch(db, conversation_id, str(uuid4()))
        assert missing.value.detail == "Invalid message parent"

        foreign = Message(
            conversation_id=other_conversation_id,
            parent_id=None,
            role="user",
            ordinal=1,
            content="foreign conversation",
            status="complete",
        )
        db.add(foreign)
        db.commit()
        foreign_id = foreign.id

        with pytest.raises(HTTPException) as cross_conversation:
            branch(db, conversation_id, foreign_id)
        assert cross_conversation.value.detail == "Invalid message parent"


def test_branch_rejects_parent_cycles(app):
    client = TestClient(app)
    register(client)
    conversation_id = conversation(client)
    first_id, second_id = str(uuid4()), str(uuid4())

    with Session(get_engine()) as db:
        db.add_all(
            [
                Message(
                    id=first_id,
                    conversation_id=conversation_id,
                    parent_id=second_id,
                    role="user",
                    ordinal=1,
                    content="first",
                    status="complete",
                ),
                Message(
                    id=second_id,
                    conversation_id=conversation_id,
                    parent_id=first_id,
                    role="assistant",
                    ordinal=2,
                    content="second",
                    status="complete",
                ),
            ]
        )
        db.commit()
        with pytest.raises(HTTPException) as cycle:
            branch(db, conversation_id, first_id)
        assert cycle.value.detail == "Conversation branch is too long"


def test_message_ordinal_conflicts_are_rejected_by_database(app):
    client = TestClient(app)
    register(client)
    conversation_id = conversation(client)

    with Session(get_engine()) as db:
        db.add(
            Message(
                conversation_id=conversation_id,
                parent_id=None,
                role="user",
                ordinal=1,
                content="first",
                status="complete",
            )
        )
        db.commit()
        db.add(
            Message(
                conversation_id=conversation_id,
                parent_id=None,
                role="user",
                ordinal=1,
                content="duplicate ordinal",
                status="complete",
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
