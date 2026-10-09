from fastapi import HTTPException
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.models.entities import Audit, LoginSession, User
from app.schemas.contracts import AdminUpdate
from app.services.security import Identity


def users(
    *,
    current: Identity,
    db: Session,
    after: str = "",
    limit: int = 30,
    query: str = "",
    role: str = "",
    active: str = "",
):
    statement = select(User).where(User.id > after)
    if normalized := query.strip().lower():
        pattern = f"%{normalized}%"
        statement = statement.where(or_(User.name.ilike(pattern), User.email.ilike(pattern)))
    if role:
        statement = statement.where(User.role == role)
    if active:
        statement = statement.where(User.active.is_(active == "true"))
    return db.scalars(statement.order_by(User.id).limit(limit)).all()


def summary(*, current: Identity, db: Session):
    return {
        "total_users": db.scalar(select(func.count()).select_from(User)) or 0,
        "active_users": db.scalar(
            select(func.count()).select_from(User).where(User.active.is_(True))
        )
        or 0,
        "verified_users": db.scalar(
            select(func.count()).select_from(User).where(User.verified_user.is_(True))
        )
        or 0,
        "administrators": db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == "admin", User.active.is_(True))
        )
        or 0,
    }


def update_user(*, user_id: str, data: AdminUpdate, current: Identity, db: Session):
    db.scalars(select(User).where(User.role == "admin").order_by(User.id).with_for_update()).all()
    db.refresh(current.user)
    if not current.user.active or current.user.role != "admin":
        raise HTTPException(403, "Administrator access required")
    if user_id == current.user.id:
        raise HTTPException(400, "Administrators cannot change their own access")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    removing_last_admin = user.role == "admin" and user.active and (
        data.role != "admin" or not data.active
    )
    if removing_last_admin:
        active_admins = db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == "admin", User.active.is_(True))
        )
        if active_admins <= 1:
            raise HTTPException(409, "At least one active administrator must remain")
    user.role, user.active = (data.role, data.active)
    db.execute(delete(LoginSession).where(LoginSession.user_id == user_id))
    db.add(Audit(actor_id=current.user.id, target_id=user_id, action="user.access_updated"))
    db.commit()
    return user
