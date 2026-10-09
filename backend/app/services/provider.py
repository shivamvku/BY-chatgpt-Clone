import json
from collections.abc import AsyncIterator
from urllib.parse import urlparse

import httpx
from azure.identity.aio import DefaultAzureCredential

from app.core.config import get_settings


async def stream_completion(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    settings = get_settings()
    endpoint = settings.llm_endpoint.rstrip("/")
    url = urlparse(endpoint)
    if url.scheme != "https" or not url.hostname or url.username or url.query:
        raise ValueError("LLM_ENDPOINT must be a configured HTTPS base URL")
    credential = None
    try:
        if settings.llm_api_key:
            token = settings.llm_api_key
        else:
            credential = DefaultAzureCredential(managed_identity_client_id=settings.azure_client_id)
            token = (
                await credential.get_token("https://cognitiveservices.azure.com/.default")
            ).token
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(45, connect=10), follow_redirects=False
        ) as client:
            async with client.stream(
                "POST",
                f"{endpoint}/chat/completions",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "model": settings.llm_model,
                    "messages": messages,
                    "stream": True,
                    "max_completion_tokens": settings.max_output_tokens,
                },
            ) as response:
                response.raise_for_status()
                complete = False
                async for line in response.aiter_lines():
                    if len(line) > 262144:
                        raise ValueError("Provider event exceeded limit")
                    if not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if raw == "[DONE]":
                        complete = True
                        break
                    event = json.loads(raw)
                    if event.get("error"):
                        raise ValueError("Provider returned an error")
                    choices = event.get("choices", [])
                    if not choices:
                        continue
                    text = choices[0].get("delta", {}).get("content")
                    if text:
                        yield text
                if not complete:
                    raise ValueError("Provider stream ended before completion")
    finally:
        if credential:
            await credential.close()
