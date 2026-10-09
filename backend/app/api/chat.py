from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.contracts import (
    ConversationCreate,
    ConversationPage,
    ConversationUpdate,
    ConversationView,
    MessageView,
    ModelInfo,
    Regenerate,
    SendMessage,
    UsageView,
)
from app.services import chat as service
from app.services.security import Identity
from app.services.security import verified_identity as identity

router = APIRouter(tags=["chat"])


@router.get("/models", response_model=ModelInfo)
def models(current: Identity = Depends(identity), db: Session = Depends(get_db)):
    return service.models(current=current, db=db)


@router.get("/usage", response_model=UsageView)
def usage(current: Identity = Depends(identity), db: Session = Depends(get_db)):
    return service.usage(current=current, db=db)


@router.get("/conversations", response_model=ConversationPage)
def conversations(
    current: Identity = Depends(identity),
    db: Session = Depends(get_db),
    q: str = Query("", max_length=120),
    archived: bool = False,
    cursor: str = "",
    limit: int = Query(30, ge=1, le=100),
):
    return service.conversations(
        current=current, db=db, q=q, archived=archived, cursor=cursor, limit=limit
    )


@router.post("/conversations", response_model=ConversationView, status_code=201)
def create(
    data: ConversationCreate, current: Identity = Depends(identity), db: Session = Depends(get_db)
):
    return service.create(data=data, current=current, db=db)


@router.patch("/conversations/{conversation_id}", response_model=ConversationView)
def update_conversation(
    conversation_id: str,
    data: ConversationUpdate,
    current: Identity = Depends(identity),
    db: Session = Depends(get_db),
):
    return service.update_conversation(
        conversation_id=conversation_id, data=data, current=current, db=db
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
def remove(
    conversation_id: str, current: Identity = Depends(identity), db: Session = Depends(get_db)
):
    return service.remove(conversation_id=conversation_id, current=current, db=db)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageView])
def messages(
    conversation_id: str, current: Identity = Depends(identity), db: Session = Depends(get_db)
):
    return service.messages(conversation_id=conversation_id, current=current, db=db)


@router.post("/conversations/{conversation_id}/messages", response_model=MessageView)
def send(
    conversation_id: str,
    data: SendMessage,
    current: Identity = Depends(identity),
    db: Session = Depends(get_db),
):
    return service.send(conversation_id=conversation_id, data=data, current=current, db=db)


@router.post(
    "/conversations/{conversation_id}/messages/{message_id}/regenerate", response_model=MessageView
)
def regenerate(
    conversation_id: str,
    message_id: str,
    data: Regenerate,
    current: Identity = Depends(identity),
    db: Session = Depends(get_db),
):
    return service.regenerate(
        conversation_id=conversation_id, message_id=message_id, data=data, current=current, db=db
    )


@router.post("/generations/{message_id}/stream")
async def stream(message_id: str, request: Request, current: Identity = Depends(identity)):
    return await service.stream(message_id=message_id, request=request, current=current)


@router.post("/generations/{message_id}/stop", status_code=204)
def stop(message_id: str, current: Identity = Depends(identity), db: Session = Depends(get_db)):
    return service.stop(message_id=message_id, current=current, db=db)


@router.get("/conversations/{conversation_id}/export")
def export(
    conversation_id: str,
    format: str = "markdown",
    current: Identity = Depends(identity),
    db: Session = Depends(get_db),
):
    return service.export(conversation_id=conversation_id, format=format, current=current, db=db)
