"""Curated, narrow set of endpoints the Mobile tab's screens need -- not the
general catalog. Each one resolves a real sandbox URL via the same runtime
EnvironmentStore the rest of console-app uses (so environment-switching
applies here too), applies the fixed date/companyId/reference conventions
inline (see CLAUDE.md / SANDBOX_NOTES.md), and unwraps the sandbox's error
envelope via app.mobile_sandbox_client.call. No pending-token confirm gate
(unlike the rest of console-app) -- this is a small, curated, demo-safe
operation set, not a "call anything" console, so direct execution is
appropriate, same reasoning as when this lived in the standalone
mobile-simulator app.
"""

from __future__ import annotations

import random
import string

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from app.config import settings
from app.mobile_sandbox_client import call

router = APIRouter(prefix="/mobile")

_CLOSED_STATUSES = {"CLOSE", "CLOSED", "PENDING.CLOSURE"}

_FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Avery", "Quinn", "Reese"]
_LAST_NAMES = ["Carter", "Bennett", "Reed", "Hayes", "Foster", "Brooks", "Sawyer", "Morgan", "Ellis", "Coleman"]


def _ref(prefix: str) -> str:
    digits = "".join(random.choices(string.digits, k=6))
    return f"{prefix}{digits}"


def _company_account_id(account_id: str) -> str:
    return f"{settings.company_id}-{account_id}"


def _account_short_name(raw: dict) -> str:
    """The literal string "null" comes back as ShortTitle on this sandbox
    even for never-closed accounts. Normalize it here so the bug is never
    visible in this app to begin with -- see SANDBOX_NOTES.md."""
    ext = raw.get("extensionData") or {}
    short_title = ext.get("ShortTitle")
    if short_title and short_title != "null":
        return short_title
    product_group = str(raw.get("productGroup") or "Account").replace("XPG.", "")
    return product_group


def _account_id_from_arrangement(raw: dict) -> str | None:
    for ref in raw.get("alternateReferences") or []:
        if ref.get("alternateType") == "ACCOUNT":
            alt = ref["alternateId"]
            return alt.split("-")[-1]
    return None


class CreatePartyPayload(BaseModel):
    firstName: str | None = None
    lastName: str | None = None


class TransferPayload(BaseModel):
    fromAccountId: str
    toAccountId: str
    amount: float
    description: str = "Transfer"


class OpenAccountPayload(BaseModel):
    partyId: str
    fundingAmount: float | None = None
    accountType: str = "current"  # "current" | "savings"


class CreateLoanPayload(BaseModel):
    partyId: str
    settlementAccountId: str  # disbursement + repayment account -- sandbox requires it ("Payout Account is Mandatory")
    amount: float
    term: str = "5Y"
    loanType: str = "consumer"  # "consumer" | "mortgage"


_LOAN_PRODUCTS = {
    "consumer": {"productId": "ConsumerLoan", "path": "consumerLoans", "label": "Consumer Loan"},
    "mortgage": {"productId": "Mortgages", "path": "mortgages", "label": "Mortgage"},
}


@router.post("/customer")
async def create_customer(payload: CreatePartyPayload, request: Request):
    """Creates a demo party + opens & funds one current account in a single
    call so the mobile tab always has something to show immediately after
    "Create Demo Customer" -- mirrors the Building Guide's Account
    Onboarding Flow. For reusing an existing party instead, the frontend
    just pins one via the shared party session bar and calls the GET
    endpoints below -- no separate "load existing" endpoint needed."""
    env = request.app.state.environment
    calls: list[dict] = []
    first = payload.firstName or random.choice(_FIRST_NAMES)
    last = payload.lastName or random.choice(_LAST_NAMES)

    party_body = {
        "dateOfBirth": "1990-01-01",
        "cityOfBirth": "London",
        "countryOfBirth": "GB",
        "gender": "Male",
        "maritalStatus": "Married",  # "Single" isn't valid reference data on this sandbox -- discovered live
        "defaultLanguage": "English",
        "noOfDependents": 0,
        "partyType": "Individual",
        "partyStatus": "Prospect",
        "title": "Mr",
        "firstName": first,
        "lastName": last,
        "nickName": first,
        "nationalities": [{"country": "GB"}],
        "citizenships": [{"countryOfCitizenship": "GB", "endDate": "2030-12-31"}],
        "residences": [{"type": "Residence", "country": "GB", "status": "Owner", "statutoryRequirementMet": True}],
        "partyIdentifiers": [{
            "type": "Passport",
            "status": "New",
            "issuingAuthority": "UK Passport Office",
            "identifierNumber": _ref("P"),
            "issuedDate": "2020-01-15",
            "expiryDate": "2030-01-15",
            "issuingCountry": "GB",
            "primary": True,
        }],
    }
    party_result = await call("POST", f"{env.base_url_for('Party')}/party/parties", json=party_body, log=calls)
    if not party_result.ok:
        raise HTTPException(400, {"errors": party_result.errors, "apiCalls": calls})
    party_id = party_result.data.get("id")

    account_body = {
        "parties": [{"partyId": party_id, "partyRole": "OWNER"}],
        "productId": "CurrentAccount",
        "currency": "USD",
        "accountName": f"{first} {last} Current Account",
        "openingDate": settings.system_date,
        "quotationReference": _ref("QUOT"),
    }
    account_result = await call(
        "POST", f"{env.base_url_for('Deposits')}/holdings/accounts/currentAccounts", json=account_body, log=calls
    )
    if not account_result.ok:
        return {"partyId": party_id, "firstName": first, "lastName": last, "accountId": None, "apiCalls": calls}
    account_id = account_result.data.get("accountId") or account_result.data.get("accountReference")

    fund_body = {
        "paymentTransactionReference": _ref("FUND"),
        "paymentValueDate": settings.system_date,
        "creditAccount": account_id,
        "paymentAmount": 5000,
        "creditCurrency": "USD",
        "paymentDescription": "Initial deposit",
    }
    await call("POST", f"{env.base_url_for('Deposits')}/order/payments/creditAccount", json=fund_body, log=calls)

    return {"partyId": party_id, "firstName": first, "lastName": last, "accountId": account_id, "apiCalls": calls}


