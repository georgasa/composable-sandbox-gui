"""GET /api/auth/status + POST /api/auth/login + POST /api/auth/logout --
the frontend gate screen (EnvironmentModal's sibling, shown before the app
when auth is required) talks to these. See app/auth.py for the actual
verification logic; this module is just the HTTP surface."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.auth import COOKIE_NAME, SESSION_TTL_SECONDS, check_password, issue_token, verify_token
from app.config import settings

router = APIRouter()


class LoginPayload(BaseModel):
    password: str


@router.get("/auth/status")
async def auth_status(request: Request):
    required = settings.auth_mode == "password"
    authenticated = (not required) or verify_token(request.cookies.get(COOKIE_NAME))
    return {"authRequired": required, "authenticated": authenticated}


@router.post("/auth/login")
async def login(payload: LoginPayload, response: Response):
    if settings.auth_mode != "password":
        return {"ok": True}
    if not check_password(payload.password):
        response.status_code = 401
        return {"ok": False, "error": [{"code": "AUTH-001", "message": "Incorrect password"}]}
    response.set_cookie(
        COOKIE_NAME,
        issue_token(),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
    )
    return {"ok": True}


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}
