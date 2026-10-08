"""Print the two DNS records for the owner to add in GoDaddy; no DNS mutations."""

import json
import os
import subprocess
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    config = json.loads((root / "infra/config/custom-domain.json").read_text())
    app = json.loads(
        subprocess.check_output(
            [
                "az",
                "containerapp",
                "show",
                "--name",
                os.environ["AZURE_APP_NAME"],
                "--resource-group",
                os.environ["AZURE_RESOURCE_GROUP"],
                "-o",
                "json",
            ],
            text=True,
        )
    )
    properties = app["properties"]
    hostname = properties["configuration"]["ingress"]["fqdn"]
    verification = properties["customDomainVerificationId"]
    if not hostname.endswith(".azurecontainerapps.io") or not verification:
        raise SystemExit("Application hostname/verification ID is unavailable")
    records = [
        {
            "type": "CNAME",
            "name": config["subdomain"],
            "value": hostname,
            "ttl": config["ttl"],
        },
        {
            "type": "TXT",
            "name": "asuid." + config["subdomain"],
            "value": verification,
            "ttl": config["ttl"],
        },
    ]
    print(json.dumps({"zone": config["zone"], "records": records}, indent=2))


if __name__ == "__main__":
    main()
