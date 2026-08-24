"""Maps catalog operations onto the Service -> functional Group taxonomy
used by the sibling composable-explorer app's curated API documentation
(frontend/src/pages/modules/{Deposits,Lending,PartyMaster}Content.tsx),
instead of this app's own (service folder, raw OpenAPI tag) grouping.

explorer_taxonomy.json is machine-extracted from those three files' hand-
curated `swaggerServices` arrays (name/baseUrl/groups/endpoints), with each
endpoint's path resolved against its service's baseUrl the same way that
app's own `apiOperations = swaggerServices.flatMap(...)` does. It is not the
full 323-operation catalog -- composable-explorer only documents ~195
hand-picked operations, so most of our newer/undocumented spec surface has
no entry here and to_explorer_category() correctly returns None for it.
Re-run this workspace's taxonomy-extraction script against that repo if its
module files change.

Matching is done on (method, path-with-params-blanked) rather than an exact
path string, since composable-explorer's hand-typed path templates don't
always use the same param names as the real OpenAPI spec (e.g. `{uniqueId}`
vs whatever the actual spec calls it) for what is otherwise the identical
endpoint.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

_PARAM_RE = re.compile(r"\{[^}]+\}")


def _normalize(path: str) -> str:
    return _PARAM_RE.sub("{}", path)


def _load_index() -> dict[tuple[str, str], tuple[str, str]]:
    data_path = Path(__file__).parent / "explorer_taxonomy.json"
    entries = json.loads(data_path.read_text(encoding="utf-8"))
    index: dict[tuple[str, str], tuple[str, str]] = {}
    for e in entries:
        key = (e["method"], _normalize(e["path"]))
        # first entry wins on duplicate (method, path) pairs across files
        index.setdefault(key, (e["service"], e["group"]))
    return index


_INDEX = _load_index()


def find_explorer_category(method: str, path: str) -> tuple[str, str] | None:
    """Returns (explorerService, explorerGroup) if this operation is
    documented in composable-explorer's curated catalog, else None."""
    return _INDEX.get((method, _normalize(path)))
