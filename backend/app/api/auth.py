from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.accounts import EmailRequest, Notice, PasswordChange, PasswordReset, TokenRequest
from app.schemas.contracts import (
    AuthState,
    Credentials,
    ProfileUpdate,
    Registration,
    SessionView,
    UserView,
)
from app.services import account_recovery
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


@router.post("/verification/request", response_model=Notice, dependencies=[Depends(mutation_guard)])
def request_verification(data: EmailRequest, request: Request, db: Session = Depends(get_db)):
    return account_recovery.request_link(db, request, data.email, "verify")


@router.post("/verification/confirm", response_model=Notice, dependencies=[Depends(mutation_guard)])
def confirm_verification(data: TokenRequest, db: Session = Depends(get_db)):
    return account_recovery.verify(db, data.token)


@router.post("/password/request", response_model=Notice, dependencies=[Depends(mutation_guard)])
def request_reset(data: EmailRequest, request: Request, db: Session = Depends(get_db)):
    return account_recovery.request_link(db, request, data.email, "reset")


@router.post("/password/reset", response_model=Notice, dependencies=[Depends(mutation_guard)])
def reset_password(data: PasswordReset, db: Session = Depends(get_db)):
    return account_recovery.reset(db, data.token, data.password)


@router.post("/transfer/request", response_model=Notice, dependencies=[Depends(mutation_guard)])
def request_transfer(data: Credentials, request: Request, db: Session = Depends(get_db)):
    return service.transfer_request(data=data, request=request, db=db)


@router.post("/transfer/confirm", response_model=AuthState, dependencies=[Depends(mutation_guard)])
def confirm_transfer(
    data: TokenRequest, request: Request, response: Response, db: Session = Depends(get_db)
):
    return service.transfer(token=data.token, request=request, response=response, db=db)


@router.post("/password/change", response_model=Notice)
def change_password(
    data: PasswordChange, current: Identity = Depends(identity), db: Session = Depends(get_db)
):
    return account_recovery.change(db, current.user.id, data.old_password, data.password)
