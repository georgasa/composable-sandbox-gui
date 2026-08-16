import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface Skin {
  id: string;
  label: string;
  description: string;
}

// Generic style presets, no real bank names/logos -- see tokens.css.
export const SKINS: Skin[] = [
  { id: "minimal-light", label: "Minimal Light", description: "Clean, airy, blue accent -- neobank feel" },
  { id: "midnight-dark", label: "Midnight Dark", description: "Dark navy, single accent -- fintech dark-mode feel" },
  { id: "classic-retail", label: "Classic Retail", description: "Navy & gold, boxier cards -- traditional bank feel" },
  { id: "bold-gradient", label: "Bold Gradient", description: "Vibrant gradient, big rounded buttons -- challenger-app feel" },
];

const STORAGE_KEY = "mobile-sim-skin";

interface ThemeContextValue {
  skinId: string;
  setSkinId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialSkin(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  return SKINS.some((s) => s.id === stored) ? stored! : SKINS[0].id;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [skinId, setSkinId] = useState(getInitialSkin);

  useEffect(() => {
    document.documentElement.setAttribute("data-skin", skinId);
    localStorage.setItem(STORAGE_KEY, skinId);
  }, [skinId]);

  return <ThemeContext.Provider value={{ skinId, setSkinId }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
