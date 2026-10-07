from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.catalog.dereference import dereference_schema
from app.catalog.models import OperationDetail
from app.config import settings
from app.execution import sandbox_rules

router = APIRouter()


@router.get("/config")
async def get_config(request: Request):
    """Non-secret display info so the UI can show what environment it's
    pointed at (never returns secrets -- there are none; the sandbox has no
    auth, per CLAUDE.md). Base URLs are recomputed from the live
    EnvironmentStore on every call, so this reflects the current
    environment immediately after a PUT /api/environment."""
    env = request.app.state.environment.get()
    return {
        "companyId": settings.company_id,
        "systemDate": settings.system_date,
        "environmentLabel": env.label,
        "environmentPrefix": env.prefix,
        "baseUrls": env.base_urls(),
    }


def _catalog_tree(catalog) -> dict[str, dict[str, list[dict]]]:
    """Operations grouped by API domain, then tag, each with a short reference
    (H1, H2, ... for Holdings; O, P, R for Order, Party, Reference) numbered in
    display order so a reference always matches what the Catalog shows."""
    # Top level is the API domain -- the first path segment (/holdings/...,
    # /order/..., /party/..., /reference/...) -- not the backing service, so
    # e.g. Deposits' and Lending's /holdings operations share one category.
    # op.service still decides which base URL an operation is called on.
    grouped: dict[str, dict[str, list[dict]]] = {}
    for op in catalog.operations:
        summary = op.to_summary()
        domain = op.path.strip("/").split("/")[0].capitalize() or "Other"
        domain_group = grouped.setdefault(domain, {})
        tag = op.tags[0] if op.tags else ("Undocumented" if not op.documented else "Other")
        domain_group.setdefault(tag, []).append(summary.model_dump(by_alias=True))
    # The four domains in a fixed order, then their groups alphabetically.
    domain_order = ["Holdings", "Order", "Party", "Reference"]
    domains = [d for d in domain_order if d in grouped] + sorted(set(grouped) - set(domain_order))
    ordered = {
        domain: {group: grouped[domain][group] for group in sorted(grouped[domain])}
        for domain in domains
    }
    for domain, groups in ordered.items():
        n = 0
        for ops in groups.values():
            for op in ops:
                n += 1
                op["ref"] = f"{domain[0]}{n}"
    return ordered


@router.get("/catalog")
async def get_catalog(request: Request):
    catalog = request.app.state.catalog
    return {"totalOperations": len(catalog.operations), "services": _catalog_tree(catalog)}


@router.get("/catalog/{op_key:path}")
async def get_operation_detail(op_key: str, request: Request):
    catalog = request.app.state.catalog
    op = catalog.get(op_key)
    if op is None:
        raise HTTPException(status_code=404, detail=f"Unknown operation: {op_key}")

    document = catalog.document_for(op.source_file)
    request_schema = None
    if op.request_body_ref and document:
        request_schema = dereference_schema({"$ref": op.request_body_ref}, document)
    response_schema = None
    if op.response_ref and document:
        response_schema = dereference_schema({"$ref": op.response_ref}, document)

    autofill_hints = {}
    for p in op.parameters:
        hint = sandbox_rules.autofill_hint_for(p.name, p.schema_)
        if hint:
            autofill_hints[p.name] = hint
    if request_schema:
        for prop_name, prop_schema in (request_schema.get("properties") or {}).items():
            hint = sandbox_rules.autofill_hint_for(prop_name, prop_schema)
            if hint:
                autofill_hints[prop_name] = hint

    detail = OperationDetail(
        op_key=op.op_key,
        operation_id=op.operation_id,
        service=op.service,
        source_file=op.source_file,
        method=op.method,
        path=op.path,
        summary=op.summary,
        description=op.description,
        tags=op.tags,
        documented=op.documented,
        known_issue=op.known_issue,
        base_url=request.app.state.environment.base_url_for(op.service),
        parameters=op.parameters,
        request_schema=request_schema,
        response_schema=response_schema,
        autofill_hints=autofill_hints,
    )
    refs = {
        o["opKey"]: o["ref"]
        for groups in _catalog_tree(catalog).values()
        for ops in groups.values()
        for o in ops
    }
    return {**detail.model_dump(by_alias=True), "ref": refs.get(op.op_key)}
