import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";

interface Props {
  children: ReactNode;
}

/** Only ever shown on the Azure deployment (AUTH_MODE=password) -- locally
 * this renders straight through to children. See backend/app/auth.py. */
export function AuthGate({ children }: Props) {
  const [status, setStatus] = useState<"loading" | "locked" | "open">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((s) => setStatus(!s.authRequired || s.authenticated ? "open" : "locked"))
      // Fail CLOSED -- see console-app's AuthGate.tsx for why (can't tell
      // a transient network error from a real AUTH_MODE=password gate).
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
        <div className="auth-gate-title">Mobile Banking Demo</div>
        <div className="auth-gate-subtitle">Enter the demo password to continue.</div>
        <input
          className="text-input"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error && <div className="error-banner">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={submitting || !password}>
          {submitting ? "..." : "Enter"}
        </button>
      </form>
    </div>
  );
}
