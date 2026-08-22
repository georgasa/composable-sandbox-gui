import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { CatalogResponse } from "../api/types";
import { OperationWorkbench } from "../components/OperationWorkbench";

interface Props {
  /** Set by the Assistant tab's "View in Catalog" link -- see App.tsx for
   * why this is {opKey, nonce} rather than a bare opKey (re-clicking the
   * same opKey after browsing elsewhere needs a value change to re-fire). */
  focus?: { opKey: string; nonce: number } | null;
}

export function CatalogBrowser({ focus }: Props) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [search, setSearch] = useState("");
  const [selectedOpKey, setSelectedOpKey] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

  const toggleService = (service: string) =>
    setExpandedServices((prev) => {
      const next = new Set(prev);
      next.has(service) ? next.delete(service) : next.add(service);
      return next;
    });

  const toggleTag = (key: string) =>
    setExpandedTags((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const loadCatalog = () => {
    setCatalogError(null);
    api
      .getCatalog()
      .then(setCatalog)
      .catch((e) => setCatalogError(e instanceof Error ? e.message : String(e)));
  };

  useEffect(loadCatalog, []);

  const filtered = useMemo(() => {
    if (!catalog) return null;
    if (!search.trim()) return catalog.services;
    const q = search.toLowerCase();
    const out: CatalogResponse["services"] = {};
    for (const [service, tags] of Object.entries(catalog.services)) {
      for (const [tag, ops] of Object.entries(tags)) {
        const matches = ops.filter(
          (op) =>
            op.summary.toLowerCase().includes(q) ||
            op.operationId.toLowerCase().includes(q) ||
            op.path.toLowerCase().includes(q)
        );
        if (matches.length > 0) {
          out[service] = out[service] || {};
          out[service][tag] = matches;
        }
      }
    }
    return out;
  }, [catalog, search]);

  // while actively searching, auto-expand every group that has a match --
  // otherwise a hit would be invisible behind a collapsed "+"
  useEffect(() => {
    if (!search.trim() || !filtered) return;
    setExpandedServices(new Set(Object.keys(filtered)));
    const tagKeys = new Set<string>();
    for (const [service, tags] of Object.entries(filtered)) {
      for (const tag of Object.keys(tags)) tagKeys.add(`${service}::${tag}`);
    }
    setExpandedTags(tagKeys);
  }, [search, filtered]);

  // "View in Catalog" from the Assistant tab -- find which service/tag
  // group the operation lives under, expand straight to it, select it, and
  // scroll it into view. Keyed off `focus` (an {opKey, nonce} pair, not a
  // bare opKey) so re-clicking the same link still re-triggers this after
  // the user has browsed elsewhere in the meantime.
  useEffect(() => {
    if (!focus || !catalog) return;
    for (const [service, tags] of Object.entries(catalog.services)) {
      for (const [tag, ops] of Object.entries(tags)) {
        if (!ops.some((op) => op.opKey === focus.opKey)) continue;
        setSearch(""); // an active filter could otherwise hide the target op
        setExpandedServices((prev) => new Set(prev).add(service));
        setExpandedTags((prev) => new Set(prev).add(`${service}::${tag}`));
        setSelectedOpKey(focus.opKey);
        // deferred: the op-item only exists in the DOM once the expansion
        // above has actually rendered
        setTimeout(() => {
          document.querySelector(`[data-op-key="${CSS.escape(focus.opKey)}"]`)?.scrollIntoView({
            block: "center",
            behavior: "smooth",
          });
        }, 50);
        return;
      }
    }
  }, [focus, catalog]);

  return (
    <>
      <div className="catalog-panel">
        <input
          className="search-input"
          placeholder="Search operations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {catalog && <div className="catalog-stats">{catalog.totalOperations} operations across 4 services</div>}
        {catalogError && (
          <div className="confirm-banner" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <span>Couldn't load the catalog: {catalogError}</span>
            <button className="btn" onClick={loadCatalog}>
              Retry
            </button>
          </div>
        )}
        {filtered &&
          Object.entries(filtered).map(([service, tags]) => {
            const serviceOpCount = Object.values(tags).reduce((n, ops) => n + ops.length, 0);
            const serviceOpen = expandedServices.has(service);
            return (
              <div className="service-group" key={service}>
                <button className="service-header" onClick={() => toggleService(service)}>
                  <span className="group-toggle-label">
                    <span className="group-toggle-icon">{serviceOpen ? "−" : "+"}</span>
                    {service}
                  </span>
                  <span className="count-badge">{serviceOpCount}</span>
                </button>
                {serviceOpen &&
                  Object.entries(tags).map(([tag, ops]) => {
                    const tagKey = `${service}::${tag}`;
                    const tagOpen = expandedTags.has(tagKey);
                    return (
                      <div className="tag-group" key={tag}>
                        <button className="tag-header" onClick={() => toggleTag(tagKey)}>
                          <span className="group-toggle-label">
                            <span className="group-toggle-icon">{tagOpen ? "−" : "+"}</span>
                            {tag}
                          </span>
                          <span className="count-badge count-badge-sm">{ops.length}</span>
                        </button>
                        {tagOpen &&
                          ops.map((op) => (
                            <button
                              key={op.opKey}
                              data-op-key={op.opKey}
                              className={`op-item${op.opKey === selectedOpKey ? " selected" : ""}`}
                              onClick={() => setSelectedOpKey(op.opKey)}
                              title={op.summary}
                            >
                              <span className={`method-badge ${op.method}`}>{op.method}</span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {op.operationId || op.path}
                              </span>
                              {!op.documented && <span className="undoc-dot" title="Not in any spec file" />}
                            </button>
                          ))}
                      </div>
                    );
                  })}
              </div>
            );
          })}
      </div>

      <div className="content-panel">
        {!selectedOpKey && <div className="empty-state">Select an operation from the catalog to get started.</div>}
        {selectedOpKey && <OperationWorkbench key={selectedOpKey} opKey={selectedOpKey} />}
      </div>
    </>
  );
}
