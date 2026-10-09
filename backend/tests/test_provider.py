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
        assert request.url.params["key"] == "test-only-key"
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
    assert [row["id"] for row in provider.choices("basic")] == ["gemini-flash"]
    assert [row["id"] for row in provider.choices("pro")] == ["gemini-flash", "groq-fast"]
    get_settings.cache_clear()
