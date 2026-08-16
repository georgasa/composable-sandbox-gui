"""OpenAI-backed LLM client -- same generate_json(prompt) contract as
ollama_client.py, so assistant_routes.py can call whichever provider is
configured (see app/llm/client.py) without caring which one it is.

Reads from llm_config_store (app/llm/runtime_config.py), not static
settings, so pasting a key into the Environment modal's AI Assistant
section takes effect immediately -- no .env file, no rebuild, no restart.
"""

from __future__ import annotations

import json
from typing import Any

import httpx

from app.config import settings
from app.llm.errors import LLMError
from app.llm.runtime_config import llm_config_store


async def is_reachable(timeout: float = 3.0) -> bool:
    """A real check, not just "is a key present" -- calls OpenAI's cheap
    /models endpoint with the configured key, since a present-but-wrong key
    is exactly the failure mode the Environment modal's Test button needs
    to catch before the user finds out mid-query."""
    config = llm_config_store.get()
    if not config.api_key:
        return False
    url = f"{settings.openai_base_url.rstrip('/')}/models"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, headers={"Authorization": f"Bearer {config.api_key}"})
            return response.status_code == 200
    except httpx.HTTPError:
        return False


async def generate_json(prompt: str, *, timeout: float = 30.0) -> dict[str, Any]:
    config = llm_config_store.get()
    if not config.api_key:
        raise LLMError("No OpenAI API key configured -- add one in Environment → AI Assistant")

    url = f"{settings.openai_base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": config.model,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
    }
    headers = {"Authorization": f"Bearer {config.api_key}"}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        # surface the API's own error message (e.g. invalid key, rate limit)
        # rather than just the status code
        detail = exc.response.text[:300]
        raise LLMError(f"OpenAI API error {exc.response.status_code}: {detail}") from exc
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach OpenAI at {url}: {exc}") from exc

    body = response.json()
    try:
        raw_text = body["choices"][0]["message"]["content"]
        return json.loads(raw_text)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise LLMError(f"OpenAI did not return valid JSON: {str(body)[:300]}") from exc
