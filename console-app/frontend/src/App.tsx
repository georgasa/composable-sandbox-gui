import { useEffect, useState } from "react";
import { api } from "./api/client";
import type { ConfigResponse } from "./api/types";
import { CatalogBrowser } from "./pages/CatalogBrowser";
import { Assistant } from "./pages/Assistant";
import { Flows } from "./pages/Flows";
import { MobileSimulator } from "./pages/MobileSimulator";
import { EnvironmentModal } from "./components/EnvironmentModal";
import { PartySessionBar } from "./components/PartySessionBar";
import { AuthGate } from "./components/AuthGate";

type Tab = "catalog" | "assistant" | "flows" | "mobile";
type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}

function AppShell() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  // Set by the Assistant tab's "View in Catalog" link -- CatalogBrowser
  // watches this to expand to and select the matching operation. The nonce
  // guarantees the effect fires even when re-clicking the link for the
  // SAME opKey after having browsed elsewhere in the catalog meanwhile
  // (an object identity/value change is needed for the effect to re-run;
  // opKey alone wouldn't change in that case).
  const [catalogFocus, setCatalogFocus] = useState<{ opKey: string; nonce: number } | null>(null);

  const viewInCatalog = (opKey: string) => {
    setCatalogFocus((prev) => ({ opKey, nonce: (prev?.nonce ?? 0) + 1 }));
    setTab("catalog");
  };

  const loadConfig = () => {
    api.getConfig().then(setConfig).catch(() => setConfig(null));
  };

  useEffect(loadConfig, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">{(config?.environmentPrefix || "AEKXUIA").toUpperCase()}</span>
          <span className="brand-name">Composable Banking Console</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {config && (
            <div className="env-strip">
              <span>
                <b>env</b> {config.environmentLabel}
              </span>
              <span>
                <b>company</b> {config.companyId}
              </span>
              <span>
                <b>date</b> {config.systemDate}
              </span>
            </div>
          )}
          <button className="env-trigger" onClick={() => setEnvModalOpen(true)} title="Edit environment">
            ⚙ Environment
          </button>
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            title="Toggle theme"
          >
            {theme === "light" ? "🌙 Dark" : "☀ Light"}
          </button>
        </div>
      </header>

      {envModalOpen && (
        <EnvironmentModal
          onClose={() => setEnvModalOpen(false)}
          onSaved={() => {
            loadConfig();
            setEnvModalOpen(false);
          }}
        />
      )}

      <nav className="tabs">
        <button className={`tab${tab === "catalog" ? " active" : ""}`} onClick={() => setTab("catalog")}>
          Catalog
        </button>
        <button className={`tab${tab === "assistant" ? " active" : ""}`} onClick={() => setTab("assistant")}>
          Assistant
        </button>
        <button className={`tab${tab === "flows" ? " active" : ""}`} onClick={() => setTab("flows")}>
          Flows
        </button>
        <button className={`tab${tab === "mobile" ? " active" : ""}`} onClick={() => setTab("mobile")}>
          Mobile
        </button>
      </nav>

      <PartySessionBar />

      <div className="main">
        {tab === "catalog" && <CatalogBrowser focus={catalogFocus} />}
        {tab === "assistant" && <Assistant onViewInCatalog={viewInCatalog} />}
        {tab === "flows" && <Flows />}
        {tab === "mobile" && <MobileSimulator />}
      </div>
    </div>
  );
}
