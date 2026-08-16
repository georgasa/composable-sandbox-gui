"""The only route that ever calls the real sandbox. See
execution/pending_store.py for why this is the server-side enforcement of
"confirm before firing" -- a pendingExecutionId minted by /api/prepare or
/api/assistant/query is the only accepted input, never a raw operation."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.execution.http_client import execute_request
from app.execution.pending_store import pending_store

router = APIRouter()


class ExecuteRequest(BaseModel):
    pending_execution_id: str
    edited_body: dict[str, Any] | None = None
    edited_query: dict[str, Any] | None = None


@router.post("/execute")
async def execute(req: ExecuteRequest):
    pending = pending_store.take(req.pending_execution_id)
    if pending is None:
        raise HTTPException(
            status_code=410,
            detail="This proposed call has expired, already been sent, or was never "
                   "prepared. Go back and re-prepare the request.",
        )

    body = req.edited_body if req.edited_body is not None else pending.body
    query = req.edited_query if req.edited_query is not None else pending.query

    result = await execute_request(
        method=pending.method,
        url=pending.url,
        headers=pending.headers,
        query=query,
        body=body,
        timeout=pending.timeout,
    )

    return {
        "opKey": pending.op_key,
        "request": {"method": pending.method, "url": pending.url, "query": query, "body": body},
        "ok": result.ok,
        "statusCode": result.status_code,
        "data": result.data,
        "errors": result.errors,
        "durationMs": result.duration_ms,
    }


@router.get("/pending/{pending_execution_id}")
async def peek_pending(pending_execution_id: str):
    """Non-consuming lookup so the frontend can re-render a preview (e.g.
    after a page refresh) without spending the one-time token."""
    pending = pending_store.peek(pending_execution_id)
    if pending is None:
        raise HTTPException(status_code=404, detail="Unknown or expired pending execution")
    return {
        "opKey": pending.op_key,
        "method": pending.method,
        "url": pending.url,
        "query": pending.query,
        "body": pending.body,
    }
