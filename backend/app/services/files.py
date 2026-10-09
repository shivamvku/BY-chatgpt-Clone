import asyncio
from io import BytesIO

from fastapi import HTTPException, Request
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.models.entities import Attachment, User
from app.services.retention import cutoff
from app.services.security import Identity
from app.services.subscriptions import policy

LIMIT = 2 * 1024 * 1024
image_gate = asyncio.Semaphore(2)


def images(*, current: Identity, db: Session):
    threshold = cutoff(db, current.user.id)
    rows = (
        db.execute(
            select(
                Attachment.id,
                Attachment.name,
                Attachment.created_at,
                func.length(Attachment.data).label("size"),
            )
            .where(Attachment.user_id == current.user.id)
            .where(Attachment.created_at >= (threshold or 0))
            .order_by(Attachment.created_at.desc())
            .limit(20)
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


def sanitize_image(data: bytes) -> tuple[bytes, str]:
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format not in {"PNG", "JPEG", "WEBP"} or image.width * image.height > 16000000:
                raise HTTPException(415, "Use a PNG, JPEG or WebP image under 16 megapixels")
            image.load()
            output = BytesIO()
            image.convert("RGB").save(output, format="JPEG", quality=85)
            if output.tell() > LIMIT:
                raise HTTPException(413, "Image is too large")
            return (output.getvalue(), "image/jpeg")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(415, "Invalid image") from None


async def upload(*, request: Request, current: Identity):
    chunks = bytearray()
    async for chunk in request.stream():
        chunks.extend(chunk)
        if len(chunks) > LIMIT:
            raise HTTPException(413, "Images must be smaller than 2 MB")
    async with image_gate:
        data, media = await asyncio.to_thread(sanitize_image, bytes(chunks))
        return await asyncio.to_thread(store_image, current.user.id, data, media)


def store_image(user_id: str, data: bytes, media: str):
    with Session(get_engine(), expire_on_commit=False) as db:
        user = db.scalar(select(User).where(User.id == user_id).with_for_update())
        if not user or not user.active:
            raise HTTPException(401, "Sign in to continue")
        if not user.verified_user:
            raise HTTPException(403, "Verify your email before uploading")
        _, plan = policy(db, user_id, lock=True)
        stored = db.scalar(
            select(func.coalesce(func.sum(func.length(Attachment.data)), 0)).where(
                Attachment.user_id == user_id
            )
        )
        if stored + len(data) > plan.storage_bytes:
            raise HTTPException(429, "Storage allowance reached; delete old files first")
        count = db.scalar(
            select(func.count()).select_from(Attachment).where(Attachment.user_id == user_id)
        )
        if count >= 20:
            raise HTTPException(429, "Image allowance reached; delete an old image first")
        row = Attachment(user_id=user_id, name="image.jpg", data=data, media_type=media)
        db.add(row)
        db.commit()
        return {"id": row.id, "url": f"/api/files/{row.id}", "name": row.name}


def download(*, file_id: str, current: Identity, db: Session):
    threshold = cutoff(db, current.user.id)
    row = db.scalar(
        select(Attachment).where(
            Attachment.id == file_id,
            Attachment.user_id == current.user.id,
            Attachment.created_at >= (threshold or 0),
        )
    )
    if not row:
        raise HTTPException(404, "Image not found")
    return Response(
        row.data,
        media_type=row.media_type,
        headers={"Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff"},
    )


def remove(*, file_id: str, current: Identity, db: Session):
    row = db.scalar(
        select(Attachment).where(Attachment.id == file_id, Attachment.user_id == current.user.id)
    )
    if not row:
        raise HTTPException(404, "Image not found")
    db.delete(row)
    db.commit()
