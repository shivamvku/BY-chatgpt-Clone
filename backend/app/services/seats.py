import secrets

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.entities import Audit, Invitation, Membership, Subscription, User, now
from app.services import email_delivery
from app.services.security import digest
from app.services.subscriptions import policy, provision_basic


def owner_policy(db: Session, user_id: str):
    subscription, plan = policy(db, user_id, lock=True)
    if subscription.owner_id != user_id:
        raise HTTPException(403, "Only the subscription owner can manage seats")
    return subscription, plan


def members(db: Session, user_id: str):
    subscription, _ = owner_policy(db, user_id)
    rows = db.scalars(
        select(User)
        .join(Membership)
        .where(Membership.subscription_id == subscription.id)
        .order_by(User.id)
    ).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "email": row.email,
            "owner": row.id == subscription.owner_id,
        }
        for row in rows
    ]


def invite(db: Session, user_id: str, email: str):
    if not email_delivery.configured():
        raise HTTPException(503, "Email delivery is not configured yet")
    subscription, plan = owner_policy(db, user_id)
    if db.get(User, user_id).email == email:
        raise HTTPException(400, "You already own this subscription")
    count = db.scalar(
        select(func.count())
        .select_from(Membership)
        .where(Membership.subscription_id == subscription.id)
    )
    pending = db.scalar(
        select(func.count())
        .select_from(Invitation)
        .where(
            Invitation.subscription_id == subscription.id,
            Invitation.status == "pending",
            Invitation.expires_at > now(),
            Invitation.email != email,
        )
    )
    if count + pending >= plan.seats:
        raise HTTPException(409, "Your plan has no available seats")
    db.execute(
        delete(Invitation).where(
            Invitation.subscription_id == subscription.id, Invitation.email == email
        )
    )
    token = secrets.token_urlsafe(32)
    invitation = Invitation(
        token_hash=digest(token),
        subscription_id=subscription.id,
        email=email,
        expires_at=now() + 7 * 86400,
    )
    db.add(invitation)
    db.add(Audit(actor_id=user_id, target_id=subscription.id, action="subscription.invited_member"))
    db.commit()
    if not email_delivery.send_link(email, "invite", token):
        invitation.status = "failed"
        db.commit()
        raise HTTPException(503, "Invitation could not be delivered; please retry")
    return {"message": "Invitation sent. It expires in seven days."}


def accept(db: Session, user_id: str, token: str):
    user = db.scalar(select(User).where(User.id == user_id).with_for_update())
    candidate = db.get(Invitation, digest(token))
    if not candidate or candidate.email != user.email or not user.verified_user:
        raise HTTPException(400, "This invitation is invalid for your account")
    subscription = db.scalar(
        select(Subscription).where(Subscription.id == candidate.subscription_id).with_for_update()
    )
    invitation = db.scalar(
        select(Invitation)
        .where(Invitation.token_hash == digest(token))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if (
        not invitation
        or invitation.status != "pending"
        or invitation.expires_at <= now()
        or subscription.status != "active"
        or (subscription.expires_at and subscription.expires_at <= now())
    ):
        raise HTTPException(400, "This invitation is invalid or expired")
    from app.models.entities import Plan

    plan = db.get(Plan, subscription.plan_id)
    count = db.scalar(
        select(func.count())
        .select_from(Membership)
        .where(Membership.subscription_id == subscription.id)
    )
    if count >= plan.seats:
        raise HTTPException(409, "No seats remain on this subscription")
    membership = db.get(Membership, user_id)
    previous = db.get(Subscription, membership.subscription_id)
    if previous.owner_id != user_id or previous.plan_id != "basic":
        raise HTTPException(409, "Leave your current paid or shared subscription first")
    membership.subscription_id = subscription.id
    invitation.status = "accepted"
    db.add(Audit(actor_id=user_id, target_id=subscription.id, action="subscription.joined"))
    db.commit()
    return {"message": "Invitation accepted. Your chats and files remain private."}


def remove(db: Session, actor_id: str, user_id: str):
    # Lock the affected user before subscription, matching generation and acceptance order.
    user = db.scalar(select(User).where(User.id == user_id).with_for_update())
    subscription, _ = owner_policy(db, actor_id)
    membership = db.get(Membership, user_id)
    if not membership or membership.subscription_id != subscription.id:
        raise HTTPException(404, "Member not found")
    if user_id == subscription.owner_id:
        raise HTTPException(400, "The owner cannot be removed")
    db.delete(membership)
    db.flush()
    provision_basic(db, user)
    db.add(Audit(actor_id=actor_id, target_id=user_id, action="subscription.member_removed"))
    db.commit()
