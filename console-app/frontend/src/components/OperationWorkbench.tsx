import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ExecuteResponse, OperationDetail, PrepareResponse } from "../api/types";
import { ParamForm } from "./ParamForm";
import { ConfirmDialog } from "./ConfirmDialog";
import { ResponseViewer } from "./ResponseViewer";
import { useParty } from "../context/PartyContext";
import { seedPartyId } from "../utils/seedParty";

/** The detail -> form -> confirm -> response panel, extracted out of
 * CatalogBrowser so the curated demo Flows page can reuse the exact same
 * pipeline for a fixed handful of operations instead of duplicating it.
 * Self-contained: owns its own detail/params/prepared/executed state keyed
 * off `opKey`, so multiple instances (e.g. two flow cards side by side)
 * never interfere with each other. */
export function OperationWorkbench({ opKey }: { opKey: string }) {
  const { activePartyId } = useParty();
  const [detail, setDetail] = useState<OperationDetail | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [prepared, setPrepared] = useState<PrepareResponse | null>(null);
  const [executed, setExecuted] = useState<ExecuteResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = async () => {
    setDetail(null);
    setParams({});
    setPrepared(null);
    setExecuted(null);
    setPrepareError(null);
    setDetailError(null);
    setLoadingDetail(true);
    try {
      const d = await api.getOperationDetail(opKey);
      setDetail(d);
      setParams(seedPartyId(d, activePartyId));
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingDetail(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opKey]);

  const handleParamsChange = (next: Record<string, unknown>) => {
    setParams(next);
    // A stale ConfirmDialog showing a "missing" field the user just filled
    // in (e.g. after picking a value from the account/loan dropdown) is
    // exactly what made this confusing -- any edit invalidates the last
    // preview, so it disappears until the user re-previews with the new
    // values rather than showing outdated missing-required info.
    setPrepared(null);
    setExecuted(null);
  };

  const handlePreview = async () => {
    if (!detail) return;
    setPreparing(true);
    setPrepareError(null);
    try {
      const result = await api.prepare(detail.opKey, params, undefined, activePartyId);
      setPrepared(result);
      setExecuted(null); // clear any previous failed/succeeded result so Confirm shows again
    } catch (e) {
      setPrepareError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreparing(false);
    }
  };

  if (loadingDetail) return <div className="empty-state">Loading...</div>;

  if (detailError) {
    return (
      <div className="confirm-banner" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        <span>Couldn't load this operation: {detailError}</span>
        <button className="btn" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <>
      <div className="op-header">
        <div className="op-path">
          <span className={`method-badge ${detail.method}`}>{detail.method}</span>
          {detail.path}
        </div>
        <div className="op-summary">{detail.summary}</div>
      </div>

      {detail.knownIssue && (
        <div className="known-issue-banner">
          <span className="icon">⚠</span>
          <span>{detail.knownIssue}</span>
        </div>
      )}
      {!detail.documented && (
        <div className="undocumented-banner">
          <span className="icon">ⓘ</span>
          <span>Not present in any OpenAPI spec -- reverse-engineered from the verified demo scripts.</span>
        </div>
      )}

      <ParamForm detail={detail} params={params} onChange={handleParamsChange} />

      {prepareError && <div className="confirm-banner">{prepareError}</div>}

      <div className="btn-row">
        <button className="btn btn-primary" disabled={preparing} onClick={handlePreview}>
          {preparing ? (
            <span className="spinner" />
          ) : executed && !executed.ok ? (
            "✎ Edit & Retry"
          ) : (
            "Preview Request"
          )}
        </button>
      </div>

      {prepared && !executed && <ConfirmDialog prepared={prepared} onExecuted={setExecuted} />}
      {executed && <ResponseViewer result={executed} />}
    </>
  );
}
