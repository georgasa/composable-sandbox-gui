import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";

interface Props {
  children: ReactNode;
}

/** Only ever shown on the Azure deployment (AUTH_MODE=password) -- locally
 * (AUTH_MODE=none, the default) /api/auth/status reports authRequired:false
 * and this renders straight through to children. See backend/app/auth.py. */
export function AuthGate({ children }: Props) {
  const [status, setStatus] = useState<"loading" | "locked" | "open">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((s) => setStatus(!s.authRequired || s.authenticated ? "open" : "locked"))
      // Fail CLOSED, not open: we can't tell from a network error whether
      // AUTH_MODE is "none" (locally) or "password" (Azure) -- opening on
      // any transient error would defeat the gate on the one deployment
      // that actually needs it. Locally this only ever shows briefly while
      // the backend is still starting.
      .catch(() => setStatus("locked"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.login(password);
      setStatus("open");
    } catch {
      setError("Incorrect password.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") return null;
  if (status === "open") return <>{children}</>;

  return (
    <div className="auth-gate">
      <form className="auth-gate-card" onSubmit={handleSubmit}>
        <div className="auth-gate-title">Composable Hands-on Lab</div>
        <div className="auth-gate-subtitle">Enter the demo password to continue.</div>
        <input
          className="field-input"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error && <div className="confirm-banner">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={submitting || !password}>
          {submitting ? <span className="spinner" /> : "Enter"}
        </button>
      </form>
    </div>
  );
}
