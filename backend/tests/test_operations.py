import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.manage import main as promote
from app.models.entities import Audit, LoginSession, User
from app.ops import main as operate
from tests.test_application import app as application_fixture
from tests.test_application import register

app = application_fixture


def test_promotion_requires_verified_account_and_revokes_sessions(app, monkeypatch):
    client = TestClient(app)
    user = register(client)
    monkeypatch.setattr(sys, "argv", ["operator", "promote-admin", "--email", user["email"]])
    with Session(get_engine()) as db:
        db.get(User, user["id"]).verified_user = False
        db.commit()
    with pytest.raises(SystemExit, match="verified"):
        promote()
    with Session(get_engine()) as db:
        assert db.get(User, user["id"]).role == "user"
        db.get(User, user["id"]).verified_user = True
        db.commit()
    promote()
    assert client.get("/api/conversations").status_code == 401
    promote()
    with Session(get_engine()) as db:
        assert db.get(User, user["id"]).role == "admin"
        assert db.scalar(select(LoginSession)) is None
        assert (
            len(db.scalars(select(Audit).where(Audit.action == "user.admin_provisioned")).all())
            == 1
        )


def test_operator_rejects_arbitrary_commands(monkeypatch):
    monkeypatch.setenv("OPERATION", "execute-sql")
    with pytest.raises(SystemExit, match="Unsupported"):
        operate()


@pytest.mark.parametrize("args", [["-m", "app.db.migrate"], ["-m", "app.ops"]])
def test_job_preflight_rejects_stale_command_or_target(args):
    script = Path(__file__).parents[2] / "infra/pipelines/verify-job.py"
    spec = {
        "command": ["python"],
        "args": args,
        "env": [
            {"name": "OPERATION", "value": "promote-admin"},
            {"name": "OPERATOR_EMAIL", "value": "wrong@example.com"},
            {"name": "OPERATOR_ACTOR", "value": "github:123"},
        ],
    }
    env = {
        **os.environ,
        "JOB_SPEC": json.dumps(spec),
        "OPERATION": "promote-admin",
        "OPERATOR_EMAIL": "intended@example.com",
        "TF_VAR_operator_actor": "github:123",
    }
    result = subprocess.run(
        [sys.executable, str(script), "app.ops"], env=env, capture_output=True, text=True
    )
    assert result.returncode != 0
    assert "execution refused" in result.stderr
