import type {
  AssistantResponse,
  CatalogResponse,
  ConfigResponse,
  EnvironmentResponse,
  ExecuteResponse,
  LLMConfigResponse,
  OperationDetail,
  PrepareResponse,
  TestEndpointResponse,
} from "./types";
import type { AccountDetails, AccountInfo, CustomerInfo, LoanScheduleEntry, TransactionInfo } from "../types/mobile";

// nginx.conf proxies /api/* to the backend Service by DNS name in
// production, and vite.config.ts proxies the same path to localhost:8000
// in local dev -- the frontend never needs to know the backend's real
// address, and there is no CORS configuration anywhere as a result.
const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ? JSON.stringify(body.detail) : `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getAuthStatus: () => request<{ authRequired: boolean; authenticated: boolean }>("/auth/status"),

  login: (password: string) =>
    request<{ ok: boolean }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),

  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  getConfig: () => request<ConfigResponse>("/config"),

  getCatalog: () => request<CatalogResponse>("/catalog"),

  getOperationDetail: (opKey: string) =>
    request<OperationDetail>(`/catalog/${encodeURIComponent(opKey)}`),

  prepare: (opKey: string, params: Record<string, unknown>, baseUrlOverride?: string, activePartyId?: string | null) =>
    request<PrepareResponse>("/prepare", {
      method: "POST",
      body: JSON.stringify({
        op_key: opKey,
        params,
        base_url_override: baseUrlOverride,
        active_party_id: activePartyId,
      }),
    }),

  execute: (pendingExecutionId: string, editedBody?: unknown, editedQuery?: unknown) =>
    request<ExecuteResponse>("/execute", {
      method: "POST",
      body: JSON.stringify({
        pending_execution_id: pendingExecutionId,
        edited_body: editedBody,
        edited_query: editedQuery,
      }),
    }),

  assistantQuery: (message: string, activePartyId?: string | null) =>
    request<AssistantResponse>("/assistant/query", {
      method: "POST",
      body: JSON.stringify({ message, active_party_id: activePartyId }),
    }),

  getEnvironment: () => request<EnvironmentResponse>("/environment"),

  updateEnvironment: (env: { label: string; prefix: string; seed: string; region: string }) =>
    request<EnvironmentResponse>("/environment", {
      method: "PUT",
      body: JSON.stringify(env),
    }),

  testEndpoint: (url: string) =>
    request<TestEndpointResponse>("/environment/test", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  getLLMConfig: () => request<LLMConfigResponse>("/llm-config"),

  updateLLMConfig: (config: { provider?: string; apiKey?: string; model?: string }) =>
    request<LLMConfigResponse>("/llm-config", {
      method: "PUT",
      body: JSON.stringify({ provider: config.provider, api_key: config.apiKey, model: config.model }),
    }),

  testLLMConfig: () => request<{ ok: boolean }>("/llm-config/test", { method: "POST" }),

  // ---------- Mobile tab (curated, direct-execute -- see backend/app/api/mobile_routes.py) ----------

  createMobileCustomer: (firstName?: string, lastName?: string) =>
    request<{ partyId: string; firstName: string; lastName: string; accountId: string | null }>("/mobile/customer", {
      method: "POST",
      body: JSON.stringify({ firstName, lastName }),
    }),

  getMobileCustomer: (partyId: string) => request<CustomerInfo>(`/mobile/customer/${partyId}`),

  getMobileArrangements: (partyId: string) =>
    request<{ accounts: AccountInfo[]; loans: AccountInfo[] }>(`/mobile/customer/${partyId}/arrangements`),

  getMobileTransactions: (accountId: string) =>
    request<{ items: TransactionInfo[] }>(`/mobile/accounts/${accountId}/transactions`),

  getMobileAccountDetails: (accountId: string) => request<AccountDetails>(`/mobile/accounts/${accountId}/details`),

  openMobileAccount: (partyId: string, fundingAmount?: number) =>
    request<{ accountId: string | null }>("/mobile/accounts", {
      method: "POST",
      body: JSON.stringify({ partyId, fundingAmount }),
    }),

  mobileTransfer: (fromAccountId: string, toAccountId: string, amount: number, description: string) =>
    request<{ ok: boolean }>("/mobile/transfer", {
      method: "POST",
      body: JSON.stringify({ fromAccountId, toAccountId, amount, description }),
    }),

  createMobileLoan: (partyId: string, settlementAccountId: string, amount: number, term: string) =>
    request<{ loanId: string | null }>("/mobile/loans", {
      method: "POST",
      body: JSON.stringify({ partyId, settlementAccountId, amount, term }),
    }),

  getMobileLoanSchedule: (loanId: string) =>
    request<{ items: LoanScheduleEntry[] }>(`/mobile/loans/${loanId}/schedule`),
};
