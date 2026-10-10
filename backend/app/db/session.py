from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not configured")
    
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    else:
        return create_engine(
            url, 
            pool_pre_ping=True, 
            pool_size=5, 
            max_overflow=5, 
            pool_timeout=5, 
            connect_args={"connect_timeout": 5}
        )


def get_db():
    with Session(get_engine(), expire_on_commit=False) as db:
        yield db
