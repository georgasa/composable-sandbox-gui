class LLMError(Exception):
    """Raised by any provider client (ollama_client, openai_client) on
    failure -- unreachable, bad key, non-JSON output, etc. Callers treat
    this uniformly as "assistant couldn't confidently propose a call",
    never as a reason to skip the confirm-before-execute gate."""
