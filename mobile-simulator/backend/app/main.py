from __future__ import annotations

import logging

from fastapi import FastAPI

from app.api import auth_routes, mobile_routes
from app.auth import AuthGateMiddleware

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Mobile Banking Simulator")

app.add_middleware(AuthGateMiddleware)

app.include_router(auth_routes.router, prefix="/api")
app.include_router(mobile_routes.router, prefix="/api")


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
