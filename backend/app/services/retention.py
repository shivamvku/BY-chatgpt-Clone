"""Bounded retention maintenance; usable by the scheduled runtime job."""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.entities import (
    AccountToken,
    Attachment,
    Audit,
    Conversation,
    Membership,
    Message,
    Plan,
    Subscription,
    now,
)


def cutoff(db: Session, user_id: str) -> int | None:
    plan = db.scalar(
        select(Plan).join(Subscription).join(Membership).where(Membership.user_id == user_id)
    )
    return now() - plan.retention_days * 86400 if plan and plan.retention_days is not None else None


def purge(db: Session, batch_size: int = 100):
    users = db.execute(
        select(Membership.user_id, Plan.retention_days)
        .join(Subscription, Membership.subscription_id == Subscription.id)
        .join(Plan)
        .where(Plan.retention_days.is_not(None))
    ).all()
    removed = 0
    for user_id, days in users:
        threshold = now() - days * 86400
        conversations = db.scalars(
            select(Conversation)
            .where(Conversation.user_id == user_id, Conversation.updated_at < threshold)
            .order_by(Conversation.id)
            .limit(batch_size)
        ).all()
        for row in conversations:
            db.execute(delete(Message).where(Message.conversation_id == row.id))
            db.delete(row)
            removed += 1
        images = db.scalars(
            select(Attachment)
            .where(Attachment.user_id == user_id, Attachment.created_at < threshold)
            .order_by(Attachment.id)
            .limit(batch_size)
        ).all()
        for image in images:
            db.delete(image)
            removed += 1
        if conversations or images:
            db.add(
                Audit(
                    actor_id="retention-job", target_id=user_id, action="storage.retention_purged"
                )
            )
        db.commit()
    db.execute(delete(AccountToken).where(AccountToken.expires_at <= now()))
    db.commit()
    return removed
