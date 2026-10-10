"""Create a disposable SQLite database and predictable demo accounts for local review."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import Base, get_engine
from app.models import entities  # noqa: F401 - register every model on Base.metadata
from app.models.entities import User
from app.services.security import hasher
from app.services.subscriptions import provision_basic

DEMO_ACCOUNTS = (
    {
        "email": "admin@younderchat.local",
        "name": "Local Demo Admin",
        "password": "AdminDemo!2026",
        "role": "admin",
    },
    {
        "email": "user@younderchat.local",
        "name": "Local Demo User",
        "password": "UserDemo!2026",
        "role": "user",
    },
)


def main() -> None:
    engine = get_engine()
    if engine.dialect.name != "sqlite":
        raise SystemExit("Local seed is restricted to SQLite. Set DATABASE_URL=sqlite:///./local.db.")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        for account in DEMO_ACCOUNTS:
            user = db.scalar(select(User).where(User.email == account["email"]))
            if user is None:
                user = User(
                    email=account["email"],
                    name=account["name"],
                    password_hash=hasher.hash(account["password"]),
                    role=account["role"],
                    active=True,
                    verified_user=True,
                )
                db.add(user)
                db.flush()
                provision_basic(db, user)
            else:
                user.password_hash = hasher.hash(account["password"])
                user.role = account["role"]
                user.active = True
                user.verified_user = True
        db.commit()
    print("Local SQLite schema ready.")
    print("Admin: admin@younderchat.local / AdminDemo!2026")
    print("Basic user: user@younderchat.local / UserDemo!2026")
    print("These credentials are for local demo use only; never use them in production.")


if __name__ == "__main__":
    main()
