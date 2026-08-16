import type { JsonSchema, OperationDetail } from "../api/types";

/** Pre-populates any `partyId`-shaped field in an operation's params with
 * the session's active party (see context/PartyContext.tsx), so the user
 * doesn't have to retype it on every call. Covers both the common flat
 * shape (a `partyId` path/query param or body field) and the
 * `parties: [{partyId, partyRole}]` array shape used throughout account
 * and loan creation. Only ever fills gaps -- callers should spread this
 * under (not over) any value the user or the assistant already supplied. */
export function seedPartyId(
  detail: Pick<OperationDetail, "parameters" | "requestSchema"> | null,
  activePartyId: string | null
): Record<string, unknown> {
  if (!detail || !activePartyId) return {};
  const seed: Record<string, unknown> = {};

  for (const p of detail.parameters) {
    if (p.name.toLowerCase() === "partyid") seed[p.name] = activePartyId;
  }

  const properties = detail.requestSchema?.properties;
  if (properties) {
    for (const [propName, propSchema] of Object.entries(properties)) {
      seedProperty(propName, propSchema, activePartyId, seed);
    }
  }

  return seed;
}

function seedProperty(
  propName: string,
  propSchema: JsonSchema,
  activePartyId: string,
  seed: Record<string, unknown>
) {
  if (propName.toLowerCase() === "partyid" && propSchema.type !== "array" && propSchema.type !== "object") {
    seed[propName] = activePartyId;
    return;
  }
  if (propSchema.type === "array" && propSchema.items?.type === "object") {
    const itemProps = propSchema.items.properties || {};
    if ("partyId" in itemProps) {
      const row: Record<string, unknown> = { partyId: activePartyId };
      if ("partyRole" in itemProps) row.partyRole = "OWNER";
      seed[propName] = [row];
    }
  }
}
