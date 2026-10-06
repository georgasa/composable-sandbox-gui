# Sandbox Operational Notes

Hard-won rules about the Composable Banking APIs (the Azure `aekxuia` sandbox, release
202604, and the local k3s modular pack) that this app encodes. Where the two differ it
says so.

## Fixed constraints

- **Business date**: `2025-03-14`. All date fields must use it.
- **Company ID**: `GB0010001`. Holdings `{companyAccountId}` = `GB0010001-{accountId}`.
- **No auth** on the APIs themselves -- the app's `AUTH_MODE` password gate is what
  protects the public Azure deployment.

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
5. **Loan creation (`consumerLoans`, `mortgages`) requires `disbursementAccount` +
   `repaymentAccount`**, formatted as the composite reference
   `"deposits|{companyId}|{accountId}"` (e.g.
   `"deposits|GB0010001|1013718397"`) -- **not** a plain account ID. On the
   local pack the composite must be wrapped in an object,
   `{"accountId": "deposits|GB0010001|<id>"}` (see the local-pack section below). Omitting them fails with
   `"Payout Account is Mandatory."`; a still-missing `repaymentStartDate`/
   `repaymentFrequency` (`"Monthly"`) separately surfaces as
   `"NO CONSTANT OR LINEAR TYPE ON CALL CONTRACT"`. None of these four
   fields are in the schema's `required` list. On aekxuia loans **auto-disburse on
   creation**, no separate disburse call; the local pack does not pay them out.
   Mortgages use `productId: "Mortgages"`.
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
- `PersonalLoan` → HTTP 405 (use `ConsumerLoan` or `Mortgages`)

## Payments and events

**`paymentReservationReference` suppresses events.** Sending it on
`POST /order/payments/creditAccount` (and likely the other payment calls) books the
payment and returns `201` with a normal `BOOK.ENTRIES.API...` reference, but the
success events (`accountingJournalEntriesUpdated`, `accountCredited`) are never
published to `deposits-event-topic`, so Holdings, balances history and the Mobile
tab never see the payment. Failure events are still published.

- The field is the key of a fund reservation created by `POST /order/payments/reserveFunds`
  (T24 stores it with a suffix, e.g. `RSV777001*CSM`). Crediting against an existing
  one returns 400 `IRF-01` "Reservation Key ... Not Exists With Sign C" (reserveFunds
  makes a debit-side hold); an unknown key is silently accepted (T24 records
  `NOT.FOUND` on the entry and publishes nothing).
- Do not send it unless you are settling a real reservation. The console's request
  builder deliberately does not auto-fill it, although it fills other `*Reference`
  fields.
- The booking itself is unaffected, so the money is correct; only the event (and the
  transaction line in Holdings) is lost. The next successful event on the account makes
  Holdings' balance catch up.

**Closing an account**: `PUT /holdings/accounts/{accountId}/closure`
`{"effectiveDate": "2025-03-14", "narrative": "..."}`; the balance must be zero.

## Local pack (k3s) differences

- **Settlement accounts are objects.** The local Lending build rejects the string form
  with "string found, object expected"; send `{"accountId": "deposits|GB0010001|<id>"}`.
  A bare id inside the object can equal the new loan's own id and fail with "Settlement
  Account and Arrangement Account cannot be same".
- **Loan ids collide with deposit account ids.** Lending and Deposits allocate ids from
  the same sequence in separate databases. When a loan id equals an existing deposit
  account id, Holdings logs `duplicate key ... ms_altkey` and never registers the loan:
  it is missing from `GET /holdings/parties/{id}/arrangements` and from
  `GET /holdings/lending/parties/{id}/loans` (HMS-0003). Lending's `balances` and
  `paymentSchedule` still answer for it, which is how the Mobile tab shows loans it
  created.
- **Loans are not paid out.** The payout is done by the adapter, not a payments service: Lending publishes `requestInternalPayOut`, EventStore relays it on `lending-event-topic`, the adapter (`adapterservice`) calls Deposits' credit API, and the resulting `accountCredited` event makes the adapter call Lending's disbursements API. Observed 2026-10-06: the adapter repeats one failing `settlementService.creditRequest.accountCredited` event (`PathNotFoundException: $['callBackDetails']['callBackActivity']`, one request id, about once a second) and handled no `requestInternalPayOut`. The first loans (2026-10-03 06:36) did complete a payout. Working hypothesis, not yet proven: a poison event blocks the adapter's stream, so later payout requests are never executed and loans stay at 0 outstanding.
- **Terms are limited by the holiday calendar.** The GB holiday tables stop at 2049 and the
  business date is fixed at 2025-03-14, so a term longer than 24 years fails with
  `HOLIDAY TABLE MISSING FOR GB00xxxx; NO CONSTANT OR LINEAR TYPE ON CALL CONTRACT`. The
  Mobile tab offers mortgages up to 20 years (verified).
- Probing loan payloads creates real loans; use a throwaway party.
