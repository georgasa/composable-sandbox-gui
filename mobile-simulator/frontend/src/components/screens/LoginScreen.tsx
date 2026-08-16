import { useSession } from "../../context/SessionContext";

export function LoginScreen() {
  const { createCustomer, loading, error } = useSession();

  return (
    <div className="screen screen-center">
      <div className="login-mark">🏦</div>
      <div className="login-title">Composable Banking</div>
      <div className="login-subtitle">Create a demo customer to begin -- opens and funds a current account automatically.</div>
      {error && <div className="error-banner">{error}</div>}
      <button className="btn btn-primary btn-block" onClick={createCustomer} disabled={loading}>
        {loading ? "Creating..." : "Create Demo Customer"}
      </button>
    </div>
  );
}
