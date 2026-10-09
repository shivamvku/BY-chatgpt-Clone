from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Audit, Plan
from app.schemas.accounts import (
    AuditView,
    EmailRequest,
    Notice,
    PlanUpdate,
    PlanView,
    SubscriptionUpdate,
    SubscriptionView,
    TokenRequest,
    UsageEventView,
)
from app.services import seats
from app.services import subscriptions as service
from app.services.security import Identity, admin, identity, verified_identity

router = APIRouter(tags=["subscriptions"])


class MemberView(BaseModel):
    id: str
    name: str
    email: str
    owner: bool


@router.get("/subscription/members", response_model=list[MemberView])
def members(current: Identity = Depends(verified_identity), db: Session = Depends(get_db)):
    return seats.members(db, current.user.id)


@router.post("/subscription/invitations", response_model=Notice)
def invite(
    data: EmailRequest,
    current: Identity = Depends(verified_identity),
    db: Session = Depends(get_db),
):
    return seats.invite(db, current.user.id, data.email)


@router.post("/subscription/invitations/accept", response_model=Notice)
def accept(
    data: TokenRequest,
    current: Identity = Depends(verified_identity),
    db: Session = Depends(get_db),
):
    return seats.accept(db, current.user.id, data.token)


@router.delete("/subscription/members/{user_id}", status_code=204)
def remove_member(
    user_id: str, current: Identity = Depends(verified_identity), db: Session = Depends(get_db)
):
    return seats.remove(db, current.user.id, user_id)


@router.get("/subscription", response_model=SubscriptionView)
def subscription(current: Identity = Depends(identity), db: Session = Depends(get_db)):
    return service.summary(db, current.user.id)


@router.get("/usage/events", response_model=list[UsageEventView])
def usage_events(
    after: int = Query(0, ge=0),
    current: Identity = Depends(identity),
    db: Session = Depends(get_db),
):
    return service.usage_history(db, current.user.id, after)


@router.get("/admin/plans", response_model=list[PlanView])
def plans(current: Identity = Depends(admin), db: Session = Depends(get_db)):
    return db.scalars(select(Plan).order_by(Plan.seats)).all()


@router.patch("/admin/plans/{plan_id}", response_model=PlanView)
def update_plan(
    plan_id: str,
    data: PlanUpdate,
    current: Identity = Depends(admin),
    db: Session = Depends(get_db),
):
    return service.update_plan(db, current.user.id, plan_id, data)


@router.patch("/admin/users/{user_id}/subscription", response_model=SubscriptionView)
def assign(
    user_id: str,
    data: SubscriptionUpdate,
    current: Identity = Depends(admin),
    db: Session = Depends(get_db),
):
    return service.assign(db, current.user.id, user_id, data)


@router.get("/admin/audit", response_model=list[AuditView])
def audit(
    after: str = Query("", max_length=36),
    current: Identity = Depends(admin),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Audit).where(Audit.id > after).order_by(Audit.created_at.desc(), Audit.id).limit(100)
    ).all()
