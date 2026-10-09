import json
from collections.abc import AsyncIterator

import httpx

from app.core.config import get_settings

MODELS = {
    "gemini-flash": {"name": "Gemini 2.5 Flash", "plans": {"basic", "pro", "pro_max"}},
    "groq-fast": {"name": "Groq · Llama 3.3 70B", "plans": {"pro", "pro_max"}},
}


def choices(plan_id: str) -> list[dict[str, object]]:
    settings = get_settings()
    configured = {
        "gemini-flash": bool(settings.gemini_api_key),
        "groq-fast": bool(settings.groq_api_key),
    }
    return [
        {"id": model_id, "name": definition["name"], "available": configured[model_id]}
        for model_id, definition in MODELS.items()
        if plan_id in definition["plans"]
    ]


async def _groq(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    settings = get_settings()
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(60, connect=10), follow_redirects=False
    ) as client:
        async with client.stream(
            "POST",
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={
                "model": settings.groq_model,
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
                text = (event.get("choices") or [{}])[0].get("delta", {}).get("content")
                if text:
                    yield text
            if not complete:
                raise ValueError("Provider stream ended before completion")


async def _gemini(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    settings = get_settings()
    contents = [
        {
            "role": "model" if item["role"] == "assistant" else "user",
            "parts": [{"text": item["content"]}],
        }
        for item in messages
        if item["role"] != "system"
    ]
    system = next((item["content"] for item in messages if item["role"] == "system"), "")
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(60, connect=10), follow_redirects=False
    ) as client:
        async with client.stream(
            "POST",
            f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:streamGenerateContent",
            params={"alt": "sse", "key": settings.gemini_api_key},
            json={
                "contents": contents,
                "systemInstruction": {"parts": [{"text": system}]},
                "generationConfig": {"maxOutputTokens": settings.max_output_tokens},
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                event = json.loads(line[5:].strip())
                for part in (
                    (event.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
                ):
                    if text := part.get("text"):
                        yield text


async def stream_completion(messages: list[dict[str, str]], model_id: str) -> AsyncIterator[str]:
    if model_id == "gemini-flash" and get_settings().gemini_api_key:
        async for text in _gemini(messages):
            yield text
        return
    if model_id == "groq-fast" and get_settings().groq_api_key:
        async for text in _groq(messages):
            yield text
        return
    raise ValueError("The selected AI model is unavailable")
