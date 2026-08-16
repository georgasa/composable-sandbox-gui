import type { AutofillHint, JsonSchema } from "../api/types";
import { AccountPicker } from "./AccountPicker";

/** Field names that mean "an account or loan ID goes here" -- these get a
 * dropdown of the active party's discovered arrangements, filtered to the
 * right kind, so the user picks instead of retyping IDs from memory.
 * Deliberately conservative (`accountid`/`loanid` substrings, plus the two
 * known payment-field names) so it doesn't false-positive on
 * accountName/accountOfficer/accountReference, which are names/references,
 * not IDs. */
function accountFieldKind(name: string): "account" | "loan" | null {
  const n = name.toLowerCase();
  if (n.includes("loanid")) return "loan";
  if (n.includes("accountid") || n === "debitaccount" || n === "creditaccount") return "account";
  return null;
}

/** Recursively renders one form field for a JSON-schema property. This is
 * the generic form generator the whole app relies on -- every one of the
 * 322 catalog operations' request bodies is walked by this same component,
 * since every requestBody schema in this workspace's specs resolves down
 * to plain string/number/boolean/array/object nodes (verified: 100% $ref
 * based, zero inline irregularities). */

interface Props {
  name: string;
  schema: JsonSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  required?: boolean;
  hint?: AutofillHint;
  depth?: number;
}

function isNumericType(schema: JsonSchema): boolean {
  return schema.type === "number" || schema.type === "integer";
}

export function SchemaField({ name, schema, value, onChange, required, hint, depth = 0 }: Props) {
  const label = (
    <label className="field-label">
      {name}
      {required && <span className="field-required">*</span>}
    </label>
  );

  const wasAutofilled = hint !== undefined && (value === hint.value || value === undefined);

  // --- object ---
  if (schema.type === "object" && schema.properties) {
    const obj = (value as Record<string, unknown>) || {};
    return (
      <div className="field-group">
        {label}
        <div className="nested-box">
          {Object.entries(schema.properties).map(([propName, propSchema]) => (
            <SchemaField
              key={propName}
              name={propName}
              schema={propSchema}
              value={obj[propName]}
              required={(schema.required || []).includes(propName)}
              onChange={(v) => onChange({ ...obj, [propName]: v })}
              depth={depth + 1}
            />
          ))}
        </div>
      </div>
    );
  }

  // --- array ---
  if (schema.type === "array") {
    const itemSchema = schema.items || { type: "string" };
    const arr = (value as unknown[]) || [];
    const isObjectItems = itemSchema.type === "object";
    return (
      <div className="field-group">
        {label}
        {schema.description && <div className="field-hint">{schema.description}</div>}
        {arr.map((item, idx) => (
          <div className="array-row" key={idx}>
            {isObjectItems ? (
              <div className="nested-box" style={{ flex: 1 }}>
                {Object.entries(itemSchema.properties || {}).map(([propName, propSchema]) => (
                  <SchemaField
                    key={propName}
                    name={propName}
                    schema={propSchema}
                    value={(item as Record<string, unknown>)?.[propName]}
                    required={(itemSchema.required || []).includes(propName)}
                    onChange={(v) => {
                      const next = [...arr];
                      next[idx] = { ...(item as Record<string, unknown>), [propName]: v };
                      onChange(next);
                    }}
                    depth={depth + 1}
                  />
                ))}
              </div>
            ) : (
              <input
                className="field-input"
                value={(item as string) ?? ""}
                onChange={(e) => {
                  const next = [...arr];
                  next[idx] = e.target.value;
                  onChange(next);
                }}
              />
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={() => onChange(arr.filter((_, i) => i !== idx))}
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="add-row-btn"
          onClick={() => onChange([...arr, isObjectItems ? {} : ""])}
        >
          + Add {name}
        </button>
      </div>
    );
  }

  // --- boolean ---
  if (schema.type === "boolean") {
    return (
      <div className="field-group">
        <label className="field-label" style={{ flexDirection: "row", alignItems: "center" }}>
          <input
            type="checkbox"
            className="field-checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {name}
        </label>
        {schema.description && <div className="field-hint">{schema.description}</div>}
      </div>
    );
  }

  // --- enum select ---
  if (schema.enum && schema.enum.length > 0) {
    return (
      <div className="field-group">
        {label}
        <select
          className="field-select"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">-- select --</option>
          {schema.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // --- string / number / integer (default text-ish input) ---
  const inputType = schema.format === "date" ? "date" : isNumericType(schema) ? "number" : "text";
  const pickerKind = accountFieldKind(name);
  const inputClassName = `field-input${wasAutofilled ? " autofilled" : ""}`;

  return (
    <div className="field-group">
      {label}
      {pickerKind ? (
        <AccountPicker
          name={name}
          value={value}
          onChange={onChange}
          kind={pickerKind}
          useCompanyForm={name.toLowerCase().includes("company")}
          className={inputClassName}
        />
      ) : (
        <input
          className={inputClassName}
          type={inputType}
          placeholder={schema.example !== undefined ? String(schema.example) : undefined}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(isNumericType(schema) && raw !== "" ? Number(raw) : raw);
          }}
        />
      )}
      {hint && (
        <div className="field-hint">
          {wasAutofilled ? "Auto-filled: " : ""}
          {hint.reason}
        </div>
      )}
      {!hint && schema.description && <div className="field-hint">{schema.description}</div>}
    </div>
  );
}
