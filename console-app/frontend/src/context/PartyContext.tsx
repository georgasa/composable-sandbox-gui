import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { DiscoveredArrangement } from "../api/types";
import { discoverArrangements } from "../utils/discoverArrangements";

interface PartyContextValue {
  activePartyId: string | null;
  setActivePartyId: (id: string | null) => void;
  arrangements: DiscoveredArrangement[];
  arrangementsLoading: boolean;
  refreshArrangements: () => void;
}

const PartyContext = createContext<PartyContextValue | null>(null);

const STORAGE_KEY = "activePartyId";

export function PartyProvider({ children }: { children: ReactNode }) {
  const [activePartyId, setActivePartyIdState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );
  const [arrangements, setArrangements] = useState<DiscoveredArrangement[]>([]);
  const [arrangementsLoading, setArrangementsLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const setActivePartyId = (id: string | null) => {
    setActivePartyIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  };

  // Auto-discover whenever the active party changes (Set, Create New Party,
  // or a manual refresh) -- so accounts/loans are ready to pick from before
  // the user even opens a form, per the user's request not to have to
  // "memorialize" IDs themselves.
  useEffect(() => {
    if (!activePartyId) {
      setArrangements([]);
      return;
    }
    let cancelled = false;
    setArrangementsLoading(true);
    discoverArrangements(activePartyId).then((found) => {
      if (!cancelled) {
        setArrangements(found);
        setArrangementsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activePartyId, refreshNonce]);

  // keep in sync if changed in another tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setActivePartyIdState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <PartyContext.Provider
      value={{
        activePartyId,
        setActivePartyId,
        arrangements,
        arrangementsLoading,
        refreshArrangements: () => setRefreshNonce((n) => n + 1),
      }}
    >
      {children}
    </PartyContext.Provider>
  );
}

export function useParty(): PartyContextValue {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error("useParty must be used within a PartyProvider");
  return ctx;
}