@router.get("/customer/{party_id}")
async def get_customer(party_id: str, request: Request):
    env = request.app.state.environment
    calls: list[dict] = []
    result = await call("GET", f"{env.base_url_for('Party')}/party/parties/{party_id}", log=calls)
    if not result.ok:
        raise HTTPException(404, {"errors": result.errors, "apiCalls": calls})
    body = result.data or {}
    return {
        "firstName": body.get("firstName", ""),
        "lastName": body.get("lastName", ""),
        "dateOfBirth": body.get("dateOfBirth", ""),
        "title": body.get("title", ""),
        "gender": body.get("gender", ""),
        "maritalStatus": body.get("maritalStatus", ""),
        "cityOfBirth": body.get("cityOfBirth", ""),
        "apiCalls": calls,
    }


async def _loan_balances(env, loan_id: str, calls: list[dict]) -> dict:
    """Lending's own balances for a loan (principalOutstanding, loanOutstanding,
    accruedInterest, overdueAmount, productId, accountName, currency)."""
    result = await call(
        "GET", f"{env.base_url_for('Lending')}/holdings/lending/{loan_id}/balances", log=calls
    )
    return result.data if result.ok and isinstance(result.data, dict) else {}


def _outstanding(balances: dict) -> float:
    return balances.get("loanOutstanding") or balances.get("principalOutstanding") or 0


async def _known_loans(env, loan_ids: str, listed: set[str], calls: list[dict]) -> list[dict]:
    """Loans this app created, read straight from Lending. On the local pack
    Lending and Deposits hand out the same account-id sequence, so a new
    loan's id can equal an existing deposit account's id; Holdings then fails
    to register the loan (duplicate alt-key) and it never shows up in the
    party's arrangements. Lending's own balances endpoint still knows it."""
    found: list[dict] = []
    for loan_id in {i.strip() for i in loan_ids.split(",") if i.strip()} - listed:
        data = await _loan_balances(env, loan_id, calls)
        if data.get("productId") in {p["productId"] for p in _LOAN_PRODUCTS.values()}:
            found.append({
                "accountId": loan_id,
                "accountName": data.get("accountName") or data["productId"],
                "currency": data.get("currency", "USD"),
                "status": "CURRENT",
                "workingBalance": _outstanding(data),
            })
    return found


@router.get("/customer/{party_id}/arrangements")
async def get_arrangements(party_id: str, request: Request, knownLoanIds: str = Query("")):
    """Accounts + loans for the party, closed/pending-closure ones filtered
    out (the same fix verified and applied in discoverArrangements.ts --
    closed arrangements never disappear from this sandbox's own
    arrangements endpoint on their own). Works identically whether the
    party was just created or is being reused from an existing ID pinned
    in the party session bar."""
    env = request.app.state.environment
    calls: list[dict] = []
    result = await call(
        "GET", f"{env.base_url_for('Holdings')}/holdings/parties/{party_id}/arrangements", log=calls
    )
    if not result.ok:
        return {"accounts": [], "loans": await _known_loans(env, knownLoanIds, set(), calls), "apiCalls": calls}

    accounts: list[dict] = []
    loans: list[dict] = []
    for arr in result.data.get("arrangements", []):
        if (arr.get("arrangementStatus") or "").upper() in _CLOSED_STATUSES:
            continue
        account_id = _account_id_from_arrangement(arr)
        if not account_id:
            continue
        entry = {
            "accountId": account_id,
            "accountName": _account_short_name(arr),
            "currency": arr.get("currency", "USD"),
            "status": arr.get("arrangementStatus", ""),
            "workingBalance": 0,
        }
        is_loan = "LENDING" in (arr.get("productLine") or "").upper()
        if is_loan:
            entry["workingBalance"] = _outstanding(await _loan_balances(env, account_id, calls))
            loans.append(entry)
        else:
            balance_result = await call(
                "GET", f"{env.base_url_for('Holdings')}/holdings/accounts/{_company_account_id(account_id)}/balances",
                log=calls,
            )
            if balance_result.ok:
                items = (balance_result.data or {}).get("items") or []
                if items:
                    entry["workingBalance"] = items[0].get("workingBalance", 0)
            accounts.append(entry)

    loans += await _known_loans(env, knownLoanIds, {l["accountId"] for l in loans}, calls)
    return {"accounts": accounts, "loans": loans, "apiCalls": calls}


