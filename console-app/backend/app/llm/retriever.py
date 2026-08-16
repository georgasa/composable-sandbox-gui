"""Shortlists candidate operations for a natural-language query before
handing them to the LLM. 322 operations won't fit usefully in a small
model's context, and banking queries ("create a savings account", "block
funds") tend to share vocabulary directly with operationId/summary/tags --
exactly what BM25 term-overlap scoring rewards, so it's the v1 default
(see plan). Kept behind a Protocol so an embeddings-based retriever can be
swapped in later without touching the callers.
"""

from __future__ import annotations

import re
from typing import Protocol

from rank_bm25 import BM25Okapi

from app.catalog.loader import Catalog
from app.catalog.models import Operation

_TOKEN_RE = re.compile(r"[a-zA-Z]+")


def _tokenize(text: str) -> list[str]:
    # split camelCase/PascalCase (operationId, path segments) into words too
    spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", text)
    return [t.lower() for t in _TOKEN_RE.findall(spaced)]


def _operation_text(op: Operation) -> str:
    return " ".join([
        op.operation_id, op.summary, op.description, op.service,
        op.path, " ".join(op.tags),
    ])


class Retriever(Protocol):
    def shortlist(self, query: str, top_k: int = 10) -> list[Operation]: ...


class BM25Retriever:
    def __init__(self, catalog: Catalog):
        self._ops = catalog.operations
        corpus = [_tokenize(_operation_text(op)) for op in self._ops]
        self._bm25 = BM25Okapi(corpus)

    def shortlist(self, query: str, top_k: int = 10) -> list[Operation]:
        tokens = _tokenize(query)
        if not tokens:
            return []
        scores = self._bm25.get_scores(tokens)
        ranked = sorted(zip(scores, self._ops), key=lambda pair: pair[0], reverse=True)
        return [op for score, op in ranked[:top_k] if score > 0]
