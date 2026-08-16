import { useState } from "react";
import { OperationWorkbench } from "./OperationWorkbench";

export interface FlowOp {
  opKey: string;
  label: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
}

interface Props {
  icon: string;
  title: string;
  description: string;
  ops: FlowOp[];
}

/** A curated, fixed subset of the catalog for a demo scenario -- same
 * click -> fill -> confirm -> execute pipeline as the full catalog browser
 * (via OperationWorkbench), just scoped to a short, presenter-friendly
 * list instead of making someone hunt through 323 operations mid-demo. */
export function FlowCard({ icon, title, description, ops }: Props) {
  const [selectedOpKey, setSelectedOpKey] = useState<string | null>(null);

  return (
    <div className="flow-card">
      <div className="flow-card-header">
        <span className="flow-icon">{icon}</span>
        <div>
          <div className="flow-title">{title}</div>
          <div className="flow-description">{description}</div>
        </div>
      </div>

      <div className="flow-op-list">
        {ops.map((op) => (
          <button
            key={op.opKey}
            className={`flow-op-item${op.opKey === selectedOpKey ? " selected" : ""}`}
            onClick={() => setSelectedOpKey(op.opKey)}
          >
            <span className={`method-badge ${op.method}`}>{op.method}</span>
            <span className="flow-op-label">{op.label}</span>
          </button>
        ))}
      </div>

      <div className="flow-workbench">
        {!selectedOpKey && <div className="empty-state">Pick a step above to fill it in and run it.</div>}
        {selectedOpKey && <OperationWorkbench key={selectedOpKey} opKey={selectedOpKey} />}
      </div>
    </div>
  );
}
