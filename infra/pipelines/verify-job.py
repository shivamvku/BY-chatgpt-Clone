"""Reject stale job templates before starting a production execution."""

import json
import os
import sys

spec = json.loads(os.environ["JOB_SPEC"])
module = sys.argv[1]
if spec.get("command") != ["python"] or spec.get("args") != ["-m", module]:
    raise SystemExit("Unexpected persisted job command; execution refused")
if module == "app.ops":
    configured = {env["name"]: env.get("value", "") for env in spec.get("env", [])}
    expected = {"OPERATION": os.environ["OPERATION"],
                "OPERATOR_EMAIL": os.environ.get("OPERATOR_EMAIL", ""),
                "OPERATOR_ACTOR": os.environ["TF_VAR_operator_actor"]}
    if any(configured.get(key) != value for key, value in expected.items()):
        raise SystemExit("Operator job does not match the reviewed operation; execution refused")
