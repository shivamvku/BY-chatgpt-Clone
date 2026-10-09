import httpx
import pytest

from app.core.config import get_settings
from app.services import provider


@pytest.mark.parametrize(
    "payload",
    [
        b'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n',
        b'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
    ],
)
def test_provider_protocol(monkeypatch, payload):
    import asyncio

    monkeypatch.setenv("LLM_ENDPOINT", "https://example.invalid/openai/v1")
    monkeypatch.setenv("LLM_MODEL", "test-deployment")
    monkeypatch.setenv("LLM_API_KEY", "test-only-token")
    get_settings.cache_clear()
    original = httpx.AsyncClient

    def handler(request):
        assert request.url.path == "/openai/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer test-only-token"
        return httpx.Response(200, content=payload)

    monkeypatch.setattr(
        provider.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs),
    )

    async def collect():
        return [
            delta
            async for delta in provider.stream_completion([{"role": "user", "content": "hello"}])
        ]

    if b"[DONE]" in payload:
        assert asyncio.run(collect()) == ["hello"]
    else:
        with pytest.raises(ValueError, match="before completion"):
            asyncio.run(collect())
    get_settings.cache_clear()
