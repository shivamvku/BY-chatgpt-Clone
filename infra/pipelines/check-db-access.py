"""Read-only readiness checks before enabling paid database-management infrastructure."""

import json
import os
import subprocess
from pathlib import Path


def azure(*args):
    return json.loads(subprocess.check_output(["az", *args, "-o", "json"], text=True))


policy = json.loads(Path("infra/config/db-access.json").read_text())
if policy["enabled"]:
    if not os.environ.get("TF_VAR_db_access_cidr") or not os.environ.get(
        "TF_VAR_db_access_public_key"
    ):
        raise SystemExit("Configure DB_ACCESS_CIDR (/32) and DB_ACCESS_PUBLIC_KEY first")
    for namespace in ("Microsoft.Compute", "Microsoft.DevTestLab"):
        if azure("provider", "show", "--namespace", namespace)["registrationState"] != "Registered":
            raise SystemExit(
                f"Register {namespace} through infra/scripts/Register-Providers.ps1 first"
            )
    skus = azure("vm", "list-skus", "--location", "centralus", "--size", policy["vm_size"], "--all")
    eligible = next(
        (s for s in skus if s["name"] == policy["vm_size"] and not s.get("restrictions")), None
    )
    if not eligible:
        raise SystemExit("The configured VM SKU is unavailable on this subscription")
    cores = int(next(c["value"] for c in eligible["capabilities"] if c["name"] == "vCPUs"))
    usage = azure("vm", "list-usage", "--location", "centralus")
    for name in ("cores", eligible["family"]):
        quota = next((q for q in usage if q["name"]["value"].lower() == name.lower()), None)
        if not quota or int(quota["limit"]) - int(quota["currentValue"]) < cores:
            raise SystemExit(f"Insufficient VM quota: {name}")
    print(
        "Database-access prerequisites passed. Review VM, disk and public-IP pricing before apply."
    )
else:
    print("Database access is disabled; no management VM or public IP will be provisioned.")