@router.get("/accounts/{account_id}/transactions")
async def get_transactions(account_id: str, request: Request):
    env = request.app.state.environment
    calls: list[dict] = []
    result = await call(
        "GET", f"{env.base_url_for('Holdings')}/holdings/accounts/{_company_account_id(account_id)}/transactions",
        log=calls,
    )
    if not result.ok:
        return {"items": [], "apiCalls": calls}
    items = (result.data or {}).get("items", [])
    return {
        "items": [
            {
                "reference": t.get("transactionReference", ""),
                "date": t.get("bookingDate", ""),
                "narrative": t.get("narrative", ""),
                "amount": t.get("amountInAccountCurrency", t.get("transactionAmount", 0)),
                "currency": t.get("currency", ""),
            }
            for t in items
        ],
        "apiCalls": calls,
    }


@router.get("/accounts/{account_id}/details")
async def get_account_details(account_id: str, request: Request):
    env = request.app.state.environment
    calls: list[dict] = []
    company_account_id = _company_account_id(account_id)
    details_result = await call(
        "GET",
        f"{env.base_url_for('Holdings')}/holdings/accounts/{company_account_id}/accountDetails",
        params={"alternatekey": "accountId", "alternatename": "ACCOUNT"},
        log=calls,
    )
    if not details_result.ok:
        raise HTTPException(404, {"errors": details_result.errors, "apiCalls": calls})
    body = details_result.data or {}
    product = body.get("productDetails", {})
    dates = body.get("accountDates", {})
    return {
        "productName": product.get("productGroup", ""),
        "status": body.get("baseDetails", {}).get("arrangementStatus", ""),
        "openingDate": dates.get("startDate", ""),
        "currency": body.get("baseDetails", {}).get("currency", ""),
        "apiCalls": calls,
    }


@router.post("/accounts")
async def open_account(payload: OpenAccountPayload, request: Request):
    env = request.app.state.environment
    calls: list[dict] = []
    is_savings = payload.accountType == "savings"
    # SavingsAccount does exist on this sandbox and books fine -- confirmed
    # live (this workspace's CLAUDE.md previously claimed otherwise, based on
    # an untested transcription; see console-app's known_issues.py history).
    # productId is still "SavingsAccount" going into the same
    # /holdings/accounts/savingsAccounts endpoint used elsewhere.
    currency = "EUR" if is_savings else "USD"
    account_body = {
        "parties": [{"partyId": payload.partyId, "partyRole": "OWNER"}],
        "productId": "SavingsAccount" if is_savings else "CurrentAccount",
        "currency": currency,
        "accountName": "Savings Account" if is_savings else "Current Account",
        "openingDate": settings.system_date,
        "quotationReference": _ref("QUOT"),
    }
    path = "savingsAccounts" if is_savings else "currentAccounts"
    result = await call(
        "POST", f"{env.base_url_for('Deposits')}/holdings/accounts/{path}", json=account_body, log=calls
    )
    if not result.ok:
        raise HTTPException(400, {"errors": result.errors, "apiCalls": calls})
    account_id = result.data.get("accountId") or result.data.get("accountReference")

    if payload.fundingAmount:
        fund_body = {
            "paymentTransactionReference": _ref("FUND"),
            "paymentValueDate": settings.system_date,
            "creditAccount": account_id,
            "paymentAmount": payload.fundingAmount,
            "creditCurrency": currency,
            "paymentDescription": "Initial deposit",
        }
        await call("POST", f"{env.base_url_for('Deposits')}/order/payments/creditAccount", json=fund_body, log=calls)

    return {"accountId": account_id, "apiCalls": calls}


