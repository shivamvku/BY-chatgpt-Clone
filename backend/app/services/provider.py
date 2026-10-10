import base64
import json
import re
from collections.abc import AsyncIterator

import httpx

from app.core.config import get_settings

# ---------------------------------------------------------------------------
# Model catalogue
# Each entry keeps the stable API model identifier separate from the UI identifier.
# Stored message model IDs remain stable when a provider retires a model.
# ---------------------------------------------------------------------------
DEFAULT_MODEL = "gemini-flash"

MODELS: dict[str, dict] = {
    "gemini-flash": {
        "name": "Gemini 2.5 Flash",
        "provider": "gemini",
        "plans": {"basic", "pro", "pro_max"},
        "priority": 10,
        "api_model": "gemini-2.5-flash",
    },
    "groq-fast": {
        "name": "Groq · GPT-OSS 20B",
        "provider": "groq",
        "plans": {"pro", "pro_max"},
        "priority": 20,
        "api_model": "openai/gpt-oss-20b",
    },
}

# Keep legacy IDs working so existing messages stored with old model strings
# still resolve to a valid provider call.
_LEGACY_ALIAS: dict[str, str] = {
    "gemini-3.5-flash": "gemini-flash",
    "gemini-3.6-flash": "gemini-flash",
    "gemini-3.7-flash": "gemini-flash",
    "gemini-3.8-flash": "gemini-flash",
    "gemini-3.1-flash-lite": "gemini-flash",
    "groq-qwen3-27b": "groq-fast",
    "groq-gpt-oss-120b": "groq-fast",
    "groq-gpt-oss-20b": "groq-fast",
    # Any stored 'auto' model messages fall back to the default Gemini model
    "auto": DEFAULT_MODEL,
}


def _resolve(model_id: str) -> str:
    """Resolve a model_id to a canonical entry, following legacy aliases."""
    return _LEGACY_ALIAS.get(model_id, model_id)


def _provider_available(model_id: str) -> bool:
    """True if the underlying provider key is configured for this model."""
    settings = get_settings()
    entry = MODELS.get(model_id, {})
    provider = entry.get("provider")
    if provider == "gemini":
        return bool(settings.gemini_api_key)
    if provider == "groq":
        return bool(settings.groq_api_key)
    return False


def choices(plan_id: str) -> list[dict[str, object]]:
    """Return model choices for a plan, ordered by priority. No 'auto' entry."""
    result = []
    for model_id, definition in sorted(MODELS.items(), key=lambda kv: kv[1].get("priority", 99)):
        if plan_id not in definition["plans"]:
            continue
        available = _provider_available(model_id)
        result.append(
            {
                "id": model_id,
                "name": definition["name"],
                "provider": definition["provider"],
                "available": available,
            }
        )
    return result


def resolve_auto(plan_id: str) -> str:
    """Pick the highest-priority available model for the plan."""
    candidates = [
        (defn.get("priority", 99), mid)
        for mid, defn in MODELS.items()
        if plan_id in defn["plans"]
        and _provider_available(mid)
    ]
    if not candidates:
        raise ValueError("The selected AI model is unavailable")
    return min(candidates)[1]


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------

async def _groq(messages: list[dict], groq_model: str) -> AsyncIterator[str]:
    settings = get_settings()
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(60, connect=10), follow_redirects=False
    ) as client:
        async with client.stream(
            "POST",
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={
                "model": groq_model,
                "messages": messages,
                "stream": True,
                "max_completion_tokens": settings.max_output_tokens,
            },
        ) as response:
            response.raise_for_status()
            content_yielded = False
            async for line in response.aiter_lines():
                if len(line) > 262144:
                    raise ValueError("Provider event exceeded limit")
                if not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if raw == "[DONE]":
                    break
                event = json.loads(raw)
                text = (event.get("choices") or [{}])[0].get("delta", {}).get("content")
                if text:
                    content_yielded = True
                    yield text
            # Only raise if the stream closed before sending any content — a
            # clean close after content (Groq sometimes omits the final [DONE])
            # is not an error.
            if not content_yielded:
                raise ValueError("Provider stream ended before completion")


ATTACHMENT_MARKDOWN = re.compile(r"!\[[^\]]*\]\(/api/files/[0-9a-f-]{36}\)")


async def _gemini(messages: list[dict], gemini_model: str) -> AsyncIterator[str]:
    settings = get_settings()
    contents = []
    for item in messages:
        if item["role"] == "system":
            continue
        text = ATTACHMENT_MARKDOWN.sub("[Attached image]", item["content"])
        parts = [{"text": text}]
        if item["role"] == "user":
            parts.extend(
                {
                    "inline_data": {
                        "mime_type": image["media_type"],
                        "data": base64.b64encode(image["data"]).decode("ascii"),
                    }
                }
                for image in item.get("images", [])
            )
        contents.append(
            {"role": "model" if item["role"] == "assistant" else "user", "parts": parts}
        )
    system = next((item["content"] for item in messages if item["role"] == "system"), "")
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(60, connect=10), follow_redirects=False
    ) as client:
        async with client.stream(
            "POST",
            f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:streamGenerateContent",
            # Use the x-goog-api-key request header instead of a URL query
            # parameter so the key is never recorded in access logs or
            # exception messages that include the full request URL.
            params={"alt": "sse"},
            headers={"x-goog-api-key": settings.gemini_api_key},
            json={
                "contents": contents,
                "systemInstruction": {"parts": [{"text": system}]},
                "generationConfig": {"maxOutputTokens": settings.max_output_tokens},
            },
        ) as response:
            response.raise_for_status()
            content_yielded = False
            async for line in response.aiter_lines():
                if len(line) > 262144:
                    raise ValueError("Provider event exceeded limit")
                if not line.startswith("data:"):
                    continue
                event = json.loads(line[5:].strip())
                for part in (
                    (event.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
                ):
                    if text := part.get("text"):
                        content_yielded = True
                        yield text
            if not content_yielded:
                raise ValueError("Provider stream ended before completion")


async def stream_completion(
    messages: list[dict], model_id: str
) -> AsyncIterator[str]:
    """Stream a completion. Resolves legacy aliases before dispatching."""
    canonical = _resolve(model_id)

    entry = MODELS.get(canonical)
    if not entry:
        raise ValueError("The selected AI model is unavailable")

    provider = entry["provider"]

    if provider == "gemini" and get_settings().gemini_api_key:
        async for text in _gemini(messages, entry["api_model"]):
            yield text
        return

    if provider == "groq" and get_settings().groq_api_key:
        async for text in _groq(messages, entry["api_model"]):
            yield text
        return

    raise ValueError("The selected AI model is unavailable")
