"""Pydantic models for the unified operation catalog.

Every operation is keyed by (service, method, path) rather than operationId,
because 11 operationIds collide across the 10 source spec files (e.g.
reversePostedActivity is defined identically in three different files).
See loader.py for how op_key is constructed.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

HttpMethod = Literal["GET", "POST", "PUT", "DELETE"]


class CamelModel(BaseModel):
    """Base for anything serialized to the frontend: fields are snake_case
    in Python, camelCase on the wire, so the JSON shape is consistent with
    the hand-built camelCase responses in api/prepare_routes.py and
    api/execute_routes.py."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ParamInfo(CamelModel):
    name: str
    location: Literal["path", "query"]
    required: bool = False
    schema_: dict[str, Any] = Field(default_factory=dict, alias="schema")
    description: str = ""


class OperationSummary(CamelModel):
    """Lightweight listing entry — what GET /api/catalog returns."""

    op_key: str
    operation_id: str
    service: str
    source_file: str
    method: HttpMethod
    path: str
    summary: str
    tags: list[str] = Field(default_factory=list)
    documented: bool = True
    known_issue: str | None = None


class OperationDetail(OperationSummary):
    """Full detail — what GET /api/catalog/{op_key} returns. base_url is
    resolved fresh from the live EnvironmentStore at response time (see
    api/catalog_routes.py), not stored on the catalog Operation."""

    description: str = ""
    base_url: str
    parameters: list[ParamInfo] = Field(default_factory=list)
    request_schema: dict[str, Any] | None = None
    response_schema: dict[str, Any] | None = None
    autofill_hints: dict[str, Any] = Field(default_factory=dict)


class Operation(BaseModel):
    """Internal representation held in the in-memory catalog. Superset of
    OperationDetail plus raw spec fragments needed for on-demand dereferencing."""

    op_key: str
    operation_id: str
    service: str
    source_file: str
    method: HttpMethod
    path: str
    summary: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    parameters: list[ParamInfo] = Field(default_factory=list)
    request_body_ref: str | None = None
    response_ref: str | None = None
    documented: bool = True
    known_issue: str | None = None

    def to_summary(self) -> OperationSummary:
        return OperationSummary(
            op_key=self.op_key,
            operation_id=self.operation_id,
            service=self.service,
            source_file=self.source_file,
            method=self.method,
            path=self.path,
            summary=self.summary,
            tags=self.tags,
            documented=self.documented,
            known_issue=self.known_issue,
        )
