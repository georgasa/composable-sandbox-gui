import { useState } from "react";
import { useSession } from "../../context/SessionContext";

interface Props {
  onSelectLoan: (loanId: string) => void;
}

export function LoansScreen({ onSelectLoan }: Props) {
  const { loans, accounts, createLoan, loading } = useSession();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("50000");
  const [term, setTerm] = useState("5Y");
  const [settlementAccountId, setSettlementAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementAccountId || !amount) return;
    setSubmitting(true);
    setError(null);
    try {
      await createLoan(settlementAccountId, parseFloat(amount), term);
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen">
      <div className="section-label">Loans</div>
      {loans.length > 0 ? (
        <div className="account-list">
          {loans.map((l) => (
            <div key={l.accountId} className="account-card" onClick={() => onSelectLoan(l.accountId)}>
              <div className="account-card-row">
                <span className="account-card-name">{l.accountName}</span>
                <span className="account-card-id">...{l.accountId.slice(-4)}</span>
              </div>
              <div className="account-card-balance">{l.status}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">No loans yet</div>
      )}

      {!showForm ? (
        <button className="btn btn-secondary btn-block" onClick={() => setShowForm(true)} disabled={accounts.length === 0}>
          + New Consumer Loan
        </button>
      ) : (
        <form className="form-stack" onSubmit={handleCreate}>
          <label className="field-label">Settlement account</label>
          <select className="text-input" value={settlementAccountId} onChange={(e) => setSettlementAccountId(e.target.value)}>
            <option value="">-- select account --</option>
            {accounts.map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.accountName} (...{a.accountId.slice(-4)})
              </option>
            ))}
          </select>
          <label className="field-label">Amount (USD)</label>
          <input className="text-input" type="number" min="1000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <label className="field-label">Term</label>
          <select className="text-input" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="1Y">1 year</option>
            <option value="3Y">3 years</option>
            <option value="5Y">5 years</option>
            <option value="10Y">10 years</option>
          </select>
          {error && <div className="error-banner">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting || loading || !settlementAccountId}>
            {submitting ? "Creating..." : "Create Loan"}
          </button>
        </form>
      )}
    </div>
  );
}
