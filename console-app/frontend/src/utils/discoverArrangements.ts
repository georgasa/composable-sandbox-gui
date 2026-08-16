import { api } from "../api/client";
import type { DiscoveredArrangement } from "../api/types";

const ARRANGEMENTS_OP_KEY = "Holdings:GET:/holdings/parties/{partyId}/arrangements";

interface RawArrangement {
  productGroup?: string;
  productLine?: string;
  arrangementStatus?: string;
  currency?: string;
  extensionData?: { ShortTitle?: string };
  alternateReferences?: { alternateType: string; alternateId: string }[];
}

function humanizeProductGroup(productGroup: string | undefined): string {
  if (!productGroup) return "Arrangement";
  // "XPG.CurrentAccounts" -> "Current Accounts"
  const bare = productGroup.replace(/^XPG\./, "");
  return bare.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// Neither this Holdings endpoint nor the Deposits accounts-by-party endpoint
// filters by status -- a closed account/loan stays listed forever (confirmed
// live: closing account 1013718427 left it in the response with
// arrangementStatus "CLOSE"). Filtering here keeps closed arrangements out of
// both the party-bar count and the account/loan picker dropdowns, since
// picking a closed account for a new operation would just fail downstream.
const CLOSED_STATUSES = new Set(["CLOSE", "CLOSED"]);

function toDiscovered(raw: RawArrangement): DiscoveredArrangement | null {
  if (CLOSED_STATUSES.has((raw.arrangementStatus || "").toUpperCase())) return null;
  const accountRef = raw.alternateReferences?.find((r) => r.alternateType === "ACCOUNT");
  if (!accountRef) return null;
  const companyAccountId = accountRef.alternateId;
  const accountId = companyAccountId.split("-").pop() || companyAccountId;

  // Best-effort classification -- only productLine values actually observed
  // on this sandbox are "ACCOUNTS" and "DEPOSITS" so far; anything
  // mentioning "LENDING" is treated as a loan. Per CLAUDE.md, this Holdings
  // endpoint aggregates across Deposits AND Lending, so this should cover
  // both, but the Lending case hasn't been directly observed in this
  // session (no loan existed on the test party at the time).
  const kind: DiscoveredArrangement["kind"] = (raw.productLine || "").toUpperCase().includes("LENDING")
    ? "loan"
    : "account";

  const shortTitle = raw.extensionData?.ShortTitle;
  const hasRealTitle = shortTitle && shortTitle !== "null";
  const typeLabel = hasRealTitle ? shortTitle! : humanizeProductGroup(raw.productGroup);
  const label = `${typeLabel} · ${raw.currency || "?"} · ${raw.arrangementStatus || "?"} · ${accountId}`;

  return {
    accountId,
    companyAccountId,
    label,
    typeLabel,
    kind,
    currency: raw.currency || "",
    status: raw.arrangementStatus || "",
  };
}

/** Fetches every arrangement (current/savings/term-deposit account, loan)
 * owned by a party via the same prepare -> execute pipeline as everything
 * else in this app (see PartySessionBar's handleCreate for the precedent
 * of chaining them automatically for a background convenience action --
 * this is read-only so there's nothing to confirm). Returns [] on any
 * failure (unknown party, sandbox error) rather than throwing, since this
 * is a background enrichment, not a user-initiated action the UI should
 * block on. */
export async function discoverArrangements(partyId: string): Promise<DiscoveredArrangement[]> {
  try {
    const prepared = await api.prepare(ARRANGEMENTS_OP_KEY, { partyId });
    const result = await api.execute(prepared.pendingExecutionId);
    if (!result.ok) return [];
    const raw = (result.data as { arrangements?: RawArrangement[] })?.arrangements || [];
    return raw.map(toDiscovered).filter((a): a is DiscoveredArrangement => a !== null);
  } catch {
    return [];
  }
}
