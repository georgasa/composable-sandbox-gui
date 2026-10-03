import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { useParty } from "./PartyContext";
import type { AccountInfo, ApiCallRecord, CustomerInfo } from "../types/mobile";

export type LoanType = "consumer" | "mortgage";

interface MobileSessionContextValue {
  partyId: string | null;
  customer: CustomerInfo | null;
  accounts: AccountInfo[];
  loans: AccountInfo[];
  loading: boolean;
  error: string | null;
  /** The real sandbox HTTP calls made by the most recent user action (e.g.
   * "Create consumer loan" -> the one POST it fired) -- what the "Under the
   * Hood" panel renders. Background refreshes and the 15s poll never touch
   * it, so it always shows the action the user actually took. */
  lastApiCalls: ApiCallRecord[];
  lastActionLabel: string;
  /** For screens that fetch on their own (transactions, loan schedule). */
  recordCalls: (label: string, calls: ApiCallRecord[]) => void;
  createCustomer: () => Promise<void>;
  refresh: () => Promise<void>;
  transfer: (from: string, to: string, amount: number) => Promise<void>;
  openAccount: (fundingAmount?: number, accountType?: "current" | "savings") => Promise<void>;
  closeAccount: (accountId: string) => Promise<void>;
  createLoan: (settlementAccountId: string, amount: number, term: string, loanType: LoanType) => Promise<void>;
}

const MobileSessionContext = createContext<MobileSessionContextValue | null>(null);

const POLL_INTERVAL_MS = 15000;

// Loan ids this browser created per party -- see backend mobile_routes.py
// _known_loans for why Holdings alone can't always list them.
const loanStoreKey = (partyId: string) => `mobile-loans-${partyId}`;

function readKnownLoanIds(partyId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(loanStoreKey(partyId)) || "[]");
  } catch {
    return [];
  }
}

function rememberLoanId(partyId: string, loanId: string | null) {
  if (!loanId) return;
  try {
    const ids = new Set(readKnownLoanIds(partyId));
    ids.add(loanId);
    localStorage.setItem(loanStoreKey(partyId), JSON.stringify([...ids]));
  } catch {
    // storage unavailable: the loan just won't be remembered if Holdings can't list it
  }
}

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
  const [lastActionLabel, setLastActionLabel] = useState("");
  // createCustomer() records its own calls, then pins the new party, which
  // triggers the load-on-party-change effect below -- that load must not
  // overwrite what createCustomer just recorded.
  const skipNextLoadRecordRef = useRef(false);

  const recordCalls = useCallback((label: string, calls: ApiCallRecord[]) => {
    setLastActionLabel(label);
    setLastApiCalls(calls);
  }, []);

  /** Runs one user action, records its sandbox calls (also when it fails),
   * then silently re-reads the dashboard so balances/lists update. */
  const runAction = useCallback(
    async <T extends { apiCalls: ApiCallRecord[] }>(label: string, action: () => Promise<T>): Promise<T> => {
      try {
        const result = await action();
        recordCalls(label, result.apiCalls);
        return result;
      } catch (e) {
        if (e instanceof ApiError) recordCalls(label, e.apiCalls);
        throw e;
      }
    },
    [recordCalls]
  );

  const load = useCallback(
    async (opts: { showLoading: boolean; record: boolean }) => {
      if (!activePartyId) return;
      if (opts.showLoading) setLoading(true);
      try {
        const [customerInfo, arrangements] = await Promise.all([
          api.getMobileCustomer(activePartyId),
          api.getMobileArrangements(activePartyId, readKnownLoanIds(activePartyId)),
        ]);
        setCustomer(customerInfo);
        setAccounts(arrangements.accounts);
        setLoans(arrangements.loans);
        if (opts.record) recordCalls("Load customer and accounts", [...customerInfo.apiCalls, ...arrangements.apiCalls]);
        setError(null);
      } catch (e) {
        if (opts.record && e instanceof ApiError) recordCalls("Load customer and accounts", e.apiCalls);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (opts.showLoading) setLoading(false);
      }
    },
    [activePartyId, recordCalls]
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
    const skipRecord = skipNextLoadRecordRef.current;
    skipNextLoadRecordRef.current = false;
    load({ showLoading: true, record: !skipRecord });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePartyId]);

  // Background poll while this tab is open: picks up balance/transaction
  // changes made elsewhere (Catalog tab, a payment from Postman) without a
  // manual refresh. Silent: no loading state, no Under-the-Hood update.
  useEffect(() => {
    if (!activePartyId) return;
    const intervalId = setInterval(() => {
      load({ showLoading: false, record: false });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [activePartyId, load]);

  const refresh = useCallback(() => load({ showLoading: true, record: false }), [load]);
  const silentRefresh = useCallback(() => load({ showLoading: false, record: false }), [load]);

  const createCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runAction("Create demo customer", () => api.createMobileCustomer());
      skipNextLoadRecordRef.current = true;
      setActivePartyId(result.partyId); // pins it app-wide, same as "+ Create New Party" elsewhere
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, [runAction, setActivePartyId]);

  const transfer = useCallback(
    async (from: string, to: string, amount: number) => {
      await runAction("Transfer between accounts", () => api.mobileTransfer(from, to, amount, "Mobile transfer"));
      await silentRefresh();
    },
    [runAction, silentRefresh]
  );

  const openAccount = useCallback(
    async (fundingAmount?: number, accountType: "current" | "savings" = "current") => {
      if (!activePartyId) return;
      await runAction(`Open ${accountType} account`, () =>
        api.openMobileAccount(activePartyId, fundingAmount, accountType)
      );
      await silentRefresh();
      // PartyContext's own arrangements (the Catalog/Assistant tabs' account
      // picker) only refetches when the pinned party ID itself changes --
      // it has no way to know this tab just created a new account for the
      // SAME party, so it'd otherwise keep showing a stale, shorter list
      // until the user notices and clicks the party bar's "Re-check".
      refreshArrangements();
    },
    [activePartyId, runAction, silentRefresh, refreshArrangements]
  );

  const closeAccount = useCallback(
    async (accountId: string) => {
      await runAction("Close account", () => api.closeMobileAccount(accountId));
      await silentRefresh();
      refreshArrangements();
    },
    [runAction, silentRefresh, refreshArrangements]
  );

  const createLoan = useCallback(
    async (settlementAccountId: string, amount: number, term: string, loanType: LoanType) => {
      if (!activePartyId) return;
      const result = await runAction(loanType === "mortgage" ? "Create mortgage" : "Create consumer loan", () =>
        api.createMobileLoan(activePartyId, settlementAccountId, amount, term, loanType)
      );
      rememberLoanId(activePartyId, result.loanId);
      await silentRefresh();
      refreshArrangements(); // same reasoning as openAccount above
    },
    [activePartyId, runAction, silentRefresh, refreshArrangements]
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
        lastActionLabel,
        recordCalls,
        createCustomer,
        refresh,
        transfer,
        openAccount,
        closeAccount,
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
