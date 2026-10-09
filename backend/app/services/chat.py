import asyncio
import json
from datetime import UTC, datetime

from fastapi import HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import Conversation, Message, Usage, now
from app.schemas.contracts import (
    ConversationCreate,
    ConversationUpdate,
    ConversationView,
    MessageView,
    Regenerate,
    SendMessage,
)
from app.services import provider
from app.services.conversations import owned, prepare_generation
from app.services.generation import claim, events
from app.services.retention import cutoff
from app.services.security import Identity
from app.services.subscriptions import limits, policy


def models(*, current: Identity, db: Session):
    _, plan = policy(db, current.user.id)
    return model_metadata(plan_id=plan.id)


def model_metadata(*, plan_id: str):
    choices = provider.choices(plan_id)
    return {
        "configured": any(model["available"] for model in choices),
        "models": choices,
        "capabilities": {"images": "display-only", "tools": False},
    }


def usage(*, current: Identity, db: Session):
    day = datetime.now(UTC).date().isoformat()
    row = db.get(Usage, (current.user.id, day))
    _, plan = policy(db, current.user.id)
    request_limit, token_limit = limits(plan)
    return {
        "day": day,
        "requests": row.requests if row else 0,
        "reserved_tokens": row.reserved_tokens if row else 0,
        "request_limit": request_limit,
        "token_limit": token_limit,
    }


def conversations(
    *,
    current: Identity,
    db: Session,
    q: str = "",
    archived: bool = False,
    cursor: str = "",
    limit: int = 30,
):
    query = select(Conversation).where(
        Conversation.user_id == current.user.id, Conversation.archived == archived
    )
    threshold = cutoff(db, current.user.id)
    if threshold is not None:
        query = query.where(Conversation.updated_at >= threshold)
    if q:
        literal = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{literal}%"
        query = query.where(
            or_(
                Conversation.title.ilike(pattern, escape="\\"),
                Conversation.id.in_(
                    select(Message.conversation_id)
                    .join(Conversation)
                    .where(
                        Conversation.user_id == current.user.id,
                        Message.content.ilike(pattern, escape="\\"),
                    )
                    .correlate(None)
                ),
            )
        )
    if cursor:
        try:
            timestamp, identifier = cursor.split(":", 1)
            timestamp = int(timestamp)
        except ValueError:
            raise HTTPException(400, "Invalid cursor") from None
        query = query.where(
            or_(
                Conversation.updated_at < timestamp,
                (Conversation.updated_at == timestamp) & (Conversation.id < identifier),
            )
        )
    rows = db.scalars(
        query.order_by(Conversation.updated_at.desc(), Conversation.id.desc()).limit(limit + 1)
    ).all()
    page = rows[:limit]
    return {
        "items": [ConversationView.model_validate(row) for row in page],
        "next_cursor": f"{page[-1].updated_at}:{page[-1].id}" if len(rows) > limit else None,
    }


def create(*, data: ConversationCreate, current: Identity, db: Session):
    row = Conversation(user_id=current.user.id, title=data.title)
    db.add(row)
    db.commit()
    return row


def update_conversation(
    *, conversation_id: str, data: ConversationUpdate, current: Identity, db: Session
):
    row = owned(db, current.user.id, conversation_id)
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(row, key, value)
    row.updated_at = now()
    db.commit()
    return row


def remove(*, conversation_id: str, current: Identity, db: Session):
    row = owned(db, current.user.id, conversation_id, lock=True)
    db.execute(delete(Message).where(Message.conversation_id == conversation_id))
    db.delete(row)
    db.commit()


def messages(*, conversation_id: str, current: Identity, db: Session):
    owned(db, current.user.id, conversation_id)
    rows = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.ordinal)
        .limit(1000)
    ).all()
    for row in rows:
        if (
            row.status in {"pending", "streaming", "stopping"}
            and row.updated_at < now() - get_settings().generation_timeout - 60
        ):
            row.status = "failed"
    db.commit()
    return rows


def send(*, conversation_id: str, data: SendMessage, current: Identity, db: Session):
    return prepare_generation(
        db,
        current.user.id,
        conversation_id,
        data.content,
        data.parent_id,
        data.request_id,
        data.model,
    )


def regenerate(
    *, conversation_id: str, message_id: str, data: Regenerate, current: Identity, db: Session
):
    owned(db, current.user.id, conversation_id)
    row = db.get(Message, message_id)
    if not row or row.conversation_id != conversation_id or row.role != "assistant":
        raise HTTPException(404, "Response not found")
    return prepare_generation(
        db, current.user.id, conversation_id, None, row.parent_id, data.request_id, data.model
    )


async def stream(*, message_id: str, request: Request, current: Identity):
    context = await asyncio.to_thread(claim, current.user.id, message_id)
    return StreamingResponse(
        events(message_id, context, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


def stop(*, message_id: str, current: Identity, db: Session):
    row = db.get(Message, message_id)
    if not row:
        raise HTTPException(404, "Response not found")
    owned(db, current.user.id, row.conversation_id)
    if row.status in {"pending", "streaming"}:
        row.status = "stopped" if row.status == "pending" else "stopping"
        db.commit()


def export(*, conversation_id: str, format: str = "markdown", current: Identity, db: Session):
    conversation = owned(db, current.user.id, conversation_id)
    rows = db.scalars(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.ordinal)
    ).all()
    if format == "json":
        text = json.dumps(
            {
                "conversation": ConversationView.model_validate(conversation).model_dump(),
                "messages": [MessageView.model_validate(row).model_dump() for row in rows],
            }
        )
        media, extension = ("application/json", "json")
    elif format == "markdown":
        text = f"# {conversation.title}\n\n" + "\n\n".join(
            f"## {row.role.title()} ({row.status})\n\n{row.content}" for row in rows
        )
        media, extension = ("text/markdown", "md")
    else:
        raise HTTPException(400, "Export format must be markdown or json")
    return Response(
        text,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="conversation.{extension}"'},
    )
