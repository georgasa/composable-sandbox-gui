import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useParty } from "./PartyContext";
import type { AccountInfo, CustomerInfo } from "../types/mobile";

interface MobileSessionContextValue {
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
}

const MobileSessionContext = createContext<MobileSessionContextValue | null>(null);

/** Wraps the app-wide party session (PartyContext -- the same "Party: ...
 * Set / + Create New Party" bar the Catalog/Assistant tabs already use) so
 * pinning an EXISTING party ID there also drives the Mobile tab: no
 * separate "load existing customer" flow needed, this just reacts to
 * activePartyId changing, from whichever tab changed it. */
export function MobileSessionProvider({ children }: { children: ReactNode }) {
  const { activePartyId, setActivePartyId } = useParty();
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loans, setLoans] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!activePartyId) return;
    setLoading(true);
    try {
      const [customerInfo, arrangements] = await Promise.all([
        api.getMobileCustomer(activePartyId),
        api.getMobileArrangements(activePartyId),
      ]);
      setCustomer(customerInfo);
      setAccounts(arrangements.accounts);
      setLoans(arrangements.loans);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activePartyId]);

  // Whenever the shared active party changes -- whether from this tab's
  // "Create Demo Customer", or from typing an existing ID into the party
  // bar while on the Catalog tab -- refetch this tab's view of it.
  useEffect(() => {
    if (!activePartyId) {
      setCustomer(null);
      setAccounts([]);
      setLoans([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePartyId]);

  const createCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.createMobileCustomer();
      setActivePartyId(result.partyId); // pins it app-wide, same as "+ Create New Party" elsewhere
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, [setActivePartyId]);

  const transfer = useCallback(
    async (from: string, to: string, amount: number) => {
      await api.mobileTransfer(from, to, amount, "Mobile transfer");
      await refresh();
    },
    [refresh]
  );

  const openAccount = useCallback(
    async (fundingAmount?: number) => {
      if (!activePartyId) return;
      await api.openMobileAccount(activePartyId, fundingAmount);
      await refresh();
    },
    [activePartyId, refresh]
  );

  const createLoan = useCallback(
    async (settlementAccountId: string, amount: number, term: string) => {
      if (!activePartyId) return;
      await api.createMobileLoan(activePartyId, settlementAccountId, amount, term);
      await refresh();
    },
    [activePartyId, refresh]
  );

  return (
    <MobileSessionContext.Provider
      value={{ partyId: activePartyId, customer, accounts, loans, loading, error, createCustomer, refresh, transfer, openAccount, createLoan }}
    >
      {children}
    </MobileSessionContext.Provider>
  );
}

export function useMobileSession(): MobileSessionContextValue {
  const ctx = useContext(MobileSessionContext);
  if (!ctx) throw new Error("useMobileSession must be used within MobileSessionProvider");
  return ctx;
}
