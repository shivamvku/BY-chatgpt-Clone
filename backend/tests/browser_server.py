"""Explicit browser-test fixture. Never imported or enabled by the deployed application."""

import asyncio
import os

import uvicorn

if os.environ.get("APP_ENV", "development") != "development":
    raise RuntimeError("Browser fixture is forbidden in production")

os.environ["LLM_ENDPOINT"] = "https://test-fixture.invalid/openai/v1"
os.environ["LLM_MODEL"] = "Test fixture — not real AI"
os.environ["EMAIL_FROM"] = "test-fixture@example.com"
os.environ["RESEND_API_KEY"] = "test-fixture-not-a-real-key"

from fastapi import HTTPException  # noqa: E402

from app.main import create_app  # noqa: E402
from app.services import (
    email_delivery,  # noqa: E402
    provider,  # noqa: E402
)

delivered = {}


def fixture_email(email, purpose, token):
    delivered[(email, purpose)] = token
    return True


email_delivery.send_link = fixture_email
fixture_app = create_app()


@fixture_app.get("/__test/email")
def email_link(email: str, purpose: str = "verify"):
    token = delivered.get((email, purpose))
    if not token:
        raise HTTPException(404, "No test email found")
    return {"token": token}


async def fixture_response(messages):
    prompt = messages[-1]["content"]
    if "simulate failure" in prompt:
        yield "Partial test output"
        raise RuntimeError("Intentional browser-test failure")
    text = (
        "This is a deterministic browser-test fixture, not real AI.\n\n"
        "## A useful starting point\n\n- Explore the question\n- Compare the options\n\n"
        "| Option | Score |\n| --- | --- |\n| A | 12 |\n| B | 8 |\n\n"
        "```python\nprint('hello')\n```\n\n"
        '```chart\n{"title":"Comparison","data":[{"label":"A","value":12},'
        '{"label":"B","value":8}]}\n```'
    )
    for position in range(0, len(text), 30):
        await asyncio.sleep(0.08)
        yield text[position : position + 30]


provider.stream_completion = fixture_response
uvicorn.run(fixture_app, host="127.0.0.1", port=int(os.environ.get("TEST_PORT", "8000")))
