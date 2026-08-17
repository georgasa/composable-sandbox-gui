import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import type { LoanScheduleEntry } from "../../../types/mobile";

interface Props {
  loanId: string;
  onBack: () => void;
}

export function LoanScheduleScreen({ loanId, onBack }: Props) {
  const [items, setItems] = useState<LoanScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getMobileLoanSchedule(loanId)
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }, [loanId]);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="screen-title">Payment Schedule</div>
      </div>
      {loading ? (
        <div className="empty-state">Loading schedule...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No schedule available</div>
      ) : (
        <div className="schedule-list">
          {items.map((entry) => (
            <div key={entry.installmentNumber} className="schedule-row">
              <div className="schedule-num">#{entry.installmentNumber}</div>
              <div className="schedule-mid">
                <div>{entry.date || "Disbursement"}</div>
                <div className="txn-date">Principal {entry.principal}</div>
              </div>
              <div className="schedule-balance">{entry.balance}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
