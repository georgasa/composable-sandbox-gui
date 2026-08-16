import { useState } from "react";
import { api } from "../api/client";
import type { ExecuteResponse, PrepareResponse } from "../api/types";

interface Props {
  prepared: PrepareResponse;
  onExecuted: (result: ExecuteResponse) => void;
}

/** The single point in the whole app where a real HTTP request can be
 * fired -- prepared.pendingExecutionId was minted server-side by
 * /api/prepare or /api/assistant/query and is one-time-use, so this
 * button press is the only thing that can turn a proposal into an actual
 * sandbox call (see backend execution/pending_store.py). */
export function ConfirmDialog({ prepared, onExecuted }: Props) {
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setExecuting(true);
    setError(null);
    try {
      const result = await api.execute(prepared.pendingExecutionId);
      onExecuted(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div>
      {prepared.knownIssue && (
        <div className="known-issue-banner">
          <span className="icon">⚠</span>
          <span>{prepared.knownIssue}</span>
        </div>
      )}
      {!prepared.documented && (
        <div className="undocumented-banner">
          <span className="icon">ⓘ</span>
          <span>
            This operation is not present in any OpenAPI spec in this workspace -- it was
            reverse-engineered from the verified demo scripts and is known to work, but treat
            its shape as less authoritative than a documented endpoint.
          </span>
        </div>
      )}

      <div className="preview-box">
        <div className="preview-line1">
          <span className={`method-badge ${prepared.preview.method}`}>{prepared.preview.method}</span>
          {prepared.preview.url}
          {Object.keys(prepared.preview.query).length > 0 && (
            <span>?{new URLSearchParams(prepared.preview.query as Record<string, string>).toString()}</span>
          )}
        </div>
        {prepared.preview.body && (
          <pre className="preview-body">{JSON.stringify(prepared.preview.body, null, 2)}</pre>
        )}
      </div>

      {Object.keys(prepared.autofilled).length > 0 && (
        <div className="field-hint" style={{ marginTop: 8 }}>
          Auto-filled by sandbox rules: {Object.keys(prepared.autofilled).join(", ")}
        </div>
      )}

      {prepared.missingRequired.length > 0 ? (
        <div className="confirm-banner">
          Missing required field{prepared.missingRequired.length > 1 ? "s" : ""}:{" "}
          <b>{prepared.missingRequired.join(", ")}</b> -- fill them in above before sending.
        </div>
      ) : (
        <div className="confirm-banner">
          This will fire a real {prepared.preview.method} request against the live sandbox.
        </div>
      )}

      {error && <div className="confirm-banner">{error}</div>}

      <div className="btn-row">
        <button
          className="btn btn-primary"
          disabled={executing || prepared.missingRequired.length > 0}
          onClick={handleConfirm}
        >
          {executing ? <span className="spinner" /> : "Confirm & Send"}
        </button>
      </div>
    </div>
  );
}
