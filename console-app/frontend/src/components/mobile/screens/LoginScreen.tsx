import { useMobileSession } from "../../../context/MobileSessionContext";

export function LoginScreen() {
  const { createCustomer, loading, error } = useMobileSession();

  return (
    <div className="screen screen-center">
      <div className="login-mark">🏦</div>
      <div className="login-title">Composable Banking</div>
      <div className="login-subtitle">Create a demo customer to begin -- opens and funds a current account automatically.</div>
      {error && <div className="error-banner">{error}</div>}
      <button className="btn btn-primary btn-block" onClick={createCustomer} disabled={loading}>
        {loading ? "Creating..." : "Create Demo Customer"}
      </button>
      <div className="login-subtitle">
        Already have a party ID? Enter it in the party bar above and click Set -- this tab picks it up automatically.
      </div>
    </div>
  );
}
