import asyncio
import json
import logging
import time

import anyio
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_engine
from app.models.entities import Conversation, Message, UsageEvent, now
from app.services import provider
from app.services.conversations import context_messages, owned

logger = logging.getLogger(__name__)


def _failure_message(exc: Exception) -> str:
    """Return actionable, credential-safe provider errors to the chat client."""
    status = getattr(getattr(exc, "response", None), "status_code", None)
    if status in {401, 403}:
        return "The AI provider rejected its API key or model access. Check the provider credentials and model permissions."
    if status == 404:
        return "The selected AI model is no longer available. Choose another model or update the provider model configuration."
    if status == 429:
        return "The AI provider rate limit or quota was reached. Retry shortly."
    if status is not None and status >= 500:
        return "The AI provider is temporarily unavailable. Retry shortly."
    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)):
        return "The AI provider timed out. Retry shortly."
    if status is not None and status >= 400:
        return "The AI provider rejected the request. Check the model ID and provider configuration."
    return "AI response failed. Retry when the provider is available."


def claim(user_id: str, message_id: str) -> tuple[list[dict[str, str]], str]:
    with Session(get_engine()) as db:
        row = db.get(Message, message_id)
        if not row or row.role != "assistant":
            raise HTTPException(404, "Response not found")
        owned(db, user_id, row.conversation_id)
        changed = db.execute(
            update(Message)
            .where(Message.id == message_id, Message.status == "pending")
            .values(status="streaming", updated_at=now())
        )
        if changed.rowcount != 1:
            raise HTTPException(409, "Response was already started; reload conversation")
        messages = context_messages(db, row.conversation_id, row.parent_id)
        # Resolve "auto" to a real model using the user's plan
        model_id = row.model
        if model_id == "auto":
            from app.services.provider import resolve_auto
            from app.services.subscriptions import policy
            _, plan = policy(db, user_id)
            model_id = resolve_auto(plan.id)
        db.commit()
        return messages, model_id


def persist(message_id: str, content: str, status: str = "streaming") -> bool:
    with Session(get_engine()) as db:
        row = db.scalar(select(Message).where(Message.id == message_id).with_for_update())
        if not row:
            return False
        stopping = row.status in {"stopping", "stopped"}
        row.content = content
        row.updated_at = now()
        row.status = "stopped" if stopping else status
        usage = db.get(UsageEvent, message_id)
        if usage:
            usage.status = row.status
        conversation = db.get(Conversation, row.conversation_id)
        if conversation:
            conversation.updated_at = now()
        db.commit()
        return not stopping


def event(kind: str, value: dict) -> str:
    return f"event: {kind}\ndata: {json.dumps(value)}\n\n"


def still_running(message_id: str) -> bool:
    with Session(get_engine()) as db:
        return db.scalar(select(Message.status).where(Message.id == message_id)) == "streaming"


async def events(message_id: str, context: tuple[list[dict[str, str]], str], request):
    messages, model_id = context
    content, finished = "", False
    last_save = 0.0
    last_check = 0.0
    upstream = provider.stream_completion(messages, model_id)
    pending = None
    yield event("start", {"id": message_id})
    try:
        async with asyncio.timeout(get_settings().generation_timeout):
            while True:
                if pending is None:
                    pending = asyncio.create_task(anext(upstream))
                done, _ = await asyncio.wait({pending}, timeout=0.5)
                if await request.is_disconnected():
                    break
                if time.monotonic() - last_check >= 0.5:
                    if not await asyncio.to_thread(still_running, message_id):
                        await asyncio.to_thread(persist, message_id, content, "stopped")
                        finished = True
                        yield event("done", {"status": "stopped"})
                        return
                    last_check = time.monotonic()
                if not done:
                    continue
                try:
                    delta = pending.result()
                except StopAsyncIteration:
                    active = await asyncio.to_thread(persist, message_id, content, "complete")
                    finished = True
                    yield event("done", {"status": "complete" if active else "stopped"})
                    return
                finally:
                    pending = None
                content += delta
                if len(content) > 100000:
                    raise ValueError("Response exceeded limit")
                if time.monotonic() - last_save >= 0.25:
                    if not await asyncio.to_thread(persist, message_id, content):
                        yield event("done", {"status": "stopped"})
                        finished = True
                        return
                    last_save = time.monotonic()
                yield event("delta", {"text": delta})
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.exception(
            "AI generation failed model_id=%s error_type=%s provider_status=%s",
            model_id,
            type(exc).__name__,
            getattr(getattr(exc, "response", None), "status_code", None),
        )
        await asyncio.to_thread(persist, message_id, content, "failed")
        finished = True
        yield event(
            "error", {"message": "AI response failed. Retry when the provider is available."}
        )
    finally:
        # ASGI disconnect cancels the request scope; final state must still reach PostgreSQL.
        with anyio.CancelScope(shield=True):
            if pending:
                pending.cancel()
                await asyncio.gather(pending, return_exceptions=True)
            await upstream.aclose()
            if not finished:
                await asyncio.to_thread(persist, message_id, content, "stopped")
