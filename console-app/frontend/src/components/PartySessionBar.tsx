import { useState } from "react";
import { api } from "../api/client";
import { useParty } from "../context/PartyContext";

const PARTY_OP_KEY = "Party:POST:/party/parties";

const FIRST_NAMES = ["Alice", "Bob", "Charlie", "Diana", "Ethan", "Fiona", "George", "Hannah"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];

function randomDemoPartyPayload() {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  // Mirrors Sandbox/01-demoflow.py's create_party() payload -- the flat
  // shape confirmed working against the live sandbox.
  return {
    dateOfBirth: "1985-06-15",
    cityOfBirth: "New York",
    countryOfBirth: "US",
    gender: "Male",
    maritalStatus: "Married",
    defaultLanguage: "English",
    noOfDependents: 2,
    partyType: "Individual",
    partyStatus: "Prospect",
    title: "Mr",
    firstName: `${first}${suffix}`,
    middleName: "Test",
    lastName: `${last}${suffix}`,
    nickName: "Demo",
    nationalities: [{ country: "US" }],
    citizenships: [{ countryOfCitizenship: "US", endDate: "2030-12-31" }],
    residences: [{ type: "Residence", country: "US", status: "Owner", statutoryRequirementMet: true }],
    partyIdentifiers: [
      {
        type: "Passport",
        status: "New",
        issuingAuthority: "US State Department",
        identifierNumber: `P${suffix}`,
        issuedDate: "2020-01-15",
        expiryDate: "2030-01-15",
        issuingCountry: "US",
        primary: true,
      },
    ],
    addresses: [
      {
        communicationNature: "Physical",
        communicationType: "MailingAddress",
        addressType: "Home",
        primary: "true",
        countryCode: "US",
        addressFreeFormat: [{ addressLine: "123 Main Street, New York, NY 10001" }],
        town: "New York",
        countrySubdivision: "New York",
        postalOrZipCode: "10001",
      },
    ],
  };
}

/** The session-wide "active party" used to auto-fill partyId fields
 * throughout the catalog and assistant forms (see SchemaField.tsx). Setting
 * one here doesn't call any API -- it's just a pin. Creating one does call
 * the real, verified-working Party/POST:/party/parties endpoint (see
 * backend/app/catalog/loader.py's supplemental_operations), through the
 * same prepare -> execute pipeline as everything else, just chained
 * automatically for one-click convenience since the payload is entirely
 * auto-generated demo data, not user-supplied risk. */
export function PartySessionBar() {
  const { activePartyId, setActivePartyId, arrangements, arrangementsLoading, refreshArrangements } = useParty();
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleSet = () => {
    const trimmed = input.trim();
    if (trimmed) {
      setActivePartyId(trimmed);
      setInput("");
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const prepared = await api.prepare(PARTY_OP_KEY, randomDemoPartyPayload());
      const result = await api.execute(prepared.pendingExecutionId);
      if (!result.ok) {
        setError(result.errors.join("; ") || "Party creation failed.");
        return;
      }
      const newId = (result.data as { id?: string })?.id;
      if (newId) setActivePartyId(newId);
      else setError("Party created but no id was returned -- check the response shape.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const accountCount = arrangements.filter((a) => a.kind === "account").length;
  const loanCount = arrangements.filter((a) => a.kind === "loan").length;

  return (
    <div className="session-bar-wrap">
      <div className="session-bar">
        <span className="session-label">
          Party: <b>{activePartyId || "not set"}</b>
          {activePartyId && (
            <button className="session-clear" onClick={() => setActivePartyId(null)} title="Clear">
              ✕
            </button>
          )}
        </span>
        <input
          className="session-input"
          placeholder="Enter party ID..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSet()}
        />
        <button className="btn" onClick={handleSet} disabled={!input.trim()}>
          Set
        </button>
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? <span className="spinner" /> : "+ Create New Party"}
        </button>

        {activePartyId && (
          <span className="session-arrangements">
            {arrangementsLoading ? (
              <>
                <span className="spinner" /> discovering accounts...
              </>
            ) : (
              <>
                <button
                  className="session-arrangements-toggle"
                  onClick={() => setExpanded((e) => !e)}
                  disabled={arrangements.length === 0}
                >
                  <span className="group-toggle-icon">{expanded ? "−" : "+"}</span>
                  {arrangements.length === 0
                    ? "no accounts/loans found for this party"
                    : `${accountCount} account(s), ${loanCount} loan(s) found`}
                </button>
                <button className="session-refresh" onClick={refreshArrangements} title="Re-check">
                  ↻
                </button>
              </>
            )}
          </span>
        )}

        {error && <span className="session-error">{error}</span>}
        <span className="session-hint">
          Party auto-fills partyId fields; discovered accounts/loans are pickable in account/loan ID fields.
        </span>
      </div>

      {expanded && arrangements.length > 0 && (
        <div className="session-arrangements-panel">
          {arrangements.map((a) => (
            <div className="session-arrangement-row" key={a.accountId}>
              <span className={`arrangement-kind-badge ${a.kind}`}>{a.kind}</span>
              <span className="session-arrangement-type">{a.typeLabel}</span>
              <span className="session-arrangement-meta">
                {a.currency} · {a.status}
              </span>
              <span className="session-arrangement-id mono">{a.accountId}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
