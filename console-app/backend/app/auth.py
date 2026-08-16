"""Shared-password gate for the publicly-reachable Azure deployment.

Local Docker Compose / Rancher dev runs with AUTH_MODE=none (default) and
this is a complete no-op. On Azure, AUTH_MODE=password: the underlying
Temenos sandbox has no auth of its own, so this app is the only thing
between the open internet and a shared, mutable sandbox -- see CLAUDE.md
"Authentication" note. Deliberately no session DB / user accounts: one
shared demo password, an HMAC-signed cookie with an expiry, stdlib only
(hmac/hashlib), same "small, dependency-free, file/env-driven" pattern as
llm/runtime_config.py and environment.py elsewhere in this app.
"""

from __future__ import annotations

import hashlib
import hmac
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings

COOKIE_NAME = "console_session"
SESSION_TTL_SECONDS = 12 * 60 * 60  # 12h -- long enough for a demo session, short enough to not linger forever
_OPEN_PATHS = ("/healthz", "/api/auth/")


def _secret() -> str:
    # Derived from the demo password itself so no separate secret needs to
    # be provisioned/rotated -- fine for a lightweight demo gate, not a
    # substitute for real per-user auth.
    return hashlib.sha256(settings.demo_password.encode("utf-8")).hexdigest()


def issue_token() -> str:
    expiry = str(int(time.time()) + SESSION_TTL_SECONDS)
    sig = hmac.new(_secret().encode("utf-8"), expiry.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{expiry}.{sig}"


def verify_token(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    expiry, _, sig = token.partition(".")
    if not expiry.isdigit() or int(expiry) < time.time():
        return False
    expected = hmac.new(_secret().encode("utf-8"), expiry.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected)


def check_password(password: str) -> bool:
    return hmac.compare_digest(password, settings.demo_password)


class AuthGateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if settings.auth_mode != "password":
            return await call_next(request)
        if any(request.url.path.startswith(p) for p in _OPEN_PATHS):
            return await call_next(request)
        if verify_token(request.cookies.get(COOKIE_NAME)):
            return await call_next(request)
        return JSONResponse({"error": [{"code": "AUTH-000", "message": "Not authenticated"}]}, status_code=401)
