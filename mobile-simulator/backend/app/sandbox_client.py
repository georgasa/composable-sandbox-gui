"""Fires real HTTP requests at the Temenos sandbox. Same header/error-envelope
conventions verified working in Sandbox/01-demoflow.py and console-app's
execution/http_client.py: no auth headers, always companyId, errors can
appear as {"error":[...]} even under HTTP 200 (CLAUDE.md)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings

DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "companyId": settings.company_id,
}


@dataclass
class SandboxResult:
    ok: bool
    status_code: int | None
    data: Any
    errors: list[str]


def _unwrap(status_code: int, body: Any) -> tuple[bool, list[str]]:
    if isinstance(body, dict) and isinstance(body.get("error"), list):
        messages = [e.get("message", str(e)) if isinstance(e, dict) else str(e) for e in body["error"]]
        return False, messages
    # Party service returns errors as a bare top-level array (e.g.
    # [{"code":"PMS-00104","message":"..."}]), not the {"error":[...]}
    # envelope Deposits/Holdings use -- discovered live, not in CLAUDE.md.
    if isinstance(body, list) and body and isinstance(body[0], dict) and "message" in body[0]:
        return False, [e.get("message", str(e)) for e in body]
    if not (200 <= status_code < 300):
        return False, [f"HTTP {status_code}"]
    return True, []


async def call(
    method: str,
    url: str,
    json: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    timeout: float | None = None,
) -> SandboxResult:
    try:
        async with httpx.AsyncClient(timeout=timeout or settings.request_timeout_seconds) as client:
            response = await client.request(method, url, headers=DEFAULT_HEADERS, params=params, json=json)
    except httpx.TimeoutException:
        return SandboxResult(ok=False, status_code=None, data=None, errors=["Request timed out"])
    except httpx.ConnectError as exc:
        return SandboxResult(ok=False, status_code=None, data=None, errors=[f"Connection error: {exc}"])

    try:
        data = response.json() if response.text else None
    except ValueError:
        data = {"raw_response": response.text[:2000]}

    ok, errors = _unwrap(response.status_code, data)
    return SandboxResult(ok=ok, status_code=response.status_code, data=data, errors=errors)
