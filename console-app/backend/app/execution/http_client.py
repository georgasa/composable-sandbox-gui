"""Fires real HTTP requests at the sandbox. Mirrors the exact header/timeout
conventions verified working in Sandbox/01-demoflow.py's make_api_call --
no auth headers, always companyId, generous timeouts for lending creates.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings
from app.execution.sandbox_rules import unwrap_response

DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "companyId": settings.company_id,
}


@dataclass
class ExecutionResult:
    ok: bool
    status_code: int | None
    data: Any
    errors: list[str]
    duration_ms: int


async def execute_request(
    method: str,
    url: str,
    headers: dict[str, str] | None,
    query: dict[str, Any] | None,
    body: dict[str, Any] | None,
    timeout: float,
) -> ExecutionResult:
    merged_headers = {**DEFAULT_HEADERS, **(headers or {})}
    started = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(
                method,
                url,
                headers=merged_headers,
                params=query or None,
                json=body if method in ("POST", "PUT", "DELETE") and body else None,
            )
    except httpx.TimeoutException:
        return ExecutionResult(
            ok=False, status_code=None, data=None,
            errors=[f"Request timed out after {timeout}s"],
            duration_ms=int((time.monotonic() - started) * 1000),
        )
    except httpx.ConnectError as exc:
        return ExecutionResult(
            ok=False, status_code=None, data=None,
            errors=[f"Connection error: {exc}"],
            duration_ms=int((time.monotonic() - started) * 1000),
        )

    duration_ms = int((time.monotonic() - started) * 1000)

    try:
        data = response.json() if response.text else None
    except ValueError:
        data = {"raw_response": response.text[:2000]}

    ok, errors = unwrap_response(response.status_code, data)
    return ExecutionResult(
        ok=ok, status_code=response.status_code, data=data,
        errors=errors, duration_ms=duration_ms,
    )
