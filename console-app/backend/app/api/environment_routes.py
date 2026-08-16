"""Lets the console point at a different sandbox instance (e.g. a fresh
aekxuia rebuild with a new seed) without a redeploy -- just edit
label/prefix/seed/region and every operation's resolved URL updates on the
next request, since request_builder.py resolves base URLs live from this
store rather than baking them into the catalog at startup.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.environment import EnvironmentConfig

router = APIRouter()


class EnvironmentPayload(BaseModel):
    label: str
    prefix: str
    seed: str
    region: str


def _serialize(env: EnvironmentConfig) -> dict:
    return {
        "label": env.label,
        "prefix": env.prefix,
        "seed": env.seed,
        "region": env.region,
        "baseUrls": env.base_urls(),
    }


@router.get("/environment")
async def get_environment(request: Request):
    return _serialize(request.app.state.environment.get())


@router.put("/environment")
async def update_environment(payload: EnvironmentPayload, request: Request):
    new_env = EnvironmentConfig(
        label=payload.label.strip(),
        prefix=payload.prefix.strip(),
        seed=payload.seed.strip(),
        region=payload.region.strip(),
    )
    request.app.state.environment.set(new_env)
    return _serialize(new_env)


class TestRequest(BaseModel):
    url: str


@router.post("/environment/test")
async def test_endpoint(payload: TestRequest):
    """Quick reachability probe for a base URL -- proxied through the
    backend rather than called from the browser, since the sandbox hosts
    don't send CORS headers. Takes the URL directly (not a service name) so
    the UI can test what's currently typed in the form before saving, not
    just the last-saved environment. Any HTTP response (even a 404) counts
    as reachable; only a connection-level failure counts as down."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(payload.url)
        return {"ok": True, "statusCode": response.status_code}
    except httpx.HTTPError as exc:
        return {"ok": False, "message": str(exc)}
