import { useState } from "react";
import { useParty } from "../context/PartyContext";

interface Props {
  name: string;
  value: unknown;
  onChange: (value: unknown) => void;
  kind: "account" | "loan";
  useCompanyForm: boolean;
  className: string;
}

const MANUAL_SENTINEL = "__manual__";

/** A real <select> dropdown of the active party's discovered accounts or
 * loans (per the user's explicit ask for "a pull down menu", not just
 * autocomplete suggestions), filtered to the kind the field actually needs
 * -- an accountId field never shows loans and vice versa. Falls back to a
 * plain text input when nothing's been discovered yet (no active party, or
 * the party genuinely has none of that kind), or when the current value
 * doesn't match any discovered option (e.g. typed manually, or belongs to
 * a different party) so an existing value is never silently hidden. */
export function AccountPicker({ name, value, onChange, kind, useCompanyForm, className }: Props) {
  const { arrangements } = useParty();
  const pickable = arrangements.filter((a) => a.kind === kind);
  const currentStr = value === undefined || value === null ? "" : String(value);
  const matchesOption = pickable.some((a) => (useCompanyForm ? a.companyAccountId : a.accountId) === currentStr);
  // Default to the dropdown when the field is still empty (nothing to lose)
  // -- only start in manual mode if there's an existing value that doesn't
  // match any discovered option, so we never silently hide real data.
  const [manualMode, setManualMode] = useState(currentStr !== "" && !matchesOption);

  if (pickable.length === 0) {
    return (
      <input
        className={className}
        type="text"
        value={currentStr}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (manualMode) {
    return (
      <>
        <input className={className} type="text" value={currentStr} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="picker-switch" onClick={() => setManualMode(false)}>
          ↕ Choose from {pickable.length} discovered {kind}{pickable.length > 1 ? "s" : ""}
        </button>
      </>
    );
  }

  return (
    <select
      className="field-select"
      value={matchesOption ? currentStr : ""}
      onChange={(e) => {
        if (e.target.value === MANUAL_SENTINEL) {
          setManualMode(true);
          return;
        }
        onChange(e.target.value);
      }}
      name={name}
    >
      <option value="">-- select {kind} --</option>
      {pickable.map((a) => (
        <option key={a.accountId} value={useCompanyForm ? a.companyAccountId : a.accountId}>
          {a.label}
        </option>
      ))}
      <option value={MANUAL_SENTINEL}>✎ Enter manually...</option>
    </select>
  );
}
