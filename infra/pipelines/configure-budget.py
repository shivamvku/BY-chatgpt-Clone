"""Build Terraform budget input from repository policy and a private contact setting."""

import json
import os
from pathlib import Path


def main() -> None:
    repository = Path(__file__).resolve().parents[2]
    policy = json.loads((repository / "infra/config/budget.json").read_text())
    email = os.environ.get("BUDGET_ALERT_EMAIL", "").strip()
    if not email or "@" not in email:
        raise SystemExit("Set the GitHub repository variable AZURE_BUDGET_ALERT_EMAIL")
    budget = {
        "amount": policy["amount"],
        "start_date": policy["start_date"],
        "email": email,
    }
    print(json.dumps(budget, separators=(",", ":")))


if __name__ == "__main__":
    main()
