"""Run through infrastructure's scheduled job, using the restricted database role."""

from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.services.conversations import reconcile_stale_generations
from app.services.retention import purge


def main() -> None:
    with Session(get_engine()) as db:
        stale = reconcile_stale_generations(db)
        removed = purge(db)
        print(
            f"Maintenance completed: reconciled {stale} stale generations; "
            f"removed {removed} expired records"
        )


if __name__ == "__main__":
    main()
