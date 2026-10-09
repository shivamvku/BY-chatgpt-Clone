"""Plan policy and subscription accounting. Never cache authorization decisions."""

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import Audit, Membership, Plan, Subscription, UsageEvent, User, now

DEFAULT_PLANS = (
    dict(
        id="basic",
        name="Basic",
        seats=1,
        daily_requests=10,
        daily_tokens=10000,
        retention_days=7,
        storage_bytes=20 * 1024 * 1024,
        version=1,
    ),
    dict(
        id="pro",
        name="Pro",
        seats=2,
        daily_requests=30,
        daily_tokens=40000,
        retention_days=183,
        storage_bytes=100 * 1024 * 1024,
        version=1,
    ),
    dict(
        id="pro_max",
        name="Pro Max",
        seats=5,
        daily_requests=60,
        daily_tokens=80000,
        retention_days=None,
        storage_bytes=500 * 1024 * 1024,
        version=1,
    ),
)


def provision_basic(db: Session, user: User) -> Subscription:
    insert = pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert
    for values in DEFAULT_PLANS:
        db.execute(insert(Plan).values(**values).on_conflict_do_nothing(index_elements=[Plan.id]))
    row = Subscription(owner_id=user.id, plan_id="basic")
    db.add(row)
    db.flush()
    db.add(Membership(user_id=user.id, subscription_id=row.id))
    return row


def policy(db: Session, user_id: str, lock: bool = False):
    query = select(Subscription).join(Membership).where(Membership.user_id == user_id)
    if lock:
        query = query.with_for_update()
    subscription = db.scalar(query)
    if not subscription:
        raise HTTPException(403, "No subscription is assigned; contact an administrator")
    if subscription.status != "active" or (
        subscription.expires_at is not None and subscription.expires_at <= now()
    ):
        raise HTTPException(403, "Your subscription has expired or is suspended")
    return subscription, db.get(Plan, subscription.plan_id)


def limits(plan: Plan):
    settings = get_settings()
    return min(plan.daily_requests, settings.daily_requests), min(
        plan.daily_tokens, settings.daily_token_limit
    )


def summary(db: Session, user_id: str):
    subscription = db.scalar(
        select(Subscription).join(Membership).where(Membership.user_id == user_id)
    )
    if not subscription:
        raise HTTPException(404, "Subscription not found")
    plan = db.get(Plan, subscription.plan_id)
    return {
        "id": subscription.id,
        "plan": plan.id,
        "plan_name": plan.name,
        "status": subscription.status,
        "expires_at": subscription.expires_at,
        "owner": subscription.owner_id == user_id,
        "seats": plan.seats,
        "members": db.scalar(
            select(func.count())
            .select_from(Membership)
            .where(Membership.subscription_id == subscription.id)
        ),
        "retention_days": plan.retention_days,
        "storage_bytes": plan.storage_bytes,
        "daily_requests": limits(plan)[0],
        "daily_tokens": limits(plan)[1],
        "billing_mode": "admin_assigned",
        "payment_collection_enabled": False,
    }


def assign(db: Session, actor_id: str, user_id: str, data):
    user = db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not user:
        raise HTTPException(404, "User not found")
    subscription = db.scalar(
        select(Subscription).join(Membership).where(Membership.user_id == user_id).with_for_update()
    )
    if not subscription or subscription.owner_id != user_id:
        raise HTTPException(409, "Change the subscription through its owner")
    members = db.scalar(
        select(func.count())
        .select_from(Membership)
        .where(Membership.subscription_id == subscription.id)
    )
    plan = db.get(Plan, data.plan)
    if members > plan.seats:
        raise HTTPException(409, "Remove extra members before downgrading")
    subscription.plan_id, subscription.status = data.plan, data.status
    subscription.expires_at = data.expires_at
    db.add(
        Audit(
            actor_id=actor_id,
            target_id=subscription.id,
            action=f"subscription.{data.plan}.{data.status}",
        )
    )
    db.commit()
    return summary(db, user_id)


def update_plan(db: Session, actor_id: str, plan_id: str, data):
    row = db.scalar(select(Plan).where(Plan.id == plan_id).with_for_update())
    if not row:
        raise HTTPException(404, "Plan not found")
    row.daily_requests, row.daily_tokens = data.daily_requests, data.daily_tokens
    row.version += 1
    db.add(
        Audit(actor_id=actor_id, target_id=plan_id, action=f"plan.limits_updated.v{row.version}")
    )
    db.commit()
    return row


def usage_history(db: Session, user_id: str, after: int = 0):
    return db.scalars(
        select(UsageEvent)
        .where(UsageEvent.user_id == user_id, UsageEvent.created_at >= after)
        .order_by(UsageEvent.created_at.desc(), UsageEvent.id)
        .limit(100)
    ).all()
