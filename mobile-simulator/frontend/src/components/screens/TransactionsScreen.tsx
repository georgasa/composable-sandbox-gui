import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { TransactionInfo } from "../../types";

interface Props {
  accountId: string;
  onBack: () => void;
}

export function TransactionsScreen({ accountId, onBack }: Props) {
  const [items, setItems] = useState<TransactionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getTransactions(accountId)
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }, [accountId]);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="screen-title">Transactions</div>
      </div>
      <div className="section-label">Account ...{accountId.slice(-4)}</div>
      {loading ? (
        <div className="empty-state">Loading transactions...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No transactions found</div>
      ) : (
        <div className="txn-list">
          {items.map((t) => (
            <div key={t.reference} className="txn-row">
              <div>
                <div className="txn-narrative">{t.narrative}</div>
                <div className="txn-date">{t.date}</div>
              </div>
              <div className={`txn-amount ${t.amount >= 0 ? "positive" : "negative"}`}>
                {t.amount >= 0 ? "+" : ""}
                {t.amount.toLocaleString()} {t.currency}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
