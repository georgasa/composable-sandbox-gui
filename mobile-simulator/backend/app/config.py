"""Env-driven config. Unlike console-app, base URLs are fixed at startup
(no runtime Environment modal) -- this app is a curated demo, not a general
console. Same aekxuia values as this workspace's CLAUDE.md / console-app."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    deposits_base_url: str = "http://deposits-aekxuia0951.westeurope.cloudapp.azure.com/irf-deposits-container/api/v1.0.0"
    holdings_base_url: str = "http://aekxuia0951.westeurope.cloudapp.azure.com/ms-holdings-api/api/v1.0.0"
    party_base_url: str = "http://aekxuia0951.westeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0"
    lending_base_url: str = "http://lending-aekxuia0951.westeurope.cloudapp.azure.com/irf-lending-container/api/v1.0.0"

    company_id: str = "GB0010001"
    system_date: str = "2025-03-14"

    # "none" (default, local Docker Compose/Rancher) or "password" (Azure).
    auth_mode: str = "none"
    demo_password: str = ""

    request_timeout_seconds: float = 30.0
    long_request_timeout_seconds: float = 90.0  # loan creation

    class Config:
        env_prefix = ""
        case_sensitive = False


settings = Settings()
