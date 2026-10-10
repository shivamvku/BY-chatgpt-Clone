import re
import secrets

from fastapi import HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import LoginSession, User, now
from app.schemas.contracts import Credentials, ProfileUpdate, Registration, UserView
from app.services import account_recovery
from app.services.security import (
    Identity,
    csrf_cookie,
    digest,
    dummy_hash,
    hasher,
    new_session,
    rate_limit,
    verify_password,
)
from app.services.subscriptions import provision_basic


def login_limits(request: Request, db: Session, email: str):
    ip = request.client.host if request.client else "unknown"
    rate_limit(db, f"ip:{ip}", 40)
    rate_limit(db, f"email:{email}", 10)


def session_state(*, request: Request, response: Response, db: Session):
    response.headers["Cache-Control"] = "no-store"
    token = request.cookies.get(get_settings().session_cookie, "")
    session = db.get(LoginSession, digest(token)) if token else None
    user = (
        db.get(User, session.user_id)
        if (
            session
            and session.expires_at > now()
            and session.last_active_at > now() - get_settings().session_idle_hours * 3600
        )
        else None
    )
    csrf = request.cookies.get("yc_csrf", "")
    if not user or not user.active:
        # Keep the anonymous CSRF token stable across session bootstrap requests.
        # Rotating it on every GET makes parallel tabs/StrictMode bootstrap requests
        # race: one tab can hold token A while the shared cookie has already become B.
        if not csrf or not re.fullmatch(r"[A-Za-z0-9_-]{43}", csrf):
            csrf = secrets.token_urlsafe(32)
            csrf_cookie(response, csrf)
        return {"user": None, "csrf": csrf}
    if not csrf or digest(csrf) != session.csrf_hash:
        csrf = secrets.token_urlsafe(32)
        session.csrf_hash = digest(csrf)
        db.commit()
        csrf_cookie(response, csrf)
    return {"user": UserView.model_validate(user), "csrf": csrf}


def register(*, data: Registration, request: Request, response: Response, db: Session):
    login_limits(request, db, data.email)
    rate_limit(db, "global-registration", 100, seconds=86400)
    user = User(email=data.email, name=data.name.strip(), password_hash=hasher.hash(data.password))
    db.add(user)
    try:
        db.flush()
        provision_basic(db, user)
        csrf = new_session(db, user, response, request)
        
        # Skip email verification in local development
        if get_settings().skip_email_verification:
            user.verified_user = True
            user.email_verified_at = now()
            db.commit()
        else:
            account_recovery.issue(db, user, "verify")
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Unable to register with these details") from None
    return {"user": UserView.model_validate(user), "csrf": csrf}


def login(*, data: Credentials, request: Request, response: Response, db: Session):
    login_limits(request, db, data.email)
    user = db.scalar(select(User).where(User.email == data.email).with_for_update())
    valid = verify_password(user.password_hash if user else dummy_hash, data.password)
    if not user or not valid or (not user.active):
        raise HTTPException(401, "Invalid email or password")
    old = request.cookies.get(get_settings().session_cookie, "")
    if old:
        db.execute(
            delete(LoginSession).where(
                LoginSession.token_hash == digest(old), LoginSession.user_id == user.id
            )
        )
    if hasher.check_needs_rehash(user.password_hash):
        user.password_hash = hasher.hash(data.password)
    csrf = new_session(db, user, response, request)
    return {"user": UserView.model_validate(user), "csrf": csrf}


def logout(*, response: Response, current: Identity, db: Session):
    db.delete(current.session)
    db.commit()
    response.delete_cookie(
        get_settings().session_cookie,
        path="/",
        secure=get_settings().secure_cookies,
        httponly=True,
        samesite="lax",
    )
    response.delete_cookie("yc_csrf", path="/")


def logout_all(*, response: Response, current: Identity, db: Session):
    db.execute(delete(LoginSession).where(LoginSession.user_id == current.user.id))
    db.commit()
    response.delete_cookie(
        get_settings().session_cookie,
        path="/",
        secure=get_settings().secure_cookies,
        httponly=True,
        samesite="lax",
    )
    response.delete_cookie("yc_csrf", path="/")


def sessions(*, current: Identity, db: Session):
    rows = db.scalars(
        select(LoginSession).where(
            LoginSession.user_id == current.user.id, LoginSession.expires_at > now()
        )
    ).all()
    return [
        {
            "created_at": row.created_at,
            "expires_at": row.expires_at,
            "current": row.token_hash == current.session.token_hash,
            "source": row.source,
            "last_active_at": row.last_active_at,
        }
        for row in rows
    ]


def profile(*, data: ProfileUpdate, current: Identity, db: Session):
    current.user.name = data.name.strip()
    current.user.appearance = data.appearance
    current.user.contrast = data.contrast
    current.user.bio = data.bio
    current.user.timezone = data.timezone
    db.commit()
    return current.user


def transfer_request(*, data: Credentials, request: Request, db: Session):
    login_limits(request, db, data.email)
    user = db.scalar(select(User).where(User.email == data.email).with_for_update())
    valid = verify_password(user.password_hash if user else dummy_hash, data.password)
    if not user or not valid or not user.active:
        raise HTTPException(401, "Invalid email or password")
    from app.services.email_delivery import configured

    if not configured():
        raise HTTPException(503, "Email delivery is not configured yet; contact an administrator")
    if not account_recovery.issue(db, user, "transfer"):
        raise HTTPException(503, "Could not deliver confirmation. Please try again later")
    return {"message": "Check your email to confirm signing in here."}


def transfer(*, token: str, request: Request, response: Response, db: Session):
    user = account_recovery.consume(db, token, "transfer")
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    csrf = new_session(db, user, response, request)
    return {"user": UserView.model_validate(user), "csrf": csrf}
