"""Sandbox-specific behavior transcribed from this workspace's CLAUDE.md.

Centralized here (not duplicated in the frontend) so there is exactly one
place that encodes "how aekxuia actually behaves" -- the frontend only
renders whatever autofill hints and validation errors this module produces.
"""

from __future__ import annotations

import random
import re
import string
from typing import Any

from app.config import settings

_REFERENCE_NAME_RE = re.compile(r"[Rr]eference$")
_DATE_NAME_RE = re.compile(
    r"(openingDate|paymentValueDate|effectiveDate|valueDate|startDate|"
    r"endDate|maturityDate|issuedDate|expiryDate|dateOfBirth)$"
)
_ALPHANUMERIC_RE = re.compile(r"^[A-Za-z0-9]+$")


def is_reference_field(name: str) -> bool:
    return bool(_REFERENCE_NAME_RE.search(name))


def is_date_field(name: str, schema: dict[str, Any] | None) -> bool:
    if schema and schema.get("format") == "date":
        return True
    return bool(_DATE_NAME_RE.search(name))


def is_company_id_field(name: str) -> bool:
    return name.lower() in ("companyid", "company_id")


def is_composite_account_id_field(name: str) -> bool:
    # e.g. companyAccountId, companyTdId -- Holdings-style GB0010001-{accountId} params
    return name.lower() in ("companyaccountid", "companytdid")


def generate_reference(prefix: str = "REF") -> str:
    """Alphanumeric-only, matches the pattern verified working in
    Sandbox/01-demoflow.py (QUOT123456-style). Underscore/hyphen prefixes
    are rejected by the sandbox with T24-000 WRONG ALPHANUMERIC CHAR."""
    digits = "".join(random.choices(string.digits, k=6))
    return f"{prefix}{digits}"


def sanitize_reference(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", value)


def validate_reference(value: str) -> str | None:
    """Returns an error message if invalid, else None."""
    if not _ALPHANUMERIC_RE.match(value):
        return (
            "Reference fields must be alphanumeric only (no _ or -) or the "
            "sandbox rejects them with T24-000 WRONG ALPHANUMERIC CHAR."
        )
    return None


def autofill_hint_for(name: str, schema: dict[str, Any] | None) -> dict[str, Any] | None:
    """Returns {"value": ..., "reason": ...} for fields this workspace's
    CLAUDE.md documents a known-good default for, or None if there's no
    applicable rule. Purely advisory -- the value is always still editable
    by the user before Confirm."""
    if is_date_field(name, schema):
        return {"value": settings.system_date, "reason": "Fixed T24 business date on this sandbox."}
    if is_company_id_field(name):
        return {"value": settings.company_id, "reason": "Sandbox company ID."}
    if is_composite_account_id_field(name):
        return {
            "value": f"{settings.company_id}-",
            "reason": f"Holdings composite ID format: {settings.company_id}-{{accountId}}. "
                      f"Append the account ID.",
        }
    if is_reference_field(name):
        prefix = re.sub(r"[Rr]eference$", "", name).upper()[:6] or "REF"
        return {
            "value": generate_reference(prefix),
            "reason": "Auto-generated alphanumeric-only reference.",
        }
    return None


def coerce_numeric(value: Any, schema: dict[str, Any] | None) -> Any:
    """Guarantees numeric-typed fields are emitted as JSON numbers, not
    strings -- structurally fixes the fundingAmount/depositAmount
    string-vs-number bug documented in CLAUDE.md rather than relying on the
    caller to remember."""
    if not schema:
        return value
    schema_type = schema.get("type")
    if schema_type in ("number", "integer") and isinstance(value, str):
        try:
            return int(value) if schema_type == "integer" else float(value)
        except ValueError:
            return value
    return value


def unwrap_response(status_code: int, body: Any) -> tuple[bool, list[str]]:
    """Sandbox errors come back as {"error": [{"message": "..."}]}, and can
    appear even under HTTP 200 -- always check for .error regardless of
    status code, per CLAUDE.md."""
    if isinstance(body, dict) and isinstance(body.get("error"), list):
        messages = [
            e.get("message", str(e)) if isinstance(e, dict) else str(e)
            for e in body["error"]
        ]
        return False, messages
    # Party service returns errors as a bare top-level array (e.g.
    # [{"code":"PMS-00104","message":"..."}]) instead of the {"error":[...]}
    # envelope Deposits/Holdings use -- discovered live building
    # mobile-simulator, not documented in CLAUDE.md.
    if isinstance(body, list) and body and isinstance(body[0], dict) and "message" in body[0]:
        return False, [e.get("message", str(e)) for e in body]
    if not (200 <= status_code < 300):
        return False, [f"HTTP {status_code}"]
    return True, []
