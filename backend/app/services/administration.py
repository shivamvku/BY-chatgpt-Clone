from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.entities import Audit, LoginSession, User
from app.schemas.contracts import AdminUpdate
from app.services.security import Identity


def users(*, current: Identity, db: Session, after: str = "", limit: int = 30):
    return db.scalars(select(User).where(User.id > after).order_by(User.id).limit(limit)).all()


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
    user.role, user.active = (data.role, data.active)
    db.execute(delete(LoginSession).where(LoginSession.user_id == user_id))
    db.add(Audit(actor_id=current.user.id, target_id=user_id, action="user.access_updated"))
    db.commit()
    return user
