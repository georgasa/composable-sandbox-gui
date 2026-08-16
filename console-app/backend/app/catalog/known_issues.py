"""Known-broken-on-aekxuia table, transcribed from this workspace's CLAUDE.md
"Known Sandbox Limitations" and "Lessons Learned" sections. Matched by
(service, method, path) against the parsed catalog at build time rather than
by op_key, since these were documented in prose against real request URLs,
not against this catalog's synthetic keys.

Keep this in sync with CLAUDE.md -- if CLAUDE.md gains a new documented
quirk, add a row here so it surfaces as a warning banner in the UI instead
of being silently rediscovered by trial and error again.

Rules default to substring matching on the path; set exact=True when a
prefix/substring would over-match sibling sub-resources (verified against
the real catalog via smoke_test.py -- the loan-details rule and the
term-deposit-creation rule both needed this to avoid false positives).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class KnownIssueRule:
    method: str
    path_contains: str
    message: str
    service: str | None = None  # None = applies regardless of service
    exact: bool = False


KNOWN_ISSUE_RULES: list[KnownIssueRule] = [
    KnownIssueRule(
        "GET", "blockedFunds",
        "Returns MSF-999 on this sandbox (documented limitation) for both "
        "/holdings/accounts/{id}/blockedFunds and /holdings/deposits/{id}/blockedFunds. "
        "Track blockedReference values from POST responses locally instead.",
        service="Deposits",
    ),
    KnownIssueRule(
        "GET", "/holdings/deposits/{accountId}/balances",
        "Returns TGVCP-009 on this sandbox. Use the Holdings query-layer "
        "balances endpoint (GB0010001-{id} composite ID) instead.",
        service="Deposits", exact=True,
    ),
    KnownIssueRule(
        "GET", "/holdings/lending/{accountId}",
        "get-loan-details returns TGVCP-007 (missing enquiry) on this sandbox -- "
        "a known-broken endpoint, not a request error.",
        service="Lending", exact=True,
    ),
    KnownIssueRule(
        "PUT", "/branch",
        "change-branch fails with \"MISSING ST.BRANCH - RECORD\" on this sandbox.",
    ),
    KnownIssueRule(
        "PUT", "settlementInstructions/advanced",
        "advanced-settlement returns T24-000 on this sandbox -- not applicable "
        "to the LENDING product line.",
        service="Lending",
    ),
    KnownIssueRule(
        "POST", "/holdings/accounts/savingsAccounts",
        "The SavingsAccount product does not exist on this sandbox -- use "
        "productId \"CurrentAccount\" instead, even for a savings-account use case.",
        service="Deposits", exact=True,
    ),
    KnownIssueRule(
        "POST", "personalLoans",
        "PersonalLoan returns HTTP 405 on this sandbox -- use productId "
        "\"ConsumerLoan\" or \"Mortgages\" instead.",
        service="Lending",
    ),
    KnownIssueRule(
        "POST", "/holdings/deposits/termDeposits",
        "ShortTermAutoRolloverDeposit auto-closes almost immediately on this "
        "sandbox and can land in PENDING.CLOSURE, which then rejects any "
        "activity except Close with T24-000 \"Close arrangement activity only "
        "allowed\". This is a documented sandbox bug, not a payload error.",
        service="Deposits", exact=True,
    ),
    KnownIssueRule(
        "PUT", "/closure",
        "Closing an arrangement resets its extensionData.ShortTitle to the "
        "literal string \"null\" rather than leaving it unset -- observed "
        "directly on this sandbox, not documented upstream.",
        service="Deposits",
    ),
    KnownIssueRule(
        "DELETE", "/holdings/accounts/{accountId}/parties",
        "Broken on this sandbox for every case tested. Removing an account's "
        "sole owner fails with T24-000 \"Change to same customer is not "
        "allowed\" (T24 won't leave an account owner-less). Removing one owner "
        "from a genuine multi-owner account fails with T24-000 \"Sum of Tax "
        "Percentages Must be 100%\" -- this endpoint's schema has no field to "
        "re-specify the remaining owners' taxationPercent, so there is no way "
        "to satisfy it via DELETE. Use POST /holdings/accounts/parties instead: "
        "it has set/replace semantics (it replaces the account's whole party "
        "list, not additive), so posting the parties you want to KEEP -- with "
        "taxationPercent values summing to 100 -- both adds and removes owners "
        "in one call and is the only working way to drop a party.",
        service="Deposits", exact=True,
    ),
    KnownIssueRule(
        "POST", "/holdings/accounts/parties",
        "Despite its name, this is a set/replace operation, not additive: the "
        "parties array you send becomes the account's ENTIRE new owner list -- "
        "any existing owner you omit is silently dropped. When sending more "
        "than one party, each needs taxationPercent and they must sum to 100, "
        "or the call fails with T24-000 \"Sum of Tax Percentages Must be 100%\". "
        "To add a co-owner without losing the existing one, include both in "
        "the same call with their combined taxationPercent = 100.",
        service="Deposits", exact=True,
    ),
]


def find_known_issue(service: str, method: str, path: str) -> str | None:
    for rule in KNOWN_ISSUE_RULES:
        if rule.method != method:
            continue
        if rule.service is not None and rule.service != service:
            continue
        matches = path == rule.path_contains if rule.exact else rule.path_contains in path
        if matches:
            return rule.message
    return None
