from alembic import context

from app.db.session import Base, get_engine
from app.models import entities  # noqa: F401 -- register every model for autogeneration

if context.is_offline_mode():
    raise RuntimeError("Run migrations online with DATABASE_URL configured")
else:
    with get_engine().connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
