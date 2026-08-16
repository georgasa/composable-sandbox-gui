import type { ExecuteResponse } from "../api/types";

export function ResponseViewer({ result }: { result: ExecuteResponse }) {
  return (
    <div className="response-panel">
      <div className="status-line">
        <span className={`status-badge ${result.ok ? "ok" : "error"}`}>
          {result.statusCode ?? "NO RESPONSE"} {result.ok ? "SUCCESS" : "FAILED"}
        </span>
        <span className="duration">{result.durationMs}ms</span>
      </div>
      {result.errors.length > 0 && (
        <div className="known-issue-banner">
          <span className="icon">⚠</span>
          <span>
            {/* Sandbox errors come back as {"error":[{"message":...}]}, sometimes
                even under HTTP 200 -- this banner is the same signal regardless
                of status code, per this workspace's CLAUDE.md. */}
            {result.errors.join("; ")}
          </span>
        </div>
      )}
      <pre className="preview-body">{JSON.stringify(result.data, null, 2)}</pre>
    </div>
  );
}
