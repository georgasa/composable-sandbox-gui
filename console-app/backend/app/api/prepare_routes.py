from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.catalog.request_builder import build_request

router = APIRouter()


class PrepareRequest(BaseModel):
    op_key: str
    params: dict[str, Any] = {}
    base_url_override: str | None = None
    active_party_id: str | None = None


@router.post("/prepare")
async def prepare(req: PrepareRequest, request: Request):
    catalog = request.app.state.catalog
    environment = request.app.state.environment
    result = build_request(
        catalog, environment, req.op_key, req.params, req.base_url_override,
        active_party_id=req.active_party_id,
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"Unknown operation: {req.op_key}")

    return {
        "pendingExecutionId": result.pending_execution_id,
        "opKey": result.op.op_key,
        "summary": result.op.summary,
        "knownIssue": result.op.known_issue,
        "documented": result.op.documented,
        "preview": {
            "method": result.method,
            "url": result.url,
            "query": result.query,
            "body": result.body,
        },
        "missingRequired": result.missing_required,
        "autofilled": result.autofilled,
        "readyToExecute": len(result.missing_required) == 0,
    }
