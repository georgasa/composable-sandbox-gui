import type { AccountDetails, AccountInfo, CustomerInfo, LoanScheduleEntry, TransactionInfo } from "../types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.detail?.errors?.join?.("; ") || body?.error?.[0]?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  getAuthStatus: () => request<{ authRequired: boolean; authenticated: boolean }>("/auth/status"),
  login: (password: string) =>
    request<{ ok: boolean }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),

  createCustomer: (firstName?: string, lastName?: string) =>
    request<{ partyId: string; firstName: string; lastName: string; accountId: string | null }>("/mobile/customer", {
      method: "POST",
      body: JSON.stringify({ firstName, lastName }),
    }),

  getCustomer: (partyId: string) => request<CustomerInfo>(`/mobile/customer/${partyId}`),

  getArrangements: (partyId: string) =>
    request<{ accounts: AccountInfo[]; loans: AccountInfo[] }>(`/mobile/customer/${partyId}/arrangements`),

  getTransactions: (accountId: string) =>
    request<{ items: TransactionInfo[] }>(`/mobile/accounts/${accountId}/transactions`),

  getAccountDetails: (accountId: string) => request<AccountDetails>(`/mobile/accounts/${accountId}/details`),

  openAccount: (partyId: string, fundingAmount?: number) =>
    request<{ accountId: string | null }>("/mobile/accounts", {
      method: "POST",
      body: JSON.stringify({ partyId, fundingAmount }),
    }),

  transfer: (fromAccountId: string, toAccountId: string, amount: number, description: string) =>
    request<{ ok: boolean }>("/mobile/transfer", {
      method: "POST",
      body: JSON.stringify({ fromAccountId, toAccountId, amount, description }),
    }),

  createLoan: (partyId: string, settlementAccountId: string, amount: number, term: string) =>
    request<{ loanId: string | null }>("/mobile/loans", {
      method: "POST",
      body: JSON.stringify({ partyId, settlementAccountId, amount, term }),
    }),

  getLoanSchedule: (loanId: string) => request<{ items: LoanScheduleEntry[] }>(`/mobile/loans/${loanId}/schedule`),
};
