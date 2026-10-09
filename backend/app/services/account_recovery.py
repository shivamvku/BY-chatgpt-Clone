"""Single-use account actions, with generic unauthenticated request responses."""

import secrets

from fastapi import HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.entities import AccountToken, Audit, LoginSession, User, now
from app.services import email_delivery
from app.services.security import digest, hasher, rate_limit, verify_password


def issue(db: Session, user: User, purpose: str):
    db.execute(
        delete(AccountToken).where(AccountToken.user_id == user.id, AccountToken.purpose == purpose)
    )
    token = secrets.token_urlsafe(32)
    db.add(
        AccountToken(
            token_hash=digest(token),
            user_id=user.id,
            purpose=purpose,
            expires_at=now() + (86400 if purpose == "verify" else 900),
        )
    )
    db.commit()
    return email_delivery.send_link(user.email, purpose, token)


def request_link(db: Session, request: Request, email: str, purpose: str):
    ip = request.client.host if request.client else "unknown"
    rate_limit(db, f"recovery-ip:{ip}", 20)
    rate_limit(db, f"recovery-email:{email}", 3, 900)
    if not email_delivery.configured():
        raise HTTPException(503, "Email delivery is not configured yet; contact an administrator")
    user = db.scalar(select(User).where(User.email == email).with_for_update())
    if user and user.active and (purpose != "verify" or not user.verified_user):
        issue(db, user, purpose)
    return {"message": "If eligible, this account will receive an email. Check your inbox."}


def consume(db: Session, token: str, purpose: str):
    # User first, token second: all account mutations use the same lock order.
    candidate = db.get(AccountToken, digest(token))
    if not candidate:
        raise HTTPException(400, "This link is invalid or expired")
    user = db.scalar(select(User).where(User.id == candidate.user_id).with_for_update())
    row = db.scalar(
        select(AccountToken)
        .where(AccountToken.token_hash == digest(token))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not row or row.purpose != purpose or row.expires_at <= now() or not user or not user.active:
        raise HTTPException(400, "This link is invalid or expired")
    db.delete(row)
    return user


def verify(db: Session, token: str):
    user = consume(db, token, "verify")
    user.verified_user, user.email_verified_at = True, now()
    db.add(Audit(actor_id=user.id, target_id=user.id, action="account.email_verified"))
    db.commit()
    return {"message": "Email verified. You can now sign in."}


def reset(db: Session, token: str, password: str):
    user = consume(db, token, "reset")
    user.password_hash = hasher.hash(password)
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    db.execute(
        delete(AccountToken).where(
            AccountToken.user_id == user.id, AccountToken.purpose.in_(["reset", "transfer"])
        )
    )
    db.add(Audit(actor_id=user.id, target_id=user.id, action="account.password_reset"))
    db.commit()
    return {"message": "Password updated. Sign in with your new password."}


def change(db: Session, user_id: str, old_password: str, password: str):
    rate_limit(db, f"password-change:{user_id}", 5)
    user = db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not verify_password(user.password_hash, old_password):
        raise HTTPException(400, "Current password is incorrect")
    user.password_hash = hasher.hash(password)
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    db.execute(
        delete(AccountToken).where(
            AccountToken.user_id == user.id, AccountToken.purpose.in_(["reset", "transfer"])
        )
    )
    db.add(Audit(actor_id=user.id, target_id=user.id, action="account.password_changed"))
    db.commit()
    return {"message": "Password updated. Sign in again."}
