import { FlowCard, type FlowOp } from "../components/FlowCard";

// Real op_keys, verified against the live catalog (see console-app dev
// notes) -- not placeholders. "Get Transactions" deliberately uses the
// undocumented-but-verified Holdings query endpoint (see
// backend/app/catalog/loader.py's supplemental_operations) rather than the
// spec'd getAccountsStatement, since CLAUDE.md documents that one as the
// reliable shape on this sandbox.
const ACCOUNTS_AND_DEPOSITS: FlowOp[] = [
  { opKey: "Deposits/holdings-accounts-service-v1.0.0:POST:/holdings/accounts/currentAccounts", label: "Create Current Account", method: "POST" },
  { opKey: "Deposits/order-payments-service-v1.0.0:POST:/order/payments/creditAccount", label: "Credit Account", method: "POST" },
  { opKey: "Deposits/order-payments-service-v1.0.0:POST:/order/payments/debitAccount", label: "Debit Account", method: "POST" },
  { opKey: "Deposits/order-payments-service-v1.0.0:POST:/order/payments/internalTransfer", label: "Internal Transfer", method: "POST" },
  { opKey: "Holdings:GET:/holdings/accounts/{companyAccountId}/transactions", label: "Get Transactions", method: "GET" },
  { opKey: "Deposits/holdings-accounts-service-v1.0.0:GET:/holdings/accounts/{accountId}/balances", label: "Get Balances", method: "GET" },
];

const RETAIL_LENDING: FlowOp[] = [
  { opKey: "Lending/holdings-loans-service-v1.0.0:POST:/holdings/lending/consumerLoans", label: "Create Consumer Loan", method: "POST" },
  { opKey: "Lending/holdings-loans-service-v1.0.0:POST:/holdings/lending/mortgages", label: "Create Mortgage", method: "POST" },
];

export function Flows() {
  return (
    <div className="flows-layout">
      <FlowCard
        icon="🏦"
        title="Accounts and Deposits"
        description="Account management and deposit operations"
        ops={ACCOUNTS_AND_DEPOSITS}
      />
      <FlowCard
        icon="📋"
        title="Retail Lending"
        description="Loan creation and disbursement"
        ops={RETAIL_LENDING}
      />
    </div>
  );
}
