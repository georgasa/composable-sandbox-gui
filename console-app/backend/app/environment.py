"""Mutable, runtime-editable sandbox environment.

The four service base URLs all follow the same host-naming pattern on this
sandbox family: {optional service prefix-}{prefix}{seed}.{region}.cloudapp.azure.com.
Confirmed against the live "Composable Explorer" tool's own Settings screen
and this workspace's CLAUDE.md:
  Deposits: http://deposits-{prefix}{seed}.{region}.cloudapp.azure.com/irf-deposits-container/api/v1.0.0
  Holdings: http://{prefix}{seed}.{region}.cloudapp.azure.com/ms-holdings-api/api/v1.0.0
  Party:    http://{prefix}{seed}.{region}.cloudapp.azure.com/ms-party-api/api/v5.0.0
  Lending:  http://lending-{prefix}{seed}.{region}.cloudapp.azure.com/irf-lending-container/api/v1.0.0

Note: the reference tool's Settings screen shows a "Transact Lending API
(v8)" endpoint (transact-{prefix}{seed}.../irf-provider-container/api/v8.0.0)
instead -- that's a different, newer API this workspace has no OpenAPI spec
for (flagged as out of scope during planning). This app's Lending catalog is
built from the v1 holdings-loans-service spec, so it derives the matching
v1 "lending-" host instead, not the v8 "transact-" one.

Held as a single mutable object behind a lock rather than reloaded Settings,
since it needs to change at runtime from a UI action (PUT /api/environment)
without restarting the process -- unlike the rest of app/config.py, which
is fixed for the process lifetime.
"""

from __future__ import annotations

from dataclasses import dataclass
from threading import Lock


@dataclass(frozen=True)
class EnvironmentConfig:
    label: str
    prefix: str
    seed: str
    region: str

    def base_urls(self) -> dict[str, str]:
        host = f"{self.prefix}{self.seed}.{self.region}.cloudapp.azure.com"
        return {
            "Deposits": f"http://deposits-{host}/irf-deposits-container/api/v1.0.0",
            "Holdings": f"http://{host}/ms-holdings-api/api/v1.0.0",
            "Party": f"http://{host}/ms-party-api/api/v5.0.0",
            "Lending": f"http://lending-{host}/irf-lending-container/api/v1.0.0",
        }


DEFAULT_ENVIRONMENT = EnvironmentConfig(
    label="aekxuia (R26.04)", prefix="aekxuia", seed="0951", region="westeurope"
)


class EnvironmentStore:
    def __init__(self, initial: EnvironmentConfig = DEFAULT_ENVIRONMENT):
        self._env = initial
        self._lock = Lock()

    def get(self) -> EnvironmentConfig:
        with self._lock:
            return self._env

    def set(self, env: EnvironmentConfig) -> None:
        with self._lock:
            self._env = env

    def base_url_for(self, service: str) -> str:
        urls = self.get().base_urls()
        if service not in urls:
            raise KeyError(f"No base URL configured for service {service!r}")
        return urls[service]
