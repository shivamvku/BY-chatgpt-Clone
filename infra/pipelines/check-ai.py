"""Read-only quota gate before an AI-enabled foundation plan/apply."""

import json
import subprocess
from pathlib import Path

policy = json.loads(Path("infra/config/ai.json").read_text())
if policy["enabled"]:
    quota = json.loads(
        subprocess.check_output(
            [
                "az",
                "cognitiveservices",
                "usage",
                "list",
                "--location",
                policy["location"],
                "-o",
                "json",
            ],
            text=True,
        )
    )
    candidates = [
        entry
        for entry in quota
        if policy["model"].lower() in entry.get("name", {}).get("value", "").lower()
        and policy["sku"].lower() in entry.get("name", {}).get("value", "").lower()
    ]
    if not any(
        entry.get("limit", 0) - entry.get("currentValue", 0) >= policy["capacity"]
        for entry in candidates
    ):
        raise SystemExit(
            "No verified model quota. Keep ai.json disabled until subscription/quota "
            "eligibility and pricing are confirmed."
        )
    print(
        "Configured model has available quota; review pricing and the saved Terraform plan."
    )
else:
    print("AI deployment is disabled; no new inference resource is requested.")
