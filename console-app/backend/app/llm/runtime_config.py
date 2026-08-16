"""Mutable, runtime-editable LLM provider config -- same pattern as
app/environment.py's EnvironmentStore, so the API key can be pasted into
the Environment modal and take effect immediately, no .env file edit or
code change needed. Held as a module-level singleton (same pattern as
execution/pending_store.py's pending_store) since the provider clients
(openai_client.py) need to read it without a request object to thread it
through.

Persisted to a small JSON file on a bind-mounted volume (PERSIST_PATH,
default /data/llm_config.json -- see docker-compose.yml's ./data:/data
mount), not just held in memory. An earlier version was memory-only and
lost the key on every backend container recreation, including ones
triggered by seemingly-unrelated frontend-only rebuilds -- observed live
in this session as "I saved the key and it's gone". The file lives outside
the built image (bind-mounted, .gitignore'd, never baked into a layer) --
same "never committed, never in the image" property as the old .env-only
approach, just durable across restarts instead of being wiped by every one.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, replace
from pathlib import Path
from threading import Lock

from app.config import settings

logger = logging.getLogger("console-app")


@dataclass(frozen=True)
class LLMRuntimeConfig:
    provider: str  # "openai" or "ollama"
    api_key: str
    model: str


class LLMConfigStore:
    def __init__(self, initial: LLMRuntimeConfig, persist_path: Path):
        self._path = persist_path
        self._lock = Lock()
        self._config = self._load_from_disk() or initial

    def get(self) -> LLMRuntimeConfig:
        with self._lock:
            return self._config

    def set(self, *, provider: str | None = None, api_key: str | None = None, model: str | None = None) -> None:
        """Each field is independently optional so the UI can update the
        model without re-pasting the key, or vice versa. Pass an empty
        string (not None) to explicitly clear a field."""
        with self._lock:
            current = self._config
            self._config = replace(
                current,
                provider=provider if provider is not None else current.provider,
                api_key=api_key if api_key is not None else current.api_key,
                model=model if model is not None else current.model,
            )
            self._save_to_disk(self._config)

    def _load_from_disk(self) -> LLMRuntimeConfig | None:
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            return LLMRuntimeConfig(**data)
        except FileNotFoundError:
            return None
        except (json.JSONDecodeError, TypeError) as exc:
            logger.warning("Ignoring unreadable %s: %s", self._path, exc)
            return None

    def _save_to_disk(self, config: LLMRuntimeConfig) -> None:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(json.dumps(asdict(config)), encoding="utf-8")
        except OSError as exc:
            # Persistence failing shouldn't break the running app -- the
            # key still works for this process's lifetime, it just won't
            # survive a restart. Surfaced in logs so it's not silent.
            logger.warning("Could not persist LLM config to %s: %s", self._path, exc)


llm_config_store = LLMConfigStore(
    LLMRuntimeConfig(
        provider=settings.llm_provider,
        api_key=settings.openai_api_key,  # only ever pre-seeded from a local .env, never committed
        model=settings.openai_model,
    ),
    persist_path=Path(settings.llm_config_path),
)