@router.post("/transfer")
async def transfer(payload: TransferPayload, request: Request):
    env = request.app.state.environment
    calls: list[dict] = []
    body = {
        "paymentTransactionReference": _ref("TRF"),
        "paymentValueDate": settings.system_date,
        "debitAccount": payload.fromAccountId,
        "creditAccount": payload.toAccountId,
        "debitCurrency": "USD",
        "paymentAmount": payload.amount,
        "paymentDescription": payload.description,
    }
    result = await call(
        "POST", f"{env.base_url_for('Deposits')}/order/payments/internalTransfer", json=body, log=calls
    )
    if not result.ok:
        raise HTTPException(400, {"errors": result.errors, "apiCalls": calls})
    return {"ok": True, "apiCalls": calls}


@router.post("/loans")
async def create_loan(payload: CreateLoanPayload, request: Request):
    env = request.app.state.environment
    product = _LOAN_PRODUCTS.get(payload.loanType)
    if not product:
        raise HTTPException(400, {"errors": [f"Unknown loan type: {payload.loanType}"], "apiCalls": []})
    calls: list[dict] = []
    # The settlement account is the composite "deposits|{companyId}|{accountId}"
    # reference, not a plain id. aekxuia takes it as a string; the local pack's
    # Lending wants it wrapped as {"accountId": <composite>} (a plain string is
    # rejected with "string found, object expected"). The composite matters
    # locally too: Lending and Deposits allocate account ids from overlapping
    # sequences, and a bare id equal to the new loan's own id fails with
    # "Settlement Account and Arrangement Account cannot be same".
    composite = f"deposits|{settings.company_id}|{payload.settlementAccountId}"
    settlement = {"accountId": composite} if env.get().settlement_accounts_as_objects else composite
    body = {
        "parties": [{"partyId": payload.partyId, "partyRole": "OWNER"}],
        "productId": product["productId"],
        "currency": "USD",
        "accountName": f"{product['label']} {payload.term}",
        "loanAmount": payload.amount,
        "loanTerm": payload.term,
        "openingDate": settings.system_date,
        "repaymentStartDate": settings.system_date,
        "repaymentFrequency": "Monthly",
        "quotationReference": _ref("QUOT"),
        "disbursementAccount": settlement,
        "repaymentAccount": settlement,
    }
    result = await call(
        "POST", f"{env.base_url_for('Lending')}/holdings/lending/{product['path']}", json=body,
        timeout=settings.long_request_timeout_seconds, log=calls,
    )
    if not result.ok:
        raise HTTPException(400, {"errors": result.errors, "apiCalls": calls})
    loan_id = result.data.get("accountReference") or result.data.get("id")
    return {"loanId": loan_id, "apiCalls": calls}


@router.post("/accounts/{account_id}/close")
async def close_account(account_id: str, request: Request):
    env = request.app.state.environment
    calls: list[dict] = []
    # T24 refuses to close an account that still holds money; check first so
    # the user gets a plain-language reason instead of a T24 error code. If the
    # balance can't be read (Holdings lags on very new accounts) let T24 decide.
    balance_result = await call(
        "GET", f"{env.base_url_for('Holdings')}/holdings/accounts/{_company_account_id(account_id)}/balances",
        log=calls,
    )
    if balance_result.ok:
        items = (balance_result.data or {}).get("items") or []
        working = items[0].get("workingBalance", 0) if items else 0
        if working:
            raise HTTPException(400, {
                "errors": [f"The account must be empty before it can be closed (current balance {working})."],
                "apiCalls": calls,
            })
    result = await call(
        "PUT", f"{env.base_url_for('Deposits')}/holdings/accounts/{account_id}/closure",
        json={"effectiveDate": settings.system_date, "narrative": "Account closure"}, log=calls,
    )
    if not result.ok:
        raise HTTPException(400, {"errors": result.errors, "apiCalls": calls})
    return {"ok": True, "apiCalls": calls}


@router.get("/loans/{loan_id}/schedule")
async def get_loan_schedule(loan_id: str, request: Request):
    # get-loan-details (a separate enquiry) returns TGVCP-007 on this
    # sandbox -- payment schedule is used instead, it works. Response key
    # is "paymentSchedules" (not "items"), amounts are formatted strings
    # with thousands separators -- both discovered live.
    env = request.app.state.environment
    calls: list[dict] = []
    result = await call(
        "GET", f"{env.base_url_for('Lending')}/holdings/lending/{loan_id}/paymentSchedule", log=calls
    )
    if not result.ok:
        return {"items": [], "apiCalls": calls}
    raw = (result.data or {}).get("paymentSchedules", [])
    return {
        "items": [
            {
                "installmentNumber": entry.get("installmentNumber"),
                "date": entry.get("paymentDate", ""),
                "principal": entry.get("principal", ""),
                "interest": entry.get("interest", ""),
                "balance": entry.get("balance", ""),
            }
            for entry in raw
        ],
        "apiCalls": calls,
    }
