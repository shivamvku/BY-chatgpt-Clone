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
from app.models.entities import Audit, LoginSession, RateBucket, User, now

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
    insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
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
    if (
        not session
        or session.expires_at <= now()
        or not user
        or not user.active
        or session.last_active_at <= now() - get_settings().session_idle_hours * 3600
    ):
        raise HTTPException(401, "Sign in to continue")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        mutation_guard(request)
        if not secrets.compare_digest(session.csrf_hash, digest(request.headers["x-csrf-token"])):
            raise HTTPException(403, "Session CSRF validation failed")
    if session.last_active_at < now() - 300:
        session.last_active_at = now()
        db.commit()
    return Identity(user, session)


def verified_identity(current: Identity = Depends(identity)) -> Identity:
    if not current.user.verified_user:
        raise HTTPException(403, "Verify your email before using chat or files")
    return current


def admin(current: Identity = Depends(identity)) -> Identity:
    if current.user.role != "admin" or not current.user.verified_user:
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


def session_source(request: Request) -> str:
    agent = request.headers.get("user-agent", "")[:1000].lower()
    browser = next(
        (
            name
            for marker, name in (
                ("edg", "Edge"),
                ("firefox", "Firefox"),
                ("chrome", "Chrome"),
                ("safari", "Safari"),
            )
            if marker in agent
        ),
        "Browser",
    )
    system = next(
        (
            name
            for marker, name in (
                ("android", "Android"),
                ("iphone", "iPhone"),
                ("ipad", "iPad"),
                ("windows", "Windows"),
                ("macintosh", "macOS"),
                ("linux", "Linux"),
            )
            if marker in agent
        ),
        "Unknown device",
    )
    return f"{browser} / {system}"


def new_session(db: Session, user: User, response: Response, request: Request) -> str:
    settings = get_settings()
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    db.execute(
        delete(LoginSession).where(
            LoginSession.user_id == user.id,
            (LoginSession.expires_at <= now())
            | (LoginSession.last_active_at <= now() - settings.session_idle_hours * 3600),
        )
    )
    sessions = db.scalars(
        select(LoginSession)
        .where(LoginSession.user_id == user.id)
        .order_by(LoginSession.created_at.desc())
    ).all()
    if sessions:
        row = sessions[0]
        raise HTTPException(
            409,
            f"You are already signed in on {row.source}. "
            "Request an email sign-in transfer to continue here.",
        )
    db.add(
        LoginSession(
            token_hash=digest(token),
            user_id=user.id,
            csrf_hash=digest(csrf),
            expires_at=now() + settings.session_days * 86400,
            source=session_source(request),
        )
    )
    db.add(Audit(actor_id=user.id, target_id=user.id, action="account.signed_in"))
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
