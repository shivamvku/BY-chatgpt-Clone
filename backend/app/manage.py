"""Controlled administrative entrypoint; never grants admin through public registration."""

import argparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.models.entities import Audit, User


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["promote-admin"])
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    with Session(get_engine()) as db:
        user = db.scalar(select(User).where(User.email == args.email.strip().lower()))
        if not user or not user.active:
            raise SystemExit("Register an active account first")
        user.role = "admin"
        db.add(Audit(actor_id="operator", target_id=user.id, action="user.admin_provisioned"))
        db.commit()
    print("Administrator provisioned")


if __name__ == "__main__":
    main()
