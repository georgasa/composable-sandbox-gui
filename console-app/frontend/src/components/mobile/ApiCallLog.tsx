import { useState } from "react";
import type { ApiCallRecord } from "../../types/mobile";

interface Props {
  calls: ApiCallRecord[];
}

/** Strips the sandbox host so the log reads as a path, matching how the
 * Catalog tab's request preview shows things -- the full base URL is
 * already visible per-service in the top bar's environment display. */
function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function CallRow({ call }: { call: ApiCallRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="api-call-row">
      <button className="api-call-summary" onClick={() => setOpen((o) => !o)}>
        <span className="api-call-toggle">{open ? "−" : "+"}</span>
        <span className={`method-badge ${call.method}`}>{call.method}</span>
        <span className="api-call-path">{shortUrl(call.url)}</span>
        <span className={`api-call-status ${call.ok ? "ok" : "fail"}`}>{call.statusCode ?? "ERR"}</span>
      </button>
      {open && (
        <div className="api-call-detail">
          <div className="api-call-detail-label">Full URL</div>
          <pre>{call.url}</pre>
          {call.requestBody != null && (
            <>
              <div className="api-call-detail-label">Request body</div>
              <pre>{JSON.stringify(call.requestBody, null, 2)}</pre>
            </>
          )}
          <div className="api-call-detail-label">Response ({call.statusCode ?? "no response"})</div>
          <pre>{JSON.stringify(call.responseData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/** Renders the exact real HTTP calls the backend fired at the live sandbox
 * for the most recent Mobile tab action -- the transparency mechanism for
 * a "curated, direct-execute" tab that (unlike the Catalog tab's
 * prepare/confirm/execute pipeline) has no built-in request preview of its
 * own. See MobileSessionContext's lastApiCalls and
 * backend/app/mobile_sandbox_client.py's `log` param. */
export function ApiCallLog({ calls }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`api-call-log${expanded ? " expanded" : ""}`}>
      <button className="api-call-log-header" onClick={() => setExpanded((e) => !e)}>
        <span>🔍 Under the Hood</span>
        <span className="count-badge count-badge-sm">{calls.length}</span>
        <span className="api-call-log-caret">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="api-call-log-body">
          {calls.length === 0 ? (
            <div className="api-call-log-empty">No sandbox calls made yet -- do something in the phone.</div>
          ) : (
            <>
              <div className="api-call-log-hint">
                Every real HTTP call the last action made against the live sandbox, in order:
              </div>
              {calls.map((c, i) => (
                <CallRow call={c} key={i} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
