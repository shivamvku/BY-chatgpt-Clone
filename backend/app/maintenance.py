"""Run through infrastructure's scheduled job, using the restricted database role."""

from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.services.retention import purge


def main() -> None:
    with Session(get_engine()) as db:
        print(f"Retention maintenance removed {purge(db)} expired records")


if __name__ == "__main__":
    main()
