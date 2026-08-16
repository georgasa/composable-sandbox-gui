from __future__ import annotations

from app.catalog.models import Operation

# Kept deliberately terse -- every extra token here is extra wall-clock
# time on CPU-only inference (measured ~4-7 tok/s on the dev machine, and
# worse under contention from other workloads sharing the same host). This
# app's safety property doesn't depend on prompt eloquence: nothing ever
# executes without a human clicking Confirm on the resolved preview, so the
# LLM only needs to be terse and roughly right, not exhaustively instructed.
SYSTEM_PREAMBLE = """Pick the best-matching operation for the user's request from the \
numbered list below, or null if none fit. Extract any parameter values the request \
states directly. Reply with ONLY this JSON, no other text:
{"index": <number or null>, "confidence": <0-1>, "extracted_params": {...}, "clarifying_question": <string or null>}
"""


def build_selection_prompt(user_message: str, candidates: list[Operation]) -> str:
    lines = []
    for i, op in enumerate(candidates):
        required = ",".join(p.name for p in op.parameters if p.required) or "-"
        lines.append(f"{i}. [{op.method}] {op.summary} (required: {required})")

    return (
        SYSTEM_PREAMBLE
        + "\nOperations:\n"
        + "\n".join(lines)
        + f'\n\nRequest: "{user_message}"\n\nJSON:'
    )
