"""Recursive $ref resolver for a single OpenAPI document.

All 194 requestBody schemas in this workspace's specs use $ref consistently
(verified by direct inspection), so this only needs to resolve *internal*
refs of the form '#/components/schemas/Foo' within the same parsed document
-- no cross-file or external $refs exist in these specs.

Guards against cycles (e.g. a schema that references itself, directly or
through a chain) with a per-branch "seen" set and a hard depth cap, since
that was flagged as unverified in the original workspace scan.
"""

from __future__ import annotations

from typing import Any

MAX_DEPTH = 12


def _resolve_ref(ref: str, document: dict[str, Any]) -> dict[str, Any] | None:
    if not ref.startswith("#/"):
        return None  # no external/cross-file refs in these specs
    node: Any = document
    for part in ref[2:].split("/"):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, dict) else None


def dereference_schema(
    schema: dict[str, Any] | None,
    document: dict[str, Any],
    *,
    _seen: frozenset[str] = frozenset(),
    _depth: int = 0,
) -> dict[str, Any] | None:
    """Return a copy of `schema` with every $ref inlined.

    On a cycle or depth-cap hit, the offending $ref is left as a bare
    {"$ref": "..."} marker instead of recursing further, so the caller
    (a form generator) can render a fallback rather than the resolver
    hanging or blowing the stack.
    """
    if schema is None:
        return None

    if _depth > MAX_DEPTH:
        return {"$ref": "(max depth reached)"}

    if "$ref" in schema:
        ref = schema["$ref"]
        if ref in _seen:
            return {"$ref": ref, "$cycle": True}
        target = _resolve_ref(ref, document)
        if target is None:
            return {"$ref": ref, "$unresolved": True}
        resolved = dereference_schema(
            target, document, _seen=_seen | {ref}, _depth=_depth + 1
        )
        # merge sibling keys (rare in these specs, but valid OpenAPI) over the resolved ref
        merged = dict(resolved or {})
        merged.update({k: v for k, v in schema.items() if k != "$ref"})
        return merged

    result: dict[str, Any] = {}
    for key, value in schema.items():
        if key == "properties" and isinstance(value, dict):
            result[key] = {
                prop_name: dereference_schema(
                    prop_schema, document, _seen=_seen, _depth=_depth + 1
                )
                for prop_name, prop_schema in value.items()
            }
        elif key == "items" and isinstance(value, dict):
            result[key] = dereference_schema(
                value, document, _seen=_seen, _depth=_depth + 1
            )
        elif key in ("allOf", "oneOf", "anyOf") and isinstance(value, list):
            result[key] = [
                dereference_schema(item, document, _seen=_seen, _depth=_depth + 1)
                for item in value
            ]
        else:
            result[key] = value
    return result
