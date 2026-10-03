"""Environment-driven configuration (process environment variables, set by
docker-compose.yml locally and by infra/provision.sh on Azure)."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Which named preset (app/environment.py PRESETS) the process boots with:
    # "local" (the k3s pack on this machine, the default for Docker Compose)
    # or "aekxuia" (the Azure sandbox -- what the public Azure deployment
    # pins, since it can't reach a local pack). Switchable at runtime from
    # the Environment modal.
    default_environment: str = "local"

    company_id: str = "GB0010001"
    system_date: str = "2025-03-14"

    # "none" (default, local Docker Compose/Rancher) or "password" (Azure --
    # see app/auth.py). demo_password is only meaningful in "password" mode.
    auth_mode: str = "none"
    demo_password: str = ""

    # "openai" (default) or "ollama". This only seeds the initial value of
    # llm_config_store (app/llm/runtime_config.py) at process startup --
    # actual provider/key/model are edited live from the Environment
    # modal's AI Assistant section, no restart needed. Ollama was tried
    # first (fully local, no API key) but a 1.5B CPU model's accuracy
    # wasn't good enough for reliable use, hence the switch to OpenAI as
    # the default; Ollama's client code is left in place as a fallback
    # option, not removed, in case fully-offline use matters again later.
    llm_provider: str = "openai"

    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "qwen2.5:1.5b-instruct"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    # Where the live-editable LLM config (provider/key/model) persists --
    # a bind-mounted volume in docker-compose.yml, outside the built image,
    # so it survives container recreation without ever being baked into a
    # layer or committed to git.
    llm_config_path: str = "/data/llm_config.json"

    request_timeout_seconds: float = 30.0
    long_request_timeout_seconds: float = 90.0  # lending creates, per Sandbox/03-demoflow-lending.py

    pending_execution_ttl_seconds: int = 300

    specs_dir: str = "app/specs/API-Event"

    class Config:
        env_prefix = ""
        case_sensitive = False


settings = Settings()
