import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useParty } from "./PartyContext";
import type { AccountInfo, ApiCallRecord, CustomerInfo } from "../types/mobile";

interface MobileSessionContextValue {
  partyId: string | null;
  customer: CustomerInfo | null;
  accounts: AccountInfo[];
  loans: AccountInfo[];
  loading: boolean;
  error: string | null;
  /** Every real sandbox HTTP call made by the most recent Mobile tab
   * action (including the dashboard refresh that follows a mutation), in
   * the order they fired -- what the "Under the Hood" panel renders. */
  lastApiCalls: ApiCallRecord[];
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
  const { activePartyId, setActivePartyId, refreshArrangements } = useParty();
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loans, setLoans] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastApiCalls, setLastApiCalls] = useState<ApiCallRecord[]>([]);
  // createCustomer()'s own calls (party create + account open + funding)
  // happen before activePartyId changes, but the refresh that then follows
  // (triggered by the effect below) would otherwise overwrite lastApiCalls
  // with just its own two calls -- stash createCustomer's calls here so
  // the effect can prepend them instead of losing them.
  const pendingExtraCallsRef = useRef<ApiCallRecord[]>([]);

  const refresh = useCallback(
    async (extraCalls: ApiCallRecord[] = []) => {
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
        setLastApiCalls([...extraCalls, ...customerInfo.apiCalls, ...arrangements.apiCalls]);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [activePartyId]
  );

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
    const extra = pendingExtraCallsRef.current;
    pendingExtraCallsRef.current = [];
    refresh(extra);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePartyId]);

  const createCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.createMobileCustomer();
      pendingExtraCallsRef.current = result.apiCalls;
      setActivePartyId(result.partyId); // pins it app-wide, same as "+ Create New Party" elsewhere
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, [setActivePartyId]);

  const transfer = useCallback(
    async (from: string, to: string, amount: number) => {
      const result = await api.mobileTransfer(from, to, amount, "Mobile transfer");
      await refresh(result.apiCalls);
    },
    [refresh]
  );

  const openAccount = useCallback(
    async (fundingAmount?: number) => {
      if (!activePartyId) return;
      const result = await api.openMobileAccount(activePartyId, fundingAmount);
      await refresh(result.apiCalls);
      // PartyContext's own arrangements (the Catalog/Assistant tabs' account
      // picker) only refetches when the pinned party ID itself changes --
      // it has no way to know this tab just created a new account for the
      // SAME party, so it'd otherwise keep showing a stale, shorter list
      // until the user notices and clicks the party bar's "Re-check".
      refreshArrangements();
    },
    [activePartyId, refresh, refreshArrangements]
  );

  const createLoan = useCallback(
    async (settlementAccountId: string, amount: number, term: string) => {
      if (!activePartyId) return;
      const result = await api.createMobileLoan(activePartyId, settlementAccountId, amount, term);
      await refresh(result.apiCalls);
      refreshArrangements(); // same reasoning as openAccount above
    },
    [activePartyId, refresh, refreshArrangements]
  );

  return (
    <MobileSessionContext.Provider
      value={{
        partyId: activePartyId,
        customer,
        accounts,
        loans,
        loading,
        error,
        lastApiCalls,
        createCustomer,
        refresh: () => refresh(),
        transfer,
        openAccount,
        createLoan,
      }}
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
