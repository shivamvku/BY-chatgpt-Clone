from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.db.session import get_engine

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def ready() -> dict[str, str]:
    if not get_settings().database_url:
        raise HTTPException(status_code=503, detail="Database is not configured")
    try:
        with get_engine().connect() as connection:
            # Verify the runtime principal can reach the database and the migrated\n            # application schema, not merely open a TCP connection. These reads\n            # are side-effect free and intentionally use the runtime DB credentials.\n            connection.execute(text("SELECT 1"))\n            connection.execute(text("SELECT 1 FROM users LIMIT 0"))\n            connection.execute(text("SELECT 1 FROM conversations LIMIT 0"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database is unavailable") from None
    return {"status": "ready"}
