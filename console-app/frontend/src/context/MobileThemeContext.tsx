import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface Skin {
  id: string;
  label: string;
  description: string;
}

// Generic style presets, no real bank names/logos -- see styles/mobile-tokens.css.
export const SKINS: Skin[] = [
  { id: "minimal-light", label: "Minimal Light", description: "Clean, airy, blue accent -- neobank feel" },
  { id: "midnight-dark", label: "Midnight Dark", description: "Dark navy, single accent -- fintech dark-mode feel" },
  { id: "classic-retail", label: "Classic Retail", description: "Navy & gold, boxier cards -- traditional bank feel" },
  { id: "bold-gradient", label: "Bold Gradient", description: "Vibrant gradient, big rounded buttons -- challenger-app feel" },
];

const STORAGE_KEY = "mobile-sim-skin";

interface MobileThemeContextValue {
  skinId: string;
  setSkinId: (id: string) => void;
}

const MobileThemeContext = createContext<MobileThemeContextValue | null>(null);

function getInitialSkin(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  return SKINS.some((s) => s.id === stored) ? stored! : SKINS[0].id;
}

export function MobileThemeProvider({ children }: { children: ReactNode }) {
  const [skinId, setSkinId] = useState(getInitialSkin);

  // Set on <html> just like console-app's own light/dark `data-theme` toggle
  // (App.tsx) -- safe to coexist because every mobile-skin CSS custom
  // property is --mob- prefixed (see mobile-tokens.css) and every colliding
  // class name is scoped under .mobile-tab-content (see mobile.css), so
  // this never leaks into the Catalog/Assistant/Flows tabs.
  useEffect(() => {
    document.documentElement.setAttribute("data-skin", skinId);
    localStorage.setItem(STORAGE_KEY, skinId);
  }, [skinId]);

  return <MobileThemeContext.Provider value={{ skinId, setSkinId }}>{children}</MobileThemeContext.Provider>;
}

export function useMobileTheme(): MobileThemeContextValue {
  const ctx = useContext(MobileThemeContext);
  if (!ctx) throw new Error("useMobileTheme must be used within MobileThemeProvider");
  return ctx;
}
