import { useId, useMemo, useState } from "react";

/** Box colours, matching the colour coding of the source diagrams. */
export type Tone =
  | "temenos" // green: Temenos microservices / products
  | "framework" // light indigo: framework services
  | "module" // inner building blocks of a product core
  | "navy" // dark navy: Temenos product components
  | "thirdparty" // purple: 3rd party / external
  | "channel" // amber: channels
  | "bus" // amber: event streaming / bus
  | "actor"
  | "cache"
  | "salmon"
  | "lime";

export type EdgeKind = "sync" | "async" | "data" | "data-async";

export interface FNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** box: a component; group: titled container; core: product container; headline: big centred text. */
  kind?: "box" | "group" | "core" | "headline";
  label?: string;
  sub?: string;
  tone?: Tone;
  db?: boolean;
  vertical?: boolean;
  icon?: "user" | "cache";
  /** Small chips rendered inside the box (e.g. product types). */
  items?: string[];
  dashed?: boolean;
}

export interface FEdge {
  /** "nodeId:side[:pos]" with side t|b|l|r; pos is a fraction 0..1 along that side
   * (default 0.5) or "@n" for an absolute coordinate. */
  from: string;
  to: string;
  via?: [number, number][];
  kind: EdgeKind;
  label?: string;
  /** Label position; defaults to the middle of the longest segment. */
  lp?: [number, number];
  both?: boolean;
}

export interface FlowView {
  width: number;
  height: number;
  nodes: FNode[];
  edges: FEdge[];
}

type Pt = { x: number; y: number };

function anchor(spec: string, nodes: Map<string, FNode>): { p: Pt; side: string; id: string } {
  const [id, side = "r", frac] = spec.split(":");
  const n = nodes.get(id);
  if (!n) throw new Error(`Unknown node ${id}`);
  // "@123" is an absolute coordinate along the side instead of a fraction.
  const along = (start: number, size: number) =>
    frac === undefined ? start + size / 2 : frac.startsWith("@") ? Number(frac.slice(1)) : start + size * Number(frac);
  const p =
    side === "t" ? { x: along(n.x, n.w), y: n.y } :
    side === "b" ? { x: along(n.x, n.w), y: n.y + n.h } :
    side === "l" ? { x: n.x, y: along(n.y, n.h) } :
    { x: n.x + n.w, y: along(n.y, n.h) };
  return { p, side, id };
}

/** Orthogonal route through the anchors and waypoints, inserting elbows where needed. */
function route(a: Pt, aSide: string, vias: Pt[], b: Pt, bSide: string): Pt[] {
  const pts = [a, ...vias, b];
  const out: Pt[] = [a];
  let verticalNext = aSide === "t" || aSide === "b";
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    const last = i === pts.length - 2;
    if (p.x === q.x || p.y === q.y) {
      out.push(q);
      verticalNext = p.y !== q.y ? false : true;
      continue;
    }
    // Arrive perpendicular to the target side.
    const vFirst = last ? bSide === "l" || bSide === "r" : verticalNext;
    out.push(vFirst ? { x: p.x, y: q.y } : { x: q.x, y: p.y }, q);
    verticalNext = vFirst;
  }
  return out;
}

function roundedPath(pts: Pt[], r = 9): string {
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [p, c, n] = [pts[i - 1], pts[i], pts[i + 1]];
    const d1 = Math.hypot(c.x - p.x, c.y - p.y);
    const d2 = Math.hypot(n.x - c.x, n.y - c.y);
    if (d1 === 0 || d2 === 0) continue;
    const k = Math.min(r, d1 / 2, d2 / 2);
    const s = { x: c.x - ((c.x - p.x) / d1) * k, y: c.y - ((c.y - p.y) / d1) * k };
    const e = { x: c.x + ((n.x - c.x) / d2) * k, y: c.y + ((n.y - c.y) / d2) * k };
    d += ` L${s.x},${s.y} Q${c.x},${c.y} ${e.x},${e.y}`;
  }
  const z = pts[pts.length - 1];
  return d + ` L${z.x},${z.y}`;
}

function longestMid(pts: Pt[]): Pt {
  let best = { len: -1, mid: pts[0] };
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (len > best.len) best = { len, mid: { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 } };
  }
  return best.mid;
}

function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      if (line && (line + " " + word).length > maxChars) {
        lines.push(line);
        line = word;
      } else line = line ? line + " " + word : word;
    }
    lines.push(line);
  }
  return lines;
}

export function nodeName(n: FNode): string {
  return (n.label ?? "").replace(/\n/g, " ");
}

