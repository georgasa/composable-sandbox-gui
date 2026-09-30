import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { EnvironmentPreset, TestEndpointResponse } from "../api/types";

interface Props {
  onClose: () => void;
  onSaved: () => void; // caller re-fetches /api/config to refresh header + everywhere else
}

const SERVICES = ["Deposits", "Holdings", "Party", "Lending"] as const;

/** Mirrors app/environment.py's EnvironmentConfig.base_urls() exactly, so
 * the preview updates live as the user types without a round trip. The
 * backend is still the source of truth once saved -- this is preview-only. */
function computeBaseUrls(prefix: string, seed: string, region: string): Record<string, string> {
  const host = `${prefix}${seed}.${region}.cloudapp.azure.com`;
  return {
    Deposits: `http://deposits-${host}/irf-deposits-container/api/v1.0.0`,
    Holdings: `http://${host}/ms-holdings-api/api/v1.0.0`,
    Party: `http://${host}/ms-party-api/api/v5.0.0`,
    Lending: `http://lending-${host}/irf-lending-container/api/v1.0.0`,
  };
}

export function EnvironmentModal({ onClose, onSaved }: Props) {
  const [label, setLabel] = useState("");
  const [prefix, setPrefix] = useState("");
  const [seed, setSeed] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestEndpointResponse | "testing">>({});

  // One-click named environments (e.g. "aekxuia" on Azure vs this machine's
  // own "Local WSL" k3s modular pack) -- see backend app/environment.py's
  // PRESETS. activePreset is null once the user hand-edits prefix/seed/region
  // away from a saved preset's exact values (a custom/ad-hoc environment).
  const [presets, setPresets] = useState<EnvironmentPreset[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [presetBaseUrls, setPresetBaseUrls] = useState<Record<string, string> | null>(null);
  const [switchingPreset, setSwitchingPreset] = useState<string | null>(null);

  const [llmModel, setLlmModel] = useState("gpt-4o-mini");
  const [llmHasKey, setLlmHasKey] = useState(false);
  const [llmApiKeyInput, setLlmApiKeyInput] = useState("");
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [llmTestResult, setLlmTestResult] = useState<"testing" | boolean | null>(null);

  useEffect(() => {
    api
      .getEnvironment()
      .then((env) => {
        setLabel(env.label);
        setPrefix(env.prefix);
        setSeed(env.seed);
        setRegion(env.region);
        setActivePreset(env.activePreset);
        setPresetBaseUrls(env.activePreset ? env.baseUrls : null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));

    api.getEnvironmentPresets().then(setPresets).catch(() => {});

    api
      .getLLMConfig()
      .then((cfg) => {
        setLlmModel(cfg.model);
        setLlmHasKey(cfg.hasApiKey);
      })
      .catch(() => {});
  }, []);

  // Once a preset is active, its own (possibly non-templated) baseUrls are
  // the source of truth for display -- only fall back to live client-side
  // templating once the user hand-edits a field away from that preset.
  const previewUrls = activePreset && presetBaseUrls ? presetBaseUrls : computeBaseUrls(prefix, seed, region);

  const handleActivatePreset = async (presetId: string) => {
    setSwitchingPreset(presetId);
    setError(null);
    try {
      const env = await api.activateEnvironmentPreset(presetId);
      setLabel(env.label);
      setPrefix(env.prefix);
      setSeed(env.seed);
      setRegion(env.region);
      setActivePreset(env.activePreset);
      setPresetBaseUrls(env.baseUrls);
      setTestResults({});
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSwitchingPreset(null);
    }
  };

  // A typed-but-unsaved key is exactly what got silently lost once already
  // (two similarly-labeled "Save" buttons in one modal made it easy to
  // click the wrong one) -- this is a last-resort net so closing the modal
  // can't discard it a second way.
  const closeGuarded = () => {
    if (llmApiKeyInput && !window.confirm("You typed an API key but haven't clicked \"Save AI Settings\" -- close anyway and discard it?")) {
      return;
    }
    onClose();
  };

  // stale test results (from before an edit) would be misleading -- clear on any change
  useEffect(() => {
    setTestResults({});
  }, [prefix, seed, region]);

  // Hand-editing prefix/seed/region away from a preset's exact values makes
  // this a custom/ad-hoc environment -- fall back to live client-side
  // templating for the preview instead of the (now stale) preset's URLs.
  const editField = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setActivePreset(null);
    setPresetBaseUrls(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const env = await api.updateEnvironment({ label, prefix, seed, region });
      setActivePreset(env.activePreset);
      setPresetBaseUrls(env.activePreset ? env.baseUrls : null);
      setTestResults({});
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (service: string) => {
    setTestResults((r) => ({ ...r, [service]: "testing" }));
    try {
      const result = await api.testEndpoint(previewUrls[service]);
      setTestResults((r) => ({ ...r, [service]: result }));
    } catch (e) {
      setTestResults((r) => ({
        ...r,
        [service]: { ok: false, message: e instanceof Error ? e.message : String(e) },
      }));
    }
  };

  const handleSaveLLM = async () => {
    setLlmSaving(true);
    setLlmError(null);
    setLlmTestResult(null);
    try {
      // Only send apiKey if the user actually typed a new one -- an empty
      // field means "leave the existing key alone", not "clear it".
      const result = await api.updateLLMConfig({
        provider: "openai",
        model: llmModel,
        ...(llmApiKeyInput ? { apiKey: llmApiKeyInput } : {}),
      });
      setLlmHasKey(result.hasApiKey);
      setLlmApiKeyInput("");
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : String(e));
    } finally {
      setLlmSaving(false);
    }
  };

  const handleTestLLM = async () => {
    setLlmTestResult("testing");
    try {
      const result = await api.testLLMConfig();
      setLlmTestResult(result.ok);
    } catch {
      setLlmTestResult(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeGuarded}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Environment</h2>
          <button className="modal-close" onClick={closeGuarded}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : (
            <>
              {presets.length > 0 && (
                <div className="field-group">
                  <label className="field-label">Environment</label>
                  <div className="preset-row">
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        className={`btn preset-btn${activePreset === p.id ? " preset-btn-active" : ""}`}
                        disabled={switchingPreset !== null}
                        onClick={() => handleActivatePreset(p.id)}
                      >
                        {switchingPreset === p.id ? <span className="spinner" /> : p.label}
                      </button>
                    ))}
                  </div>
                  <div className="field-hint">
                    {activePreset
                      ? "Using a named preset -- edit prefix/seed/region below to switch to a custom environment instead."
                      : "Custom environment (doesn't match a saved preset)."}
                  </div>
                </div>
              )}

              <div className="field-group">
                <label className="field-label">Label</label>
                <input className="field-input" value={label} onChange={(e) => editField(setLabel)(e.target.value)} />
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Prefix</label>
                  <input className="field-input" value={prefix} onChange={(e) => editField(setPrefix)(e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="field-label">Seed</label>
                  <input className="field-input" value={seed} onChange={(e) => editField(setSeed)(e.target.value)} />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Region</label>
                <input className="field-input" value={region} onChange={(e) => editField(setRegion)(e.target.value)} />
              </div>

              {error && <div className="confirm-banner">{error}</div>}

              <div className="btn-row">
                <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? <span className="spinner" /> : "Save Environment"}
                </button>
              </div>

              <hr className="section-divider" />

              <div className="section-title">API Endpoints</div>
              <div className="section-subtitle">
                Base URLs, derived automatically from prefix + seed + region above.
              </div>

              {SERVICES.map((service) => {
                const result = testResults[service];
                return (
                  <div className="endpoint-row" key={service}>
                    <label className="field-label">{service} API</label>
                    <div className="endpoint-row-inner">
                      <div className="endpoint-url">{previewUrls[service]}</div>
                      <button className="btn" onClick={() => handleTest(service)} disabled={result === "testing"}>
                        {result === "testing" ? <span className="spinner" /> : "Test"}
                      </button>
                    </div>
                    {result && result !== "testing" && (
                      <div className={`test-result ${result.ok ? "ok" : "fail"}`}>
                        {result.ok ? `Reachable (HTTP ${result.statusCode})` : `Unreachable: ${result.message}`}
                      </div>
                    )}
                  </div>
                );
              })}

              <hr className="section-divider" />

              <div className="section-title">AI Assistant</div>
              <div className="section-subtitle">
                Powers the Assistant tab's natural-language matching (OpenAI). Saved to a local file
                on this machine only (never committed, never in the built image) -- never shown again
                after saving, and survives container rebuilds.
              </div>

              <div className="field-group">
                <label className="field-label">Model</label>
                <input className="field-input" value={llmModel} onChange={(e) => setLlmModel(e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label">OpenAI API Key</label>
                <input
                  className="field-input"
                  type="password"
                  autoComplete="off"
                  placeholder={llmHasKey ? "•••••••••••••••• (set -- leave blank to keep)" : "sk-..."}
                  value={llmApiKeyInput}
                  onChange={(e) => setLlmApiKeyInput(e.target.value)}
                />
                <div className="field-hint">
                  {llmHasKey ? "A key is currently set." : "No key set yet -- the Assistant tab won't work until one is."}
                </div>
              </div>

              {llmError && <div className="confirm-banner">{llmError}</div>}

              <div className="btn-row">
                <button className="btn btn-primary" disabled={llmSaving} onClick={handleSaveLLM}>
                  {llmSaving ? <span className="spinner" /> : "Save AI Settings"}
                </button>
                <button className="btn" onClick={handleTestLLM} disabled={llmTestResult === "testing" || !llmHasKey}>
                  {llmTestResult === "testing" ? <span className="spinner" /> : "Test"}
                </button>
              </div>
              {llmTestResult !== null && llmTestResult !== "testing" && (
                <div className={`test-result ${llmTestResult ? "ok" : "fail"}`}>
                  {llmTestResult ? "Key works." : "Key rejected or unreachable."}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
