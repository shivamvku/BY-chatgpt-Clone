"""Read-only readiness checks before enabling paid database-management infrastructure."""

import json
import os
import subprocess
from pathlib import Path


def azure(*args):
    return json.loads(subprocess.check_output(["az", *args, "-o", "json"], text=True))


policy = json.loads(Path("infra/config/db-access.json").read_text())
if policy["enabled"]:
    if not os.environ.get("TF_VAR_db_access_cidr") or not os.environ.get("TF_VAR_db_access_public_key"):
        raise SystemExit("Configure DB_ACCESS_CIDR (/32) and DB_ACCESS_PUBLIC_KEY first")
    for namespace in ("Microsoft.Compute", "Microsoft.DevTestLab"):
        if azure("provider", "show", "--namespace", namespace)["registrationState"] != "Registered":
            raise SystemExit(f"Register {namespace} through infra/scripts/Register-Providers.ps1 first")
    skus = azure("vm", "list-skus", "--location", "centralus", "--size", policy["vm_size"], "--all")
    if not any(s["name"] == policy["vm_size"] and not s.get("restrictions") for s in skus):
        raise SystemExit("The configured VM SKU is unavailable on this subscription")
    print("Database-access prerequisites passed. Review VM, disk and public-IP pricing before apply.")
else:
    print("Database access is disabled; no management VM or public IP will be provisioned.")
