import hashlib
import secrets
from dataclasses import dataclass

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import LoginSession, RateBucket, User, now

hasher = PasswordHasher()
dummy_hash = hasher.hash(secrets.token_urlsafe(32))


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def verify_password(encoded: str, password: str) -> bool:
    try:
        return hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def rate_limit(db: Session, key: str, limit: int, seconds: int = 900):
    bucket_key = digest(f"{key}:{now() // seconds}")
    insert = pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert
    statement = insert(RateBucket).values(key=bucket_key, count=1, expires_at=now() + seconds)
    statement = statement.on_conflict_do_update(
        index_elements=[RateBucket.key], set_={"count": RateBucket.count + 1}
    ).returning(RateBucket.count)
    count = db.scalar(statement)
    db.execute(delete(RateBucket).where(RateBucket.expires_at < now()))
    db.commit()
    if count > limit:
        raise HTTPException(
            429, "Too many attempts; try again later", headers={"Retry-After": "900"}
        )


def mutation_guard(request: Request):
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    settings = get_settings()
    origins = {value.strip() for value in settings.allowed_origins.split(",")}
    if request.headers.get("origin", "") not in origins:
        raise HTTPException(403, "Request origin is not allowed")
    cookie = request.cookies.get("yc_csrf", "")
    header = request.headers.get("x-csrf-token", "")
    if not cookie or not secrets.compare_digest(cookie, header):
        raise HTTPException(403, "CSRF validation failed")


@dataclass
class Identity:
    user: User
    session: LoginSession


def identity(request: Request, db: Session = Depends(get_db)) -> Identity:
    token = request.cookies.get(get_settings().session_cookie, "")
    session = db.get(LoginSession, digest(token)) if token else None
    user = db.get(User, session.user_id) if session else None
    if not session or session.expires_at <= now() or not user or not user.active:
        raise HTTPException(401, "Sign in to continue")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        mutation_guard(request)
        if not secrets.compare_digest(session.csrf_hash, digest(request.headers["x-csrf-token"])):
            raise HTTPException(403, "Session CSRF validation failed")
    return Identity(user, session)


def admin(current: Identity = Depends(identity)) -> Identity:
    if current.user.role != "admin":
        raise HTTPException(403, "Administrator access required")
    return current


def csrf_cookie(response: Response, value: str):
    response.set_cookie(
        "yc_csrf",
        value,
        httponly=True,
        secure=get_settings().secure_cookies,
        samesite="lax",
        path="/",
        max_age=get_settings().session_days * 86400,
    )


def new_session(db: Session, user: User, response: Response) -> str:
    settings = get_settings()
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    db.execute(delete(LoginSession).where(LoginSession.expires_at < now()))
    sessions = db.scalars(
        select(LoginSession)
        .where(LoginSession.user_id == user.id)
        .order_by(LoginSession.created_at.desc())
    ).all()
    for old in sessions[9:]:
        db.delete(old)
    db.add(
        LoginSession(
            token_hash=digest(token),
            user_id=user.id,
            csrf_hash=digest(csrf),
            expires_at=now() + settings.session_days * 86400,
        )
    )
    db.commit()
    response.set_cookie(
        settings.session_cookie,
        token,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
        max_age=settings.session_days * 86400,
    )
    csrf_cookie(response, csrf)
    return csrf
