# aekxuia Sandbox — Operational Notes

Hard-won rules about the live Temenos Composable Banking sandbox
(`aekxuia`, release 202604) that both apps in this repo bake in. Condensed
from the source workspace's `CLAUDE.md`; kept here so this repo is
self-contained.

## Fixed constraints

- **Business date**: `2025-03-14`. All date fields must use it.
- **Company ID**: `GB0010001`. Holdings `{companyAccountId}` = `GB0010001-{accountId}`.
- **No auth** on the sandbox APIs themselves -- see each app's `AUTH_MODE`
  password gate for how the public Azure deployment protects against this.

## Request/response quirks

1. **Reference fields** (`quotationReference`, `blockingReference`, etc.)
   reject anything but uppercase letters + digits -- `WRONG ALPHANUMERIC CHAR.`
   (`T24-000`) otherwise. Generate as `{PREFIX}{6_RANDOM_DIGITS}`.
2. **Error envelopes are inconsistent across services.** Deposits/Holdings:
   `{"error":[{"code":"...","message":"..."}]}`, sometimes even under HTTP
   200. Party: a **bare top-level array**, `[{"code":"...","message":"..."}]`
   -- discovered live building the mobile simulator, not documented
   upstream. Always check both shapes.
3. **Numeric fields must be JSON numbers**, not strings (`fundingAmount`,
   `paymentAmount`, `loanAmount`, etc.).
3. **Holdings transactions** (`GET /holdings/accounts/{companyAccountId}/transactions`):
   field is `narrative` (not `description`), amount is
   `amountInAccountCurrency`/`transactionAmount` (no separate credit/debit
   fields, no `runningBalance`). Wrapped in `{items: [...]}`.
4. **Account creation returns `{"accountId": "..."}`**, not
   `accountReference`/`id` (loan creation *does* use `accountReference`).
5. **Consumer loan creation requires `disbursementAccount` +
   `repaymentAccount`** (plain account IDs) or fails with
   `"Payout Account is Mandatory."` -- not obvious from the required-fields
   list alone. Loans **auto-disburse on creation**, no separate disburse call.
6. **Loan payment schedule** (`GET /holdings/lending/{accountId}/paymentSchedule`)
   response key is `paymentSchedules` (not `items`), amounts are formatted
   strings with thousands separators. `get-loan-details` is a separate,
   broken enquiry (`TGVCP-007`) -- use payment schedule instead.
7. **`extensionData.ShortTitle` frequently comes back as the literal string
   `"null"`**, not an absent field -- even on accounts that were never
   closed. Treat it as "no title" and fall back to the product name; do not
   display it verbatim.
8. **Arrangements never drop closed/pending-closure entries on their own.**
   `GET /holdings/parties/{partyId}/arrangements` and the Deposits
   accounts-by-party endpoint both keep listing an account forever after
   closure (`arrangementStatus: "CLOSE"`/`"PENDING.CLOSURE"`). Filter
   client- or server-side.
9. **Removing a party from an account**: `DELETE /holdings/accounts/{accountId}/parties`
   is broken for every case tested (can't remove a sole owner, and can't
   satisfy the tax-percentage rule for multi-owner accounts either — the
   DELETE payload has no field for it). The actual working method is
   `POST /holdings/accounts/parties`, which has **set/replace semantics**
   despite its name: post the full list of parties you want to *keep*
   (with `taxationPercent` summing to 100) to drop one.
10. **maritalStatus "Single" is not valid reference data** on this sandbox
    (`Married` is) -- discovered live, not documented upstream.
11. **`consumerLoans`' `loanAmount` field is mistyped in the OpenAPI spec
    itself** -- declared `"type": "string"` (with a bare-number `example`,
    250000, unquoted), but the real sandbox rejects a string outright with
    `IRF-400200 "string found, number expected"`. A schema-driven
    string→number coercion (matching the declared type) isn't enough here;
    console-app's `sandbox_rules.coerce_numeric` special-cases this field
    by name to force it numeric regardless of what the spec claims.

## Known-broken endpoints

- `GET /holdings/accounts/{id}/blockedFunds` / `.../deposits/{id}/blockedFunds` → `MSF-999`
- `GET /holdings/deposits/{id}/balances` → `TGVCP-009` (use
  `GET /holdings/accounts/GB0010001-{id}/balances` instead)
- `get-loan-details` → `TGVCP-007`
- `SavingsAccount` product doesn't exist (use `CurrentAccount`)
- `PersonalLoan` → HTTP 405 (use `ConsumerLoan` or `Mortgages`)
