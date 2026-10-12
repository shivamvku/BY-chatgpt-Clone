"""Run through infrastructure's scheduled job, using the restricted database role."""

import json
import logging

from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.services.conversations import reconcile_stale_generations
from app.services.retention import purge

logger = logging.getLogger(__name__)


def main() -> None:
    try:
        with Session(get_engine()) as db:
            stale = reconcile_stale_generations(db)
            removed = purge(db)
    except Exception:
        # Let the job fail so the platform retry policy applies; do not hide failures.
        logger.exception("maintenance_failed")
        raise

    print(
        json.dumps(
            {
                "event": "maintenance_completed",
                "stale_generations_reconciled": stale,
                "retention_records_removed": removed,
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