function NodeShape({ n }: { n: FNode }) {
  const tone = n.tone ?? "temenos";
  if (n.kind === "group") {
    return (
      <g className={`arch-group arch-tone-${tone}${n.dashed ? " dashed" : ""}`}>
        <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={14} />
        {n.label && (
          <text x={n.x + 16} y={n.y + 24} className="arch-group-title">
            {n.label}
          </text>
        )}
      </g>
    );
  }
  if (n.kind === "core") {
    return <rect className="arch-core" x={n.x} y={n.y} width={n.w} height={n.h} rx={18} />;
  }
  if (n.kind === "headline") {
    const lines = wrap(n.label ?? "", Math.floor(n.w / 13));
    const cy = n.y + n.h / 2 - ((lines.length - 1) * 24) / 2;
    return (
      <text className="arch-headline" textAnchor="middle">
        {lines.map((l, i) => (
          <tspan key={i} x={n.x + n.w / 2} y={cy + i * 24} dominantBaseline="middle">
            {l}
          </tspan>
        ))}
      </text>
    );
  }

  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const span = n.vertical ? n.h : n.w;
  const pad = n.icon ? 44 : n.db ? 40 : 18;
  const lines = wrap(n.label ?? "", Math.max(6, Math.floor((span - pad) / 7.2)));
  const subLines = n.sub ? wrap(n.sub, Math.floor((span - 18) / 6.2)) : [];
  const chipsH = n.items ? 30 : 0;
  const total = lines.length * 16 + subLines.length * 14 + chipsH;
  const textTop = (n.vertical ? cy : cy) - total / 2 + 8;
  const textX = n.icon && !n.vertical ? cx + 12 : n.db && !n.vertical ? cx - 8 : cx;

  return (
    <g className={`arch-box arch-tone-${tone}`}>
      <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.tone === "actor" ? n.h / 2 : 10} />
      <g transform={n.vertical ? `rotate(-90 ${cx} ${cy})` : undefined}>
        <text className="arch-box-label" textAnchor="middle">
          {lines.map((l, i) => (
            <tspan key={i} x={textX} y={textTop + i * 16} dominantBaseline="middle">
              {l}
            </tspan>
          ))}
        </text>
        {subLines.length > 0 && (
          <text className="arch-box-sub" textAnchor="middle">
            {subLines.map((l, i) => (
              <tspan key={i} x={cx} y={textTop + lines.length * 16 + i * 14 + 2} dominantBaseline="middle">
                {l}
              </tspan>
            ))}
          </text>
        )}
      </g>
      {n.items && <Chips n={n} top={textTop + lines.length * 16 + 4} />}
      {n.db && <DbGlyph x={n.x + n.w - 26} y={n.y + n.h - 26} />}
      {n.icon === "user" && <UserGlyph x={n.x + 20} y={cy} />}
      {n.icon === "cache" && <CacheGlyph x={n.x + 22} y={cy} />}
    </g>
  );
}

function Chips({ n, top }: { n: FNode; top: number }) {
  const items = n.items ?? [];
  const widths = items.map((s) => s.length * 6.6 + 22);
  const gap = 8;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let x = n.x + (n.w - total) / 2;
  return (
    <g className="arch-chips">
      {items.map((s, i) => {
        const cx = x;
        x += widths[i] + gap;
        return (
          <g key={s}>
            <rect x={cx} y={top} width={widths[i]} height={24} rx={12} />
            <text x={cx + widths[i] / 2} y={top + 12} textAnchor="middle" dominantBaseline="middle">
              {s}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function DbGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g className="arch-db" transform={`translate(${x} ${y})`}>
      <path d="M0,3 v12 a8,3 0 0 0 16,0 v-12" />
      <ellipse cx={8} cy={3} rx={8} ry={3} />
      <path d="M0,9 a8,3 0 0 0 16,0" fill="none" />
    </g>
  );
}

function UserGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g className="arch-glyph" transform={`translate(${x} ${y - 9})`}>
      <circle cx={8} cy={5} r={4.5} />
      <path d="M0,18 a8,7 0 0 1 16,0 z" />
    </g>
  );
}

function CacheGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g className="arch-glyph" transform={`translate(${x - 6} ${y - 10})`}>
      <path d="M8,0 L0,11 H6 L4,20 L13,8 H7 Z" />
    </g>
  );
}

const KIND_LABEL: Record<EdgeKind, string> = {
  sync: "API call (sync)",
  async: "Event (async)",
  data: "Data access (sync)",
  "data-async": "Data event (async)",
};

