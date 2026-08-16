import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { AccountInfo, CustomerInfo } from "../types";

interface SessionContextValue {
  partyId: string | null;
  customer: CustomerInfo | null;
  accounts: AccountInfo[];
  loans: AccountInfo[];
  loading: boolean;
  error: string | null;
  createCustomer: () => Promise<void>;
  refresh: () => Promise<void>;
  transfer: (from: string, to: string, amount: number) => Promise<void>;
  openAccount: (fundingAmount?: number) => Promise<void>;
  createLoan: (settlementAccountId: string, amount: number, term: string) => Promise<void>;
  reset: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [partyId, setPartyId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loans, setLoans] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (pid?: string) => {
    const id = pid || partyId;
    if (!id) return;
    setLoading(true);
    try {
      const [customerInfo, arrangements] = await Promise.all([api.getCustomer(id), api.getArrangements(id)]);
      setCustomer(customerInfo);
      setAccounts(arrangements.accounts);
      setLoans(arrangements.loans);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  const createCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.createCustomer();
      setPartyId(result.partyId);
      await refresh(result.partyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const transfer = useCallback(
    async (from: string, to: string, amount: number) => {
      await api.transfer(from, to, amount, "Mobile transfer");
      await refresh();
    },
    [refresh]
  );

  const openAccount = useCallback(
    async (fundingAmount?: number) => {
      if (!partyId) return;
      await api.openAccount(partyId, fundingAmount);
      await refresh();
    },
    [partyId, refresh]
  );

  const createLoan = useCallback(
    async (settlementAccountId: string, amount: number, term: string) => {
      if (!partyId) return;
      await api.createLoan(partyId, settlementAccountId, amount, term);
      await refresh();
    },
    [partyId, refresh]
  );

  const reset = useCallback(() => {
    setPartyId(null);
    setCustomer(null);
    setAccounts([]);
    setLoans([]);
    setError(null);
  }, []);

  return (
    <SessionContext.Provider
      value={{ partyId, customer, accounts, loans, loading, error, createCustomer, refresh, transfer, openAccount, createLoan, reset }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
