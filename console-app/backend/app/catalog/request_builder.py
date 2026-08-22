"""Turns (op_key, user-supplied params) into a fully-resolved HTTP request
preview, applying sandbox_rules autofill along the way. Shared by both the
catalog-browser path (POST /api/prepare) and the NL-assistant path (POST
/api/assistant/query) so there is exactly one place that builds a request --
see plan §2, "one execution code path in the whole app".
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.catalog.dereference import dereference_schema
from app.catalog.loader import Catalog
from app.catalog.models import Operation
from app.environment import EnvironmentStore
from app.execution import sandbox_rules
from app.execution.pending_store import PendingExecution, pending_store

from app.config import settings


@dataclass
class BuildResult:
    op: Operation
    url: str
    method: str
    query: dict[str, Any]
    body: dict[str, Any] | None
    missing_required: list[str] = field(default_factory=list)
    autofilled: dict[str, str] = field(default_factory=dict)  # field -> reason
    pending_execution_id: str | None = None


def _request_body_schema(catalog: Catalog, op: Operation) -> dict[str, Any] | None:
    if not op.request_body_ref:
        return None
    document = catalog.document_for(op.source_file)
    if document is None:
        return None
    return dereference_schema({"$ref": op.request_body_ref}, document)


_PLAUSIBLE_PARTY_ID_RE = re.compile(r"^\d{6,}$")  # real IDs on this sandbox look like 2622649730


def _is_plausible_party_id(value: Any) -> bool:
    return isinstance(value, str) and bool(_PLAUSIBLE_PARTY_ID_RE.match(value))


def _seed_active_party(
    params: dict[str, Any], op: Operation, body_schema: dict[str, Any] | None, active_party_id: str | None
) -> None:
    """Fills the session's pinned party ID into any partyId-shaped field --
    mirrors frontend/src/utils/seedParty.ts, but server-side, so the
    NL-assistant path gets it too. The assistant only sees the literal text
    the user typed (e.g. "under this partyid" has no digits in it at all),
    so without this the LLM has nothing real to extract.

    Overrides, not just fills gaps: a first version of this only filled
    empty fields, on the assumption the LLM would either extract a real ID
    or leave the field blank. Live testing showed a third case -- a small
    model asked to fill a "required" field will sometimes hallucinate the
    literal word "required" (or similar) rather than leave it empty, which
    isn't a gap but also isn't a usable value. So any existing value that
    doesn't look like a real ID (bare digits, 6+ long, matching every
    partyId observed on this sandbox) is treated as noise and replaced.
    A value that DOES look plausible -- i.e. the user or the LLM's
    extraction really did supply a differently-numbered party -- always
    wins over the pinned one."""
    if not active_party_id:
        return
    for p in op.parameters:
        if p.name.lower() == "partyid" and not _is_plausible_party_id(params.get(p.name)):
            params[p.name] = active_party_id
    if body_schema:
        for prop_name, prop_schema in (body_schema.get("properties") or {}).items():
            prop_type = prop_schema.get("type")
            if prop_name.lower() == "partyid" and prop_type not in ("array", "object"):
                if not _is_plausible_party_id(params.get(prop_name)):
                    params[prop_name] = active_party_id
            elif prop_type == "array" and not params.get(prop_name):
                item_props = ((prop_schema.get("items") or {}).get("properties")) or {}
                if "partyId" in item_props:
                    row = {"partyId": active_party_id}
                    if "partyRole" in item_props:
                        row["partyRole"] = "OWNER"
                    params[prop_name] = [row]


def build_request(
    catalog: Catalog,
    environment: EnvironmentStore,
    op_key: str,
    params: dict[str, Any],
    base_url_override: str | None = None,
    mint_token: bool = True,
    active_party_id: str | None = None,
) -> BuildResult | None:
    op = catalog.get(op_key)
    if op is None:
        return None

    params = dict(params or {})
    autofilled: dict[str, str] = {}
    missing_required: list[str] = []

    path_param_names = {p.name for p in op.parameters if p.location == "path"}
    query_param_names = {p.name for p in op.parameters if p.location == "query"}
    body_schema = _request_body_schema(catalog, op)
    _seed_active_party(params, op, body_schema, active_party_id)

    # --- path & query params, with sandbox autofill for anything not supplied ---
    for p in op.parameters:
        if p.name in params and params[p.name] not in (None, ""):
            continue
        hint = sandbox_rules.autofill_hint_for(p.name, p.schema_)
        if hint is not None:
            params[p.name] = hint["value"]
            autofilled[p.name] = hint["reason"]
        elif p.required:
            missing_required.append(p.name)

    resolved_path = op.path
    for name in path_param_names:
        if name in params:
            resolved_path = resolved_path.replace("{" + name + "}", str(params[name]))

    query = {name: params[name] for name in query_param_names if name in params}

    resolved_base_url = base_url_override or environment.base_url_for(op.service)
    url = resolved_base_url.rstrip("/") + resolved_path

    # --- request body: everything else the caller supplied, plus autofill
    # for any required body property the caller didn't supply ---
    body: dict[str, Any] | None = None
    if op.method in ("POST", "PUT", "DELETE") and (body_schema or params):
        reserved = path_param_names | query_param_names
        body = {k: v for k, v in params.items() if k not in reserved}

        properties = (body_schema or {}).get("properties", {}) if body_schema else {}
        required_props = set((body_schema or {}).get("required", [])) if body_schema else set()

        for prop_name, prop_schema in properties.items():
            if prop_name in body and body[prop_name] not in (None, ""):
                body[prop_name] = sandbox_rules.coerce_numeric(body[prop_name], prop_schema, prop_name)
                continue
            hint = sandbox_rules.autofill_hint_for(prop_name, prop_schema)
            if hint is not None:
                body[prop_name] = hint["value"]
                autofilled[prop_name] = hint["reason"]
            elif prop_name in required_props:
                missing_required.append(prop_name)

        if not body:
            body = None

    pending_id = None
    if mint_token:
        timeout = (
            settings.long_request_timeout_seconds
            if op.service == "Lending" and op.method == "POST"
            else settings.request_timeout_seconds
        )
        pending_id = pending_store.put(
            PendingExecution(
                op_key=op.op_key,
                method=op.method,
                url=url,
                headers={},
                body=body,
                query=query,
                timeout=timeout,
            )
        )

    return BuildResult(
        op=op,
        url=url,
        method=op.method,
        query=query,
        body=body,
        missing_required=missing_required,
        autofilled=autofilled,
        pending_execution_id=pending_id,
    )
