from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.contracts import ImageView, UploadedImage
from app.services import files as service
from app.services.security import Identity, identity

router = APIRouter(prefix="/files", tags=["attachments"])


@router.get("", response_model=list[ImageView])
def images(current: Identity = Depends(identity), db: Session = Depends(get_db)):
    return service.images(current=current, db=db)


@router.post("", status_code=201, response_model=UploadedImage)
async def upload(request: Request, current: Identity = Depends(identity)):
    return await service.upload(request=request, current=current)


@router.get("/{file_id}")
def download(file_id: str, current: Identity = Depends(identity), db: Session = Depends(get_db)):
    return service.download(file_id=file_id, current=current, db=db)


@router.delete("/{file_id}", status_code=204)
def remove(file_id: str, current: Identity = Depends(identity), db: Session = Depends(get_db)):
    return service.remove(file_id=file_id, current=current, db=db)
