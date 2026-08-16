"""Thin client for the local Ollama instance deployed alongside this app
(see console-app/k8s/03-ollama-deployment.yaml). Model/base URL are
ConfigMap-driven (OLLAMA_BASE_URL, OLLAMA_MODEL), not hardcoded, matching
the "start local, swap later" approach the user chose for the AI backend.
"""

from __future__ import annotations

import json
from typing import Any

import httpx

from app.config import settings
from app.llm.errors import LLMError


async def is_reachable(timeout: float = 3.0) -> bool:
    """Cheap reachability check (Ollama's own /api/tags is fast regardless
    of model size/load state) so a genuinely-down Ollama fails in ~3s
    instead of making the caller wait out the full generation timeout --
    that's what made the assistant feel "stuck" before this was added."""
    url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
            return response.status_code == 200
    except httpx.HTTPError:
        return False


async def generate_json(prompt: str, *, timeout: float = 30.0) -> dict[str, Any]:
    """Calls Ollama in JSON mode and parses the result. Raises LLMError
    on any failure (unreachable, non-JSON output, etc.) -- callers should
    treat that as "assistant couldn't confidently propose a call" and fall
    back to asking the user to clarify or use the catalog browser directly,
    never as a reason to skip the confirm-before-execute gate.

    Callers should check is_reachable() first for a fast failure path;
    this function's timeout is sized for actually waiting on a generation,
    not for detecting a down service."""
    if not await is_reachable():
        raise LLMError(f"Ollama at {settings.ollama_base_url} is not reachable")

    url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "format": "json",
        "stream": False,
        # num_predict caps output length -- the JSON response is always
        # short, so this bounds worst-case generation time regardless of
        # what the model might otherwise ramble on with.
        "options": {"temperature": 0.1, "num_predict": 200},
        # Keep the model resident in memory between requests -- Ollama
        # unloads it after ~5 minutes idle by default, and reloading a
        # multi-GB model from disk adds tens of seconds to the next query.
        "keep_alive": "30m",
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach Ollama at {url}: {exc}") from exc

    body = response.json()
    raw_text = body.get("response", "")
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise LLMError(f"Ollama did not return valid JSON: {raw_text[:300]}") from exc
