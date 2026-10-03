import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { useMobileSession } from "../../../context/MobileSessionContext";
import type { TransactionInfo } from "../../../types/mobile";

interface Props {
  accountId: string;
  onBack: () => void;
}

export function TransactionsScreen({ accountId, onBack }: Props) {
  const { accounts, recordCalls, closeAccount } = useMobileSession();
  const [items, setItems] = useState<TransactionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const account = accounts.find((a) => a.accountId === accountId);
  const isEmpty = !account || account.workingBalance === 0;

  useEffect(() => {
    setLoading(true);
    api
      .getMobileTransactions(accountId)
      .then((r) => {
        setItems(r.items);
        recordCalls("View transactions", r.apiCalls);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const handleClose = async () => {
    if (!window.confirm(`Close account ...${accountId.slice(-4)}? This cannot be undone.`)) return;
    setClosing(true);
    setCloseError(null);
    try {
      await closeAccount(accountId);
      onBack();
    } catch (e) {
      setCloseError(e instanceof Error ? e.message : String(e));
    } finally {
      setClosing(false);
    }
  };

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

      <div className="section-label">Close account</div>
      <div className="hint-box">
        Tip: the account must be empty before it can be closed. Transfer any remaining balance to another account first.
      </div>
      {closeError && <div className="error-banner">{closeError}</div>}
      <button className="btn btn-danger btn-block" onClick={handleClose} disabled={closing || !isEmpty}>
        {closing ? "Closing..." : isEmpty ? "Close this account" : "Balance must be 0 to close"}
      </button>
    </div>
  );
}
