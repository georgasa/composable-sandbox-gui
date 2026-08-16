"""Dispatches to whichever LLM provider is configured at runtime (see
llm_config_store in runtime_config.py, editable live from the Environment
modal's AI Assistant section). assistant_routes.py imports only this
module, never the provider-specific ones directly, so switching providers
is a settings change, not a code change or restart."""

from __future__ import annotations

from typing import Any

from app.llm import ollama_client, openai_client
from app.llm.errors import LLMError
from app.llm.runtime_config import llm_config_store

__all__ = ["LLMError", "is_reachable", "generate_json"]


def _provider():
    return ollama_client if llm_config_store.get().provider == "ollama" else openai_client


async def is_reachable(timeout: float = 3.0) -> bool:
    return await _provider().is_reachable(timeout=timeout)


async def generate_json(prompt: str, *, timeout: float = 30.0) -> dict[str, Any]:
    return await _provider().generate_json(prompt, timeout=timeout)
