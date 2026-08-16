from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.catalog.request_builder import build_request
from app.llm.client import LLMError, generate_json
from app.llm.prompts import build_selection_prompt

router = APIRouter()

SHORTLIST_TOP_K = 6  # kept small: every extra candidate lengthens the prompt, which is
# the dominant cost on CPU-only inference (measured ~4-7 tok/s on the dev machine).


class AssistantQuery(BaseModel):
    message: str
    active_party_id: str | None = None


@router.post("/assistant/query")
async def assistant_query(req: AssistantQuery, request: Request):
    catalog = request.app.state.catalog
    environment = request.app.state.environment
    retriever = request.app.state.retriever

    candidates = retriever.shortlist(req.message, top_k=SHORTLIST_TOP_K)
    if not candidates:
        return {
            "matched": False,
            "message": "Nothing in the API catalog looks related to that -- try "
                       "rephrasing, or browse the catalog directly.",
        }

    prompt = build_selection_prompt(req.message, candidates)
    try:
        llm_result = await generate_json(prompt)
    except LLMError as exc:
        return {
            "matched": False,
            "message": f"The local assistant model is unavailable ({exc}). "
                       f"You can still use the catalog browser directly.",
            "candidates": [c.to_summary().model_dump(by_alias=True) for c in candidates],
        }

    index = llm_result.get("index")
    if index is None or not isinstance(index, int) or not (0 <= index < len(candidates)):
        return {
            "matched": False,
            "message": llm_result.get("clarifying_question")
                       or "Not confident enough to propose a specific API call for that -- "
                          "could you be more specific?",
            "candidates": [c.to_summary().model_dump(by_alias=True) for c in candidates],
        }
    op_key = candidates[index].op_key
    extracted_params = llm_result.get("extracted_params") or {}
    build_result = build_request(
        catalog, environment, op_key, extracted_params, active_party_id=req.active_party_id,
    )
    if build_result is None:
        # LLM hallucinated a key not in the shortlist -- treat as no match rather
        # than silently falling back to something the user didn't ask about.
        return {
            "matched": False,
            "message": "The assistant proposed an operation that isn't in the catalog. "
                       "Try rephrasing, or use the catalog browser directly.",
            "candidates": [c.to_summary().model_dump(by_alias=True) for c in candidates],
        }

    return {
        "matched": True,
        "confidence": llm_result.get("confidence"),
        "opKey": build_result.op.op_key,
        "summary": build_result.op.summary,
        "knownIssue": build_result.op.known_issue,
        "documented": build_result.op.documented,
        "preview": {
            "method": build_result.method,
            "url": build_result.url,
            "query": build_result.query,
            "body": build_result.body,
        },
        "missingRequired": build_result.missing_required,
        "autofilled": build_result.autofilled,
        "readyToExecute": len(build_result.missing_required) == 0,
        "pendingExecutionId": build_result.pending_execution_id,
    }
