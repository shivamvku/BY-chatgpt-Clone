from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.contracts import (
    AuthState,
    Credentials,
    ProfileUpdate,
    Registration,
    SessionView,
    UserView,
)
from app.services import accounts as service
from app.services.security import Identity, identity, mutation_guard

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/session", response_model=AuthState)
def session_state(request: Request, response: Response, db: Session = Depends(get_db)):
    return service.session_state(request=request, response=response, db=db)


@router.post(
    "/register", status_code=201, response_model=AuthState, dependencies=[Depends(mutation_guard)]
)
def register(
    data: Registration, request: Request, response: Response, db: Session = Depends(get_db)
):
    return service.register(data=data, request=request, response=response, db=db)


@router.post("/login", response_model=AuthState, dependencies=[Depends(mutation_guard)])
def login(data: Credentials, request: Request, response: Response, db: Session = Depends(get_db)):
    return service.login(data=data, request=request, response=response, db=db)


@router.post("/logout", status_code=204)
def logout(
    response: Response, current: Identity = Depends(identity), db: Session = Depends(get_db)
):
    return service.logout(response=response, current=current, db=db)


@router.delete("/sessions", status_code=204)
def logout_all(
    response: Response, current: Identity = Depends(identity), db: Session = Depends(get_db)
):
    return service.logout_all(response=response, current=current, db=db)


@router.get("/sessions", response_model=list[SessionView])
def sessions(current: Identity = Depends(identity), db: Session = Depends(get_db)):
    return service.sessions(current=current, db=db)


@router.patch("/profile", response_model=UserView)
def profile(
    data: ProfileUpdate, current: Identity = Depends(identity), db: Session = Depends(get_db)
):
    return service.profile(data=data, current=current, db=db)
