"""Lets the Environment modal's AI Assistant section read/write the LLM
provider config live -- see app/llm/runtime_config.py for why this is a
separate store rather than reusing EnvironmentStore (it persists to a
git-ignored local file so the key survives container rebuilds, and the
value itself must never be echoed back to the browser -- GET only ever
returns hasApiKey: bool)."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.llm.client import is_reachable
from app.llm.runtime_config import llm_config_store

router = APIRouter()


class LLMConfigPayload(BaseModel):
    provider: str | None = None
    api_key: str | None = None  # omit to leave unchanged; "" explicitly clears it
    model: str | None = None


def _serialize() -> dict:
    config = llm_config_store.get()
    return {
        "provider": config.provider,
        "model": config.model,
        # the key itself is never sent back to the browser, only whether one is set
        "hasApiKey": bool(config.api_key),
    }


@router.get("/llm-config")
async def get_llm_config():
    return _serialize()


@router.put("/llm-config")
async def update_llm_config(payload: LLMConfigPayload):
    llm_config_store.set(provider=payload.provider, api_key=payload.api_key, model=payload.model)
    return _serialize()


@router.post("/llm-config/test")
async def test_llm_config():
    ok = await is_reachable()
    return {"ok": ok}
