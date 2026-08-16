"""Parses the 10 OpenAPI spec files in this workspace into a single
in-memory catalog of Operations.

Two things this loader deliberately gets right, both discovered by direct
testing against the live sandbox rather than by reading the specs alone:

1. Every spec's `servers:` block is a placeholder (api.server.com /
   localhost) -- never used. Real base URLs come from a static per-file
   table below, cross-checked against Sandbox/01-demoflow.py's endpoint
   constants.

2. The swagger specs do not fully describe which base URL each operation
   actually needs. Most operations in a given file consistently hit one
   base URL, but a handful of *undocumented* Holdings query endpoints
   (account details, transactions, party arrangements) are called against
   the separate Holdings base URL in the verified demo scripts and are not
   present in any spec at all. Those are added as supplemental, clearly
   flagged (documented=False) catalog entries -- see
   supplemental_operations() below -- rather than silently guessed at.

   Because base-URL assignment is inherently a best-effort default here,
   every operation's resolved base_url is editable by the caller at
   /api/prepare time (see api/prepare_routes.py) instead of being baked in
   as unchangeable truth.

Base URLs themselves are NOT stored on Operation -- they're resolved at
request time from the live EnvironmentStore (app/environment.py) via
op.service, so editing the environment (PUT /api/environment) takes effect
immediately without rebuilding the catalog. `service` ("Deposits",
"Holdings", "Party", "Lending") is exactly the key EnvironmentConfig.base_urls()
uses, so no separate per-file base-URL table is needed.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from app.catalog.known_issues import find_known_issue
from app.catalog.models import Operation, ParamInfo
from app.config import settings

# Header/query parameters stripped from every operation before it reaches
# the frontend:
# - "credentials": exists in the specs' securitySchemes-adjacent parameter
#   defs but is not enforced by the real sandbox (CLAUDE.md: "sandbox APIs
#   do not require authentication tokens").
# - pagination params (page_size/page_start/page_token/disablePagination):
#   repeated on nearly every GET via a shared $ref block, but clutter the
#   form even on single-resource-by-ID GETs where pagination is meaningless
#   and are essentially never needed for the ad-hoc testing this console is
#   for.
_DENYLISTED_PARAM_NAMES = {"credentials", "page_size", "page_start", "page_token", "disablePagination"}

_HTTP_METHODS = {"get", "post", "put", "delete"}

# folder name under API-Event/ -> display "service" label, which doubles as
# the key into EnvironmentConfig.base_urls() (app/environment.py).
_FOLDER_SERVICE = {
    "Deposits": "Deposits",
    "Lending": "Lending",
    "PartyMaster": "Party",
}


class Catalog:
    """Holds the flat operation list plus the raw parsed document per file,
    so request/response schemas can be dereferenced on demand without
    re-parsing YAML on every catalog detail request."""

    def __init__(self, operations: list[Operation], documents: dict[str, dict[str, Any]]):
        self.operations = operations
        self.documents = documents  # source_file -> parsed OpenAPI doc
        self._by_key = {op.op_key: op for op in operations}

    def get(self, op_key: str) -> Operation | None:
        return self._by_key.get(op_key)

    def document_for(self, source_file: str) -> dict[str, Any] | None:
        return self.documents.get(source_file)


def _strip_path_placeholders(path: str) -> str:
    return path


def _build_parameters(op_def: dict[str, Any], path_params_shared: list[dict[str, Any]]) -> list[ParamInfo]:
    raw_params = list(path_params_shared) + list(op_def.get("parameters", []) or [])
    result: list[ParamInfo] = []
    seen_names: set[str] = set()
    for p in raw_params:
        if not isinstance(p, dict) or "$ref" in p:
            continue  # parameter $refs (credentials/companyId/etc common params) resolved by name below
        name = p.get("name")
        if not name or name in _DENYLISTED_PARAM_NAMES or name in seen_names:
            continue
        location = p.get("in")
        if location not in ("path", "query"):
            continue
        seen_names.add(name)
        result.append(
            ParamInfo(
                name=name,
                location=location,
                required=bool(p.get("required", False)),
                schema=p.get("schema", {}),
                description=(p.get("description") or "").strip(),
            )
        )
    return result


def _resolve_common_parameters(op_def: dict[str, Any], document: dict[str, Any]) -> list[dict[str, Any]]:
    """Operations reference shared parameters via $ref (e.g. companyId,
    channel, validate_only). Resolve those by name here, dropping the ones
    in _DENYLISTED_PARAM_NAMES."""
    resolved: list[dict[str, Any]] = []
    for p in op_def.get("parameters", []) or []:
        if isinstance(p, dict) and "$ref" in p:
            ref = p["$ref"]
            if not ref.startswith("#/"):
                continue
            node: Any = document
            for part in ref[2:].split("/"):
                node = node.get(part, {}) if isinstance(node, dict) else {}
            if isinstance(node, dict) and node.get("name") not in _DENYLISTED_PARAM_NAMES:
                resolved.append(node)
        elif isinstance(p, dict):
            resolved.append(p)
    return resolved


def _load_one_file(path: Path, service: str) -> tuple[list[Operation], dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        document = yaml.safe_load(f)

    operations: list[Operation] = []
    source_file = path.stem

    for raw_path, path_item in (document.get("paths") or {}).items():
        if not isinstance(path_item, dict):
            continue
        for method, op_def in path_item.items():
            if method.lower() not in _HTTP_METHODS or not isinstance(op_def, dict):
                continue
            method_upper = method.upper()
            # source_file (not just service) must be part of the key: two
            # different files in the same service folder can define the
            # identical method+path (e.g. holdings-accounts-service and
            # holdings-deposits-service both define DELETE
            # /holdings/activities/{activityReference}) -- confirmed by
            # smoke-testing this loader against the real specs.
            op_key = f"{service}/{source_file}:{method_upper}:{raw_path}"
            operation_id = op_def.get("operationId", "")

            resolved_common = _resolve_common_parameters(op_def, document)
            # inline (non-$ref) parameters straight on the operation, e.g. path params
            inline_params = [p for p in (op_def.get("parameters") or []) if isinstance(p, dict) and "$ref" not in p]
            parameters = _build_parameters({"parameters": resolved_common + inline_params}, [])

            request_body_ref = None
            body = op_def.get("requestBody", {})
            if isinstance(body, dict):
                content = body.get("content", {}).get("application/json", {})
                schema = content.get("schema", {})
                if isinstance(schema, dict) and "$ref" in schema:
                    request_body_ref = schema["$ref"]

            response_ref = None
            responses = op_def.get("responses", {})
            ok_response = responses.get("200") if isinstance(responses, dict) else None
            if isinstance(ok_response, dict):
                content = ok_response.get("content", {}).get("application/json", {})
                schema = content.get("schema", {})
                if isinstance(schema, dict) and "$ref" in schema:
                    response_ref = schema["$ref"]

            known_issue = find_known_issue(service, method_upper, raw_path)

            operations.append(
                Operation(
                    op_key=op_key,
                    operation_id=operation_id,
                    service=service,
                    source_file=source_file,
                    method=method_upper,  # type: ignore[arg-type]
                    path=raw_path,
                    summary=(op_def.get("summary") or "").strip(),
                    description=(op_def.get("description") or "").strip(),
                    tags=list(op_def.get("tags") or []),
                    parameters=parameters,
                    request_body_ref=request_body_ref,
                    response_ref=response_ref,
                    documented=True,
                    known_issue=known_issue,
                )
            )

    return operations, document


def supplemental_operations() -> list[Operation]:
    """Real, working endpoints confirmed live in this session and in
    Sandbox/01-demoflow.py through 04-demoflow-lending-event.py that are
    NOT present in any of the 10 OpenAPI spec files. Marked documented=False
    so the UI can visually distinguish "in the spec" from "known to work,
    reverse-engineered from the verified demo scripts / CLAUDE.md" --
    exactly the kind of undocumented-but-real behavior CLAUDE.md warns
    every builder to expect and test for.
    """
    source = "Sandbox/01-demoflow.py"

    def op(
        service: str, method: str, path: str, summary: str, description: str,
        params: list[ParamInfo], tag: str = "Undocumented Holdings Query",
    ) -> Operation:
        return Operation(
            op_key=f"{service}:{method}:{path}",
            operation_id="",
            service=service,
            source_file=source,
            method=method,  # type: ignore[arg-type]
            path=path,
            summary=summary,
            description=description,
            tags=[tag],
            parameters=params,
            documented=False,
        )

    return [
        op(
            "Holdings", "GET",
            "/holdings/accounts/{companyAccountId}/accountDetails",
            "Get rich account/term-deposit details (Holdings query layer).",
            "Not present in any spec file -- confirmed working against the live "
            "sandbox and used throughout the verified demo scripts. "
            "{companyAccountId} must be formatted GB0010001-{accountId}. "
            "Requires query params alternatekey=accountId&alternatename=ACCOUNT.",
            [
                ParamInfo(name="companyAccountId", location="path", required=True,
                          schema={"type": "string", "example": "GB0010001-1013715579"}),
                ParamInfo(name="alternatekey", location="query", required=True,
                          schema={"type": "string", "default": "accountId"}),
                ParamInfo(name="alternatename", location="query", required=True,
                          schema={"type": "string", "default": "ACCOUNT"}),
            ],
        ),
        op(
            "Holdings", "GET",
            "/holdings/accounts/{companyAccountId}/transactions",
            "Get transaction history for an account or term deposit (Holdings query layer).",
            "Not present in any spec file. Response items use `narrative` (not "
            "`description`) and `amountInAccountCurrency`/`transactionAmount` -- "
            "no separate credit/debit fields, no runningBalance.",
            [ParamInfo(name="companyAccountId", location="path", required=True,
                       schema={"type": "string", "example": "GB0010001-1013715579"})],
        ),
        op(
            "Holdings", "GET",
            "/holdings/accounts/{companyAccountId}/balances",
            "Get balances for an account or term deposit (Holdings query layer).",
            "Not present in any spec file. Use this instead of the Deposits-service "
            "deposits/{id}/balances enquiry, which returns TGVCP-009 on this sandbox.",
            [ParamInfo(name="companyAccountId", location="path", required=True,
                       schema={"type": "string", "example": "GB0010001-1013715579"})],
        ),
        op(
            "Holdings", "GET",
            "/holdings/parties/{partyId}/arrangements",
            "List all arrangements (accounts, term deposits, loans) owned by a party.",
            "Not present in any spec file -- confirmed working live in this session. "
            "Each arrangement's real account ID is under alternateReferences where "
            "alternateType == \"ACCOUNT\" (strip the GB0010001- prefix).",
            [ParamInfo(name="partyId", location="path", required=True,
                       schema={"type": "string", "example": "2622649730"})],
        ),
        op(
            "Party", "POST",
            "/party/parties",
            "Create a party (customer) -- the flat, verified-working shape.",
            "Not present in party.yaml (the spec's createIndividualParty at /party/individuals "
            "has a much more complex nested shape) -- this flat endpoint is what "
            "Sandbox/01-demoflow.py actually uses and is confirmed working live. "
            "Powers the \"Create New Party\" button in the session bar; the response's "
            "`id` field is the new partyId.",
            [],
            tag="Undocumented Party Command",
        ),
    ]


def build_catalog() -> Catalog:
    specs_root = Path(settings.specs_dir)
    operations: list[Operation] = []
    documents: dict[str, dict[str, Any]] = {}

    for folder, service in _FOLDER_SERVICE.items():
        swagger_dir = specs_root / folder / "swagger"
        if not swagger_dir.is_dir():
            continue
        for yaml_path in sorted(swagger_dir.glob("*.yaml")):
            file_ops, document = _load_one_file(yaml_path, service)
            operations.extend(file_ops)
            documents[yaml_path.stem] = document

    operations.extend(supplemental_operations())

    return Catalog(operations, documents)
