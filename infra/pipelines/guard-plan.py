"""Reject unreviewed resource deletion without exposing sensitive plan JSON."""

import json
import sys

plan = json.load(sys.stdin)
deletions = [change["address"] for change in plan.get("resource_changes", [])
             if "delete" in change["change"]["actions"]]
if deletions:
    raise SystemExit("Resource deletion requires separate review: " + ", ".join(deletions))
print("Plan contains no resource deletions.")
