from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.contracts import AdminUpdate, UserView
from app.services import administration as service
from app.services.security import Identity, admin

router = APIRouter(prefix="/admin", tags=["administration"])


@router.get("/users", response_model=list[UserView])
def users(
    current: Identity = Depends(admin),
    db: Session = Depends(get_db),
    after: str = "",
    limit: int = Query(30, ge=1, le=100),
):
    return service.users(current=current, db=db, after=after, limit=limit)


@router.patch("/users/{user_id}", response_model=UserView)
def update_user(
    user_id: str,
    data: AdminUpdate,
    current: Identity = Depends(admin),
    db: Session = Depends(get_db),
):
    return service.update_user(user_id=user_id, data=data, current=current, db=db)
