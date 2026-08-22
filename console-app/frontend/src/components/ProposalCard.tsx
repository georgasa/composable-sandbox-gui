import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AssistantMatchedResponse, ExecuteResponse, OperationDetail, PrepareResponse } from "../api/types";
import { ParamForm } from "./ParamForm";
import { ConfirmDialog } from "./ConfirmDialog";
import { ResponseViewer } from "./ResponseViewer";
import { useParty } from "../context/PartyContext";
import { seedPartyId } from "../utils/seedParty";

/** What the assistant chat renders for a matched intent. Reuses the exact
 * same ParamForm / ConfirmDialog / ResponseViewer as the catalog browser --
 * there is only one execution pipeline in the app, whether you got here by
 * typing a sentence or by clicking through the catalog tree. */
interface Props {
  initial: AssistantMatchedResponse;
  onViewInCatalog: (opKey: string) => void;
}

export function ProposalCard({ initial, onViewInCatalog }: Props) {
  const { activePartyId } = useParty();
  const [detail, setDetail] = useState<OperationDetail | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>(initial.preview.body || {});
  const [prepared, setPrepared] = useState<PrepareResponse | null>(initial);
  const [executed, setExecuted] = useState<ExecuteResponse | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    api.getOperationDetail(initial.opKey).then((d) => {
      setDetail(d);
      // fill gaps the assistant's extraction left empty -- explicit values
      // it already pulled from the user's message always win
      setParams((current) => ({ ...seedPartyId(d, activePartyId), ...current }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.opKey]);

  const handleParamsChange = (next: Record<string, unknown>) => {
    setParams(next);
    // Same fix as OperationWorkbench: a stale ConfirmDialog still claiming
    // a field is "missing" after you just picked a value for it (e.g. from
    // the account/loan dropdown) is exactly what made this confusing --
    // any edit invalidates the last preview instead of showing outdated info.
    setPrepared(null);
    setExecuted(null);
  };

  const handleRePrepare = async () => {
    setPreparing(true);
    try {
      const result = await api.prepare(initial.opKey, params, undefined, activePartyId);
      setPrepared(result);
      setExecuted(null); // clear a previous failed/succeeded result so Confirm shows again
    } finally {
      setPreparing(false);
    }
  };

  const failed = executed && !executed.ok;
  const stale = !prepared; // params changed (or first load) since the last successful preview

  return (
    <div className="proposal-card">
      <div className="card-label">
        Proposed API call {initial.confidence != null && `· confidence ${(initial.confidence * 100).toFixed(0)}%`}
      </div>
      <div className="op-summary" style={{ marginBottom: detail ? 0 : 10 }}>
        {initial.summary}
      </div>
      {detail && (
        <div className="op-category">
          {detail.service} · {detail.tags[0] || "General"}{" "}
          <button
            className="link-btn"
            onClick={() => onViewInCatalog(initial.opKey)}
            title="Open this operation in the Catalog tab"
          >
            View in Catalog →
          </button>
        </div>
      )}

      {/* Always available, not just when a field is missing -- lets you fix
          and retry after a failure (e.g. the assistant guessed a value the
          sandbox rejected), same as the catalog browser already allowed. */}
      {detail && (
        <>
          {((prepared && prepared.missingRequired.length > 0) || failed) && (
            <div className="confirm-banner" style={{ marginBottom: 12 }}>
              {failed
                ? "That call failed -- adjust the fields below and try again."
                : "A few required fields weren't clear from your message -- fill them in below."}
            </div>
          )}
          <ParamForm detail={detail} params={params} onChange={handleParamsChange} />
          <div className="btn-row">
            <button className="btn btn-primary" disabled={preparing} onClick={handleRePrepare}>
              {preparing ? (
                <span className="spinner" />
              ) : failed ? (
                "✎ Edit & Retry"
              ) : stale ? (
                "Preview Request"
              ) : (
                "Update Preview"
              )}
            </button>
          </div>
        </>
      )}

      {prepared && !executed && <ConfirmDialog prepared={prepared} onExecuted={setExecuted} />}
      {executed && <ResponseViewer result={executed} />}
    </div>
  );
}
