import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]


def test_budget_policy_available_to_current_shell_without_github_environment():
    env = {**os.environ, "BUDGET_ALERT_EMAIL": "test@example.com"}
    env.pop("GITHUB_ENV", None)
    result = subprocess.run(
        [sys.executable, str(ROOT / "infra/pipelines/configure-budget.py")],
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    budget = json.loads(result.stdout)
    assert budget["amount"] == 1500 and budget["email"] == "test@example.com"


def test_resource_replacement_is_rejected_without_printing_plan_secrets():
    plan = {
        "resource_changes": [{"address": "budget", "change": {"actions": ["delete", "create"]}}],
        "secret": "must-not-be-logged",
    }
    result = subprocess.run(
        [sys.executable, str(ROOT / "infra/pipelines/guard-plan.py")],
        input=json.dumps(plan),
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0 and "budget" in result.stderr
    assert "must-not-be-logged" not in result.stdout + result.stderr
