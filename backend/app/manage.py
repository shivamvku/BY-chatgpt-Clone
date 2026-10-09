"""Controlled administrative entrypoint; never grants admin through public registration."""

import argparse
import os

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.models.entities import Audit, LoginSession, User


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["promote-admin"])
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    with Session(get_engine()) as db:
        user = db.scalar(
            select(User).where(User.email == args.email.strip().lower()).with_for_update()
        )
        if not user or not user.active or not user.verified_user:
            raise SystemExit("An active, email-verified account is required")
        identifier = user.id
        if user.role != "admin":
            user.role = "admin"
            db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
            db.add(
                Audit(
                    actor_id=os.environ.get("OPERATOR_ACTOR", "operator"),
                    target_id=user.id,
                    action="user.admin_provisioned",
                )
            )
            db.commit()
    with Session(get_engine()) as verification:
        if verification.get(User, identifier).role != "admin":
            raise SystemExit("Administrator verification failed")
    print("Administrator role verified; sign in again to confirm the Admin screen")


if __name__ == "__main__":
    main()
