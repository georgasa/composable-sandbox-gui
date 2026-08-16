"""In-memory, one-time-use store for prepared-but-not-yet-executed requests.

This is the server-side half of the "confirm before firing" guarantee: POST
/api/execute only ever accepts a pending_execution_id minted here by
/api/prepare or /api/assistant/query, never a raw operation+params body. A
token is consumed on first use and expires after a short TTL, so neither an
LLM's output nor a replayed request can cause a second real call.

In-process memory means the backend Deployment MUST run with replicas: 1
(see console-app/k8s/05-backend-deployment.yaml) -- fine for a single-user
local tool; would need an external store (Redis) to scale beyond that.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from threading import Lock
from typing import Any

from app.config import settings


@dataclass
class PendingExecution:
    op_key: str
    method: str
    url: str
    headers: dict[str, str]
    body: dict[str, Any] | None
    query: dict[str, Any]
    timeout: float
    created_at: float = field(default_factory=time.monotonic)
    consumed: bool = False


class PendingStore:
    def __init__(self, ttl_seconds: int | None = None):
        self._ttl = ttl_seconds or settings.pending_execution_ttl_seconds
        self._items: dict[str, PendingExecution] = {}
        self._lock = Lock()

    def put(self, pending: PendingExecution) -> str:
        token = uuid.uuid4().hex
        with self._lock:
            self._evict_expired()
            self._items[token] = pending
        return token

    def take(self, token: str) -> PendingExecution | None:
        """Consume a token: returns it once, then it's gone (expired, used,
        or unknown all look the same to the caller -- None)."""
        with self._lock:
            self._evict_expired()
            item = self._items.pop(token, None)
        if item is None or item.consumed:
            return None
        item.consumed = True
        return item

    def peek(self, token: str) -> PendingExecution | None:
        """Non-consuming read, for the UI to re-render a preview."""
        with self._lock:
            self._evict_expired()
            return self._items.get(token)

    def _evict_expired(self) -> None:
        now = time.monotonic()
        expired = [t for t, p in self._items.items() if now - p.created_at > self._ttl]
        for t in expired:
            del self._items[t]


pending_store = PendingStore()
