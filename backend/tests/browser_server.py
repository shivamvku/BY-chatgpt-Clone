"""Explicit browser-test fixture. Never imported or enabled by the deployed application."""

import asyncio
import os

import uvicorn

if os.environ.get("APP_ENV", "development") != "development":
    raise RuntimeError("Browser fixture is forbidden in production")

os.environ["LLM_ENDPOINT"] = "https://test-fixture.invalid/openai/v1"
os.environ["LLM_MODEL"] = "Test fixture — not real AI"

from app.services import provider  # noqa: E402


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
uvicorn.run("app.main:app", host="127.0.0.1", port=int(os.environ.get("TEST_PORT", "8000")))