export function FlowDiagram({ view }: { view: FlowView }) {
  const uid = useId().replace(/:/g, "");
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [activeEdge, setActiveEdge] = useState<number | null>(null);

  const nodes = useMemo(() => new Map(view.nodes.map((n) => [n.id, n])), [view]);
  const edges = useMemo(
    () =>
      view.edges.map((e) => {
        const a = anchor(e.from, nodes);
        const b = anchor(e.to, nodes);
        const pts = route(a.p, a.side, (e.via ?? []).map(([x, y]) => ({ x, y })), b.p, b.side);
        const mid = e.lp ? { x: e.lp[0], y: e.lp[1] } : longestMid(pts);
        return { ...e, a, b, d: roundedPath(pts), mid };
      }),
    [view, nodes],
  );

  const related = (i: number) => {
    const e = edges[i];
    if (activeEdge !== null) return activeEdge === i;
    if (hoverNode) return e.a.id === hoverNode || e.b.id === hoverNode;
    return true;
  };
  const focusing = hoverNode !== null || activeEdge !== null;
  const boxes = view.nodes.filter((n) => n.kind === "box" || n.kind === undefined);
  const backdrops = view.nodes.filter((n) => n.kind === "group" || n.kind === "core" || n.kind === "headline");

  return (
    <div className="arch-flow">
      <svg viewBox={`0 0 ${view.width} ${view.height}`} className={`arch-svg${focusing ? " focusing" : ""}`}>
        <defs>
          {(["sync", "async", "data", "data-async"] as EdgeKind[]).map((k) => (
            <marker
              key={k}
              id={`${uid}-${k}`}
              viewBox="0 0 10 10"
              refX={9}
              refY={5}
              markerWidth={7}
              markerHeight={7}
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" className={`arch-marker-${k}`} />
            </marker>
          ))}
        </defs>

        {backdrops.map((n) => (
          <NodeShape key={n.id} n={n} />
        ))}

        {boxes.map((n) => (
          <g
            key={n.id}
            className={`arch-node${focusing && hoverNode !== n.id && !edges.some((e, i) => related(i) && (e.a.id === n.id || e.b.id === n.id)) ? " dim" : ""}`}
            onMouseEnter={() => setHoverNode(n.id)}
            onMouseLeave={() => setHoverNode(null)}
          >
            <NodeShape n={n} />
          </g>
        ))}

        {edges.map((e, i) => (
          <path
            key={i}
            d={e.d}
            className={`arch-edge arch-edge-${e.kind}${related(i) ? (focusing ? " hot" : "") : " dim"}`}
            markerEnd={`url(#${uid}-${e.kind})`}
            markerStart={e.both ? `url(#${uid}-${e.kind})` : undefined}
          />
        ))}

        {edges.map((e, i) =>
          e.label ? <EdgeLabel key={i} text={e.label} at={e.mid} dim={!related(i)} kind={e.kind} /> : null,
        )}
      </svg>

      <div className="arch-legend">
        {Array.from(new Set(view.edges.map((e) => e.kind))).map((k) => (
          <span key={k} className="arch-legend-item">
            <svg width="34" height="10">
              <line x1="0" y1="5" x2="34" y2="5" className={`arch-edge arch-edge-${k}`} />
            </svg>
            {KIND_LABEL[k]}
          </span>
        ))}
        <span className="arch-legend-item">
          <svg width="16" height="20" viewBox="0 0 16 20">
            <g className="arch-db">
              <path d="M0,3 v12 a8,3 0 0 0 16,0 v-12" />
              <ellipse cx={8} cy={3} rx={8} ry={3} />
            </g>
          </svg>
          Own database
        </span>
      </div>

      <ol className="arch-flows">
        {edges.map((e, i) => (
          <li
            key={i}
            className={activeEdge === i ? "active" : ""}
            onMouseEnter={() => setActiveEdge(i)}
            onMouseLeave={() => setActiveEdge(null)}
          >
            <span className={`arch-flow-kind arch-flow-kind-${e.kind}`}>{e.kind.startsWith("data") ? (e.kind === "data" ? "sync" : "async") : e.kind}</span>
            <span className="arch-flow-route">
              {nodeName(nodes.get(e.a.id)!)} {e.both ? "⇄" : "→"} {nodeName(nodes.get(e.b.id)!)}
            </span>
            {e.label && <span className="arch-flow-label">{e.label.replace(/\n/g, " ")}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function EdgeLabel({ text, at, dim, kind }: { text: string; at: Pt; dim: boolean; kind: EdgeKind }) {
  const lines = text.split("\n");
  const w = Math.max(...lines.map((l) => l.length)) * 6.3 + 16;
  const h = lines.length * 14 + 8;
  return (
    <g className={`arch-edge-label arch-edge-label-${kind}${dim ? " dim" : ""}`}>
      <rect x={at.x - w / 2} y={at.y - h / 2} width={w} height={h} rx={h / 2 > 12 ? 9 : h / 2} />
      <text textAnchor="middle">
        {lines.map((l, i) => (
          <tspan key={i} x={at.x} y={at.y - h / 2 + 11 + i * 14} dominantBaseline="middle">
            {l}
          </tspan>
        ))}
      </text>
    </g>
  );
}
