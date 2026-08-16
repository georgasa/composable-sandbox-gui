import { useState } from "react";
import { useSession } from "../../context/SessionContext";

export function TransferScreen() {
  const { accounts, transfer, loading } = useSession();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (accounts.length < 2) {
    return (
      <div className="screen screen-center">
        <div className="section-label">Transfers</div>
        <div className="empty-state">Open at least 2 accounts to enable transfers</div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId || fromId === toId || !amount) return;
    setSubmitting(true);
    setError(null);
    try {
      await transfer(fromId, toId, parseFloat(amount));
      setDone(true);
      setTimeout(() => setDone(false), 2000);
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen">
      <div className="section-label">Between Own Accounts</div>
      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field-label">From</label>
        <select className="text-input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
          <option value="">-- select account --</option>
          {accounts.map((a) => (
            <option key={a.accountId} value={a.accountId}>
              {a.accountName} (...{a.accountId.slice(-4)}) -- {a.workingBalance.toLocaleString()} {a.currency}
            </option>
          ))}
        </select>

        <label className="field-label">To</label>
        <select className="text-input" value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">-- select account --</option>
          {accounts.map((a) => (
            <option key={a.accountId} value={a.accountId}>
              {a.accountName} (...{a.accountId.slice(-4)})
            </option>
          ))}
        </select>

        <label className="field-label">Amount (USD)</label>
        <input className="text-input" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />

        {error && <div className="error-banner">{error}</div>}

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={submitting || loading || !fromId || !toId || fromId === toId || !amount}
        >
          {submitting ? "Transferring..." : done ? "Sent!" : "Transfer"}
        </button>
      </form>
    </div>
  );
}
