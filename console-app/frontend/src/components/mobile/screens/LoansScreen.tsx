import { useState } from "react";
import { useMobileSession, type LoanType } from "../../../context/MobileSessionContext";

interface Props {
  onSelectLoan: (loanId: string) => void;
}

interface LoanProduct {
  label: string;
  newLabel: string;
  promoTitle: string;
  promoBody: string;
  min: number;
  max: number;
  defaultAmount: number;
  terms: { value: string; label: string }[];
  defaultTerm: string;
}

const PRODUCTS: Record<LoanType, LoanProduct> = {
  consumer: {
    label: "Personal loan",
    newLabel: "+ New Personal Loan",
    promoTitle: "⚡ Get up to $20,000 — in minutes",
    promoBody:
      "Pre-approved, no branch visit, no physical paperwork, no waiting days for a decision. " +
      "Apply from your phone and have funds in your account in minutes, not weeks.",
    min: 1000,
    max: 20000,
    defaultAmount: 20000,
    terms: [
      { value: "1Y", label: "1 year" },
      { value: "3Y", label: "3 years" },
      { value: "5Y", label: "5 years" },
      { value: "10Y", label: "10 years" },
    ],
    defaultTerm: "5Y",
  },
  mortgage: {
    label: "Mortgage",
    newLabel: "+ New Mortgage",
    promoTitle: "🏡 Your home, on your terms",
    promoBody:
      "Borrow up to $500,000 over up to 20 years with predictable monthly repayments. " +
      "Apply in the app, track your repayment schedule any time, and pay off early when you are ready.",
    min: 50000,
    max: 500000,
    defaultAmount: 250000,
    // Capped at 20 years: the sandbox's holiday calendar ends in 2049 and the
    // business date is fixed at 2025-03-14, so longer terms fail with
    // "HOLIDAY TABLE MISSING FOR GB00xxxx".
    terms: [
      { value: "10Y", label: "10 years" },
      { value: "15Y", label: "15 years" },
      { value: "20Y", label: "20 years" },
    ],
    defaultTerm: "20Y",
  },
};

function formatMoney(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n || 0);
}

export function LoansScreen({ onSelectLoan }: Props) {
  const { loans, accounts, createLoan, loading } = useMobileSession();
  const [loanType, setLoanType] = useState<LoanType>("consumer");
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState(String(PRODUCTS.consumer.defaultAmount));
  const [term, setTerm] = useState(PRODUCTS.consumer.defaultTerm);
  const [settlementAccountId, setSettlementAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const product = PRODUCTS[loanType];
  // Loans are in USD, so only USD accounts can receive and repay them.
  const settlementAccounts = accounts.filter((a) => a.currency === "USD");

  const selectType = (type: LoanType) => {
    setLoanType(type);
    setAmount(String(PRODUCTS[type].defaultAmount));
    setTerm(PRODUCTS[type].defaultTerm);
    setError(null);
    setShowForm(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!settlementAccountId || !value) return;
    if (value < product.min || value > product.max) {
      setError(`Amount must be between ${formatMoney(product.min).replace('.00', '')} and ${formatMoney(product.max).replace('.00', '')}.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createLoan(settlementAccountId, value, term, loanType);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
              <div className="account-card-balance">{formatMoney(l.workingBalance, l.currency)}</div>
              <div className="account-card-sub">Outstanding balance · {l.status}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">No loans yet</div>
      )}

      <div className="segmented">
        {(Object.keys(PRODUCTS) as LoanType[]).map((type) => (
          <button
            key={type}
            type="button"
            className={`segmented-option${loanType === type ? " active" : ""}`}
            onClick={() => selectType(type)}
          >
            {PRODUCTS[type].label}
          </button>
        ))}
      </div>

      <div className="promo-card">
        <div className="promo-card-title">{product.promoTitle}</div>
        <div className="promo-card-body">{product.promoBody}</div>
      </div>

      {!showForm ? (
        <button className="btn btn-secondary btn-block" onClick={() => setShowForm(true)} disabled={accounts.length === 0}>
          {product.newLabel}
        </button>
      ) : (
        <form className="form-stack" onSubmit={handleCreate}>
          <label className="field-label">Settlement account (USD)</label>
          <select className="text-input" value={settlementAccountId} onChange={(e) => setSettlementAccountId(e.target.value)}>
            <option value="">-- select account --</option>
            {settlementAccounts.map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.accountName} (...{a.accountId.slice(-4)})
              </option>
            ))}
          </select>
          {settlementAccounts.length === 0 && (
            <div className="hint-box">Open a USD account first — loans are paid out to and repaid from a USD account.</div>
          )}
          <label className="field-label">
            Amount (USD, {formatMoney(product.min).replace('.00', '')} – {formatMoney(product.max).replace('.00', '')})
          </label>
          <input
            className="text-input"
            type="number"
            min={product.min}
            max={product.max}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <label className="field-label">Term</label>
          <select className="text-input" value={term} onChange={(e) => setTerm(e.target.value)}>
            {product.terms.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {error && <div className="error-banner">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting || loading || !settlementAccountId}>
            {submitting ? "Creating..." : `Create ${product.label}`}
          </button>
        </form>
      )}
    </div>
  );
}
