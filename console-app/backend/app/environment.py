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

base_url_overrides lets an environment bypass the prefix/seed/region Azure
hostname template entirely for one or more services -- needed for the
"Local WSL" preset, which points at a real modular Composable Banking stack
(Deposits, Lending, Holdings, Party, ...) running as k3s pods on this same
machine's WSL Ubuntu distro rather than an Azure-hosted sandbox. Those pods'
NodePort/LoadBalancer ports were confirmed live via `kubectl get svc -A`
and curled directly (HMS-0003/PMS-00104-style real T24 errors came back,
not framework 404s) -- see console_backend's PRESETS below for the exact
verified URLs. `host.docker.internal` (added via docker-compose.yml's
extra_hosts: host-gateway) resolves to the WSL VM's own address from inside
this container, which is where k3s's NodePorts are bound.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock


@dataclass(frozen=True)
class EnvironmentConfig:
    label: str
    prefix: str
    seed: str
    region: str
    base_url_overrides: dict[str, str] = field(default_factory=dict)

    def base_urls(self) -> dict[str, str]:
        host = f"{self.prefix}{self.seed}.{self.region}.cloudapp.azure.com"
        urls = {
            "Deposits": f"http://deposits-{host}/irf-deposits-container/api/v1.0.0",
            "Holdings": f"http://{host}/ms-holdings-api/api/v1.0.0",
            "Party": f"http://{host}/ms-party-api/api/v5.0.0",
            "Lending": f"http://lending-{host}/irf-lending-container/api/v1.0.0",
        }
        urls.update(self.base_url_overrides)
        return urls


AEKXUIA_ENVIRONMENT = EnvironmentConfig(
    label="aekxuia (R26.04)", prefix="aekxuia", seed="0951", region="westeurope"
)

# Verified live 2026-09-30 against this machine's own WSL Ubuntu distro
# (native Docker Engine, no Rancher/Podman) running a k3s cluster with the
# real modular Composable Banking microservices. Each URL below returned a
# genuine T24-level application error (not a 404), confirming both the port
# and the API context path:
#   deposits (30020)  -> HMS-0003 "Account Record Not Found"
#   lending  (30030)  -> HMS-0003 "Account Record Not Found"
#   holdings (8001)   -> HMS-0003 "Account Record Not Found"
#   party    (8021)   -> PMS-00104 "Existing Party record ... not found"
# `host.docker.internal` needs docker-compose.yml's
# extra_hosts: ["host.docker.internal:host-gateway"] to resolve -- see there.
LOCAL_WSL_ENVIRONMENT = EnvironmentConfig(
    label="Local WSL (k3s modular pack)",
    prefix="local",
    seed="0000",
    region="local",
    base_url_overrides={
        "Deposits": "http://host.docker.internal:30020/irf-deposits-container/api/v1.0.0",
        "Holdings": "http://host.docker.internal:8001/ms-holdings-api/api/v1.0.0",
        "Party": "http://host.docker.internal:8021/ms-party-api/api/v5.0.0",
        "Lending": "http://host.docker.internal:30030/irf-lending-container/api/v1.0.0",
    },
)

DEFAULT_ENVIRONMENT = AEKXUIA_ENVIRONMENT

# Ordered so the UI's preset list has a stable, predictable order.
PRESETS: dict[str, EnvironmentConfig] = {
    "aekxuia": AEKXUIA_ENVIRONMENT,
    "local": LOCAL_WSL_ENVIRONMENT,
}


class EnvironmentStore:
    def __init__(self, initial: EnvironmentConfig = DEFAULT_ENVIRONMENT):
        self._env = initial
        self._active_preset = _preset_id_for(initial)
        self._lock = Lock()

    def get(self) -> EnvironmentConfig:
        with self._lock:
            return self._env

    def get_active_preset(self) -> str | None:
        with self._lock:
            return self._active_preset

    def set(self, env: EnvironmentConfig) -> None:
        with self._lock:
            self._env = env
            self._active_preset = _preset_id_for(env)

    def activate_preset(self, preset_id: str) -> EnvironmentConfig:
        if preset_id not in PRESETS:
            raise KeyError(f"Unknown environment preset: {preset_id!r}")
        env = PRESETS[preset_id]
        with self._lock:
            self._env = env
            self._active_preset = preset_id
        return env

    def base_url_for(self, service: str) -> str:
        urls = self.get().base_urls()
        if service not in urls:
            raise KeyError(f"No base URL configured for service {service!r}")
        return urls[service]


def _preset_id_for(env: EnvironmentConfig) -> str | None:
    """Whether env is exactly one of the named presets (for the UI to
    highlight which preset is active) -- None means a custom/ad-hoc edit."""
    for preset_id, preset_env in PRESETS.items():
        if env == preset_env:
            return preset_id
    return None
