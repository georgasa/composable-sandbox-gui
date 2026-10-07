import { useState } from "react";
import { FlowDiagram } from "../components/architecture/FlowDiagram";
import { LayeredDiagram } from "../components/architecture/LayeredDiagram";
import { ARCH_VIEWS } from "../components/architecture/views";
import "../styles/architecture.css";

/** Composable Banking reference architecture, one view per source picture. */
export function Architecture() {
  const [selectedId, setSelectedId] = useState(() => {
    const fromHash = window.location.hash.slice(1).split("/")[1];
    if (fromHash && ARCH_VIEWS.some((v) => v.id === fromHash)) return fromHash;
    try {
      const stored = localStorage.getItem("archView");
      if (stored && ARCH_VIEWS.some((v) => v.id === stored)) return stored;
    } catch {
      /* storage unavailable */
    }
    return ARCH_VIEWS[0].id;
  });
  const selected = ARCH_VIEWS.find((v) => v.id === selectedId) ?? ARCH_VIEWS[0];
  const groups = Array.from(new Set(ARCH_VIEWS.map((v) => v.group)));

  const select = (id: string) => {
    setSelectedId(id);
    try {
      localStorage.setItem("archView", id);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <>
      <div className="catalog-panel">
        <div className="catalog-stats">Composable Banking architecture</div>
        {groups.map((g) => (
          <div className="arch-nav-group" key={g}>
            <div className="arch-nav-title">{g}</div>
            {ARCH_VIEWS.filter((v) => v.group === g).map((v) => (
              <button
                key={v.id}
                className={`arch-nav-item${v.id === selected.id ? " selected" : ""}`}
                onClick={() => select(v.id)}
              >
                <span className={`arch-nav-badge ${v.type}`}>{v.type === "flow" ? "Runtime" : "System"}</span>
                <span>{v.title}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="content-panel">
        <div className="arch-header">
          <div className="arch-eyebrow">{selected.group}</div>
          <h2>{selected.title}</h2>
          <div className="arch-subtitle">{selected.subtitle}</div>
          {selected.type === "flow" && (
            <div className="arch-hint">Hover a component or a flow to trace its connections.</div>
          )}
        </div>
        {selected.type === "flow" ? (
          <FlowDiagram key={selected.id} view={selected.view} />
        ) : (
          <LayeredDiagram view={selected.view} />
        )}
      </div>
    </>
  );
}
