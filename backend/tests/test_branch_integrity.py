from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.models.entities import Message
from app.services.conversations import branch
from tests.test_application import app as application_fixture
from tests.test_application import conversation, register

app = application_fixture


def test_branch_rejects_missing_and_cross_conversation_parents(app):
    client = __import__("fastapi.testclient", fromlist=["TestClient"]).TestClient(app)
    register(client)
    conversation_id = conversation(client)
    other_conversation_id = conversation(client)

    with Session(get_engine()) as db:
        with pytest.raises(HTTPException, match="Invalid message parent"):
            branch(db, conversation_id, str(uuid4()))

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

        with pytest.raises(HTTPException, match="Invalid message parent"):
            branch(db, conversation_id, foreign_id)


def test_branch_rejects_parent_cycles(app):
    from fastapi.testclient import TestClient

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
        with pytest.raises(HTTPException, match="Conversation branch is too long"):
            branch(db, conversation_id, first_id)


def test_message_ordinal_conflicts_are_rejected_by_database(app):
    from fastapi.testclient import TestClient

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
