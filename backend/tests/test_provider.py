import asyncio

import httpx

from app.core.config import get_settings
from app.services import provider


def test_gemini_protocol(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-only-key")
    get_settings.cache_clear()
    original = httpx.AsyncClient

    def handler(request):
        assert request.url.path.endswith(":streamGenerateContent")
        assert "/gemini-2.5-flash:" in request.url.path
        # Key is sent via header, not query param (see x-goog-api-key usage in provider)
        assert request.headers["x-goog-api-key"] == "test-only-key"
        payload = (
            b'data: {"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}\n\n'
            b'data: {"candidates":[{"content":{"parts":[{"text":" world"}]}}]}\n\n'
        )
        return httpx.Response(200, content=payload)

    monkeypatch.setattr(
        provider.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )

    async def collect():
        return [
            text
            async for text in provider.stream_completion(
                [{"role": "user", "content": "hello"}], "gemini-flash"
            )
        ]

    assert asyncio.run(collect()) == ["hello", " world"]
    get_settings.cache_clear()


def test_groq_protocol_and_plan_catalog(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-only-key")
    get_settings.cache_clear()
    original = httpx.AsyncClient

    def handler(request):
        assert request.url.host == "api.groq.com"
        assert request.headers["authorization"] == "Bearer test-only-key"
        return httpx.Response(
            200, content=b'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n'
        )

    monkeypatch.setattr(
        provider.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )

    async def collect():
        return [
            text
            async for text in provider.stream_completion(
                [{"role": "user", "content": "hello"}], "groq-fast"
            )
        ]

    assert asyncio.run(collect()) == ["hello"]
    # Basic includes all available models now: Gemini Flash, Gemini Pro, Groq Fast, Groq Mixtral
    ids = [row["id"] for row in provider.choices("basic")]
    expected_basic = ["gemini-flash", "gemini-pro", "groq-fast", "groq-mixtral"]
    assert ids == expected_basic
    assert [row["id"] for row in provider.choices("pro")] == expected_basic
    get_settings.cache_clear()


def test_choices_no_auto():
    """The 'auto' virtual model must never appear in the choices list."""
    for plan in ("basic", "pro", "pro_max"):
        ids = [row["id"] for row in provider.choices(plan)]
        assert "auto" not in ids


def test_gemini_empty_stream_fails(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-only-key")
    get_settings.cache_clear()
    original = httpx.AsyncClient
    monkeypatch.setattr(
        provider.httpx,
        "AsyncClient",
        lambda **kwargs: original(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, content=b"data: {}\n\n")
            ),
            **kwargs,
        ),
    )

    async def collect():
        return [
            text
            async for text in provider.stream_completion(
                [{"role": "user", "content": "hello"}], "gemini-flash"
            )
        ]

    try:
        asyncio.run(collect())
    except ValueError as error:
        assert str(error) == "Provider stream ended before completion"
    else:
        raise AssertionError("Empty Gemini streams must fail")
    get_settings.cache_clear()
