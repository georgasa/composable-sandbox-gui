import type { OperationDetail } from "../api/types";
import { SchemaField } from "./SchemaField";

interface Props {
  detail: OperationDetail;
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}

/** Renders path/query params (flat, from the OpenAPI parameter list) plus
 * the request body (recursive, from the dereferenced schema) as one form
 * that produces a single flat params object -- exactly the shape POST
 * /api/prepare expects, since the backend does the path-vs-query-vs-body
 * routing itself (see request_builder.py). */
export function ParamForm({ detail, params, onChange }: Props) {
  const setField = (name: string, value: unknown) => onChange({ ...params, [name]: value });

  const bodyProps = detail.requestSchema?.properties || {};
  const bodyRequired = detail.requestSchema?.required || [];

  return (
    <div>
      {detail.parameters.length > 0 && (
        <>
          {detail.parameters.map((p) => (
            <SchemaField
              key={p.name}
              name={p.name}
              schema={p.schema}
              value={params[p.name]}
              required={p.required}
              hint={detail.autofillHints[p.name]}
              onChange={(v) => setField(p.name, v)}
            />
          ))}
        </>
      )}
      {Object.entries(bodyProps).map(([propName, propSchema]) => (
        <SchemaField
          key={propName}
          name={propName}
          schema={propSchema}
          value={params[propName]}
          required={bodyRequired.includes(propName)}
          hint={detail.autofillHints[propName]}
          onChange={(v) => setField(propName, v)}
        />
      ))}
      {detail.parameters.length === 0 && Object.keys(bodyProps).length === 0 && (
        <div className="field-hint">This operation takes no parameters.</div>
      )}
    </div>
  );
}
