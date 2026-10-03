import { useEffect, useState } from "react";
import { useMobileSession } from "../../../context/MobileSessionContext";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(amount || 0);
}

interface Props {
  onSelectAccount: (accountId: string) => void;
}

export function DashboardScreen({ onSelectAccount }: Props) {
  const { customer, accounts, loading, refresh, openAccount } = useMobileSession();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleOpen = async (fundingAmount: number | undefined, type: "current" | "savings") => {
    setActionError(null);
    try {
      await openAccount(fundingAmount, type);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen">
      <div className="hello-block">
        <div className="hello-label">Hello,</div>
        <div className="hello-name">
          {customer ? `${customer.firstName} ${customer.lastName}` : "Customer"}
        </div>
      </div>

      <div className="section-label">Accounts</div>
      {accounts.length > 0 ? (
        <div className="account-list">
          {accounts.map((acc) => (
            <div key={acc.accountId} className="account-card" onClick={() => onSelectAccount(acc.accountId)}>
              <div className="account-card-row">
                <span className="account-card-name">{acc.accountName}</span>
                <span className="account-card-id">...{acc.accountId.slice(-4)}</span>
              </div>
              <div className="account-card-balance">{formatCurrency(acc.workingBalance, acc.currency)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">{loading ? "Loading..." : "No accounts yet"}</div>
      )}

      {actionError && <div className="error-banner">{actionError}</div>}
      <button className="btn btn-secondary btn-block" onClick={() => handleOpen(1000, "current")} disabled={loading}>
        + Open Current Account
      </button>
      <button className="btn btn-secondary btn-block" onClick={() => handleOpen(undefined, "savings")} disabled={loading}>
        + Open Savings Account
      </button>
    </div>
  );
}
