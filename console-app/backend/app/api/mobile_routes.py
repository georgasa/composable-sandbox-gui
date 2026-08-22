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

from fastapi import APIRouter, HTTPException, Request
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


class CreateLoanPayload(BaseModel):
    partyId: str
    settlementAccountId: str  # disbursement + repayment account -- sandbox requires it ("Payout Account is Mandatory")
    amount: float
    term: str = "5Y"


@router.post("/customer")
async def create_customer(payload: CreatePartyPayload, request: Request):
    """Creates a demo party + opens & funds one current account in a single
    call so the mobile tab always has something to show immediately after
    "Create Demo Customer" -- mirrors the Building Guide's Account
    Onboarding Flow. For reusing an existing party instead, the frontend
    just pins one via the shared party session bar and calls the GET
    endpoints below -- no separate "load existing" endpoint needed."""
    env = request.app.state.environment
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
    party_result = await call("POST", f"{env.base_url_for('Party')}/party/parties", json=party_body)
    if not party_result.ok:
        raise HTTPException(400, {"errors": party_result.errors})
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
        "POST", f"{env.base_url_for('Deposits')}/holdings/accounts/currentAccounts", json=account_body
    )
    if not account_result.ok:
        return {"partyId": party_id, "firstName": first, "lastName": last, "accountId": None}
    account_id = account_result.data.get("accountId") or account_result.data.get("accountReference")

    fund_body = {
        "paymentTransactionReference": _ref("FUND"),
        "paymentValueDate": settings.system_date,
        "creditAccount": account_id,
        "paymentAmount": 5000,
        "creditCurrency": "USD",
        "paymentDescription": "Initial deposit",
    }
    await call("POST", f"{env.base_url_for('Deposits')}/order/payments/creditAccount", json=fund_body)

    return {"partyId": party_id, "firstName": first, "lastName": last, "accountId": account_id}


@router.get("/customer/{party_id}")
async def get_customer(party_id: str, request: Request):
    env = request.app.state.environment
    result = await call("GET", f"{env.base_url_for('Party')}/party/parties/{party_id}")
    if not result.ok:
        raise HTTPException(404, {"errors": result.errors})
    body = result.data or {}
    return {
        "firstName": body.get("firstName", ""),
        "lastName": body.get("lastName", ""),
        "dateOfBirth": body.get("dateOfBirth", ""),
        "title": body.get("title", ""),
        "gender": body.get("gender", ""),
        "maritalStatus": body.get("maritalStatus", ""),
        "cityOfBirth": body.get("cityOfBirth", ""),
    }


@router.get("/customer/{party_id}/arrangements")
async def get_arrangements(party_id: str, request: Request):
    """Accounts + loans for the party, closed/pending-closure ones filtered
    out (the same fix verified and applied in discoverArrangements.ts --
    closed arrangements never disappear from this sandbox's own
    arrangements endpoint on their own). Works identically whether the
    party was just created or is being reused from an existing ID pinned
    in the party session bar."""
    env = request.app.state.environment
    result = await call("GET", f"{env.base_url_for('Holdings')}/holdings/parties/{party_id}/arrangements")
    if not result.ok:
        return {"accounts": [], "loans": []}

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
            loans.append(entry)
        else:
            balance_result = await call(
                "GET", f"{env.base_url_for('Holdings')}/holdings/accounts/{_company_account_id(account_id)}/balances"
            )
            if balance_result.ok:
                items = (balance_result.data or {}).get("items") or []
                if items:
                    entry["workingBalance"] = items[0].get("workingBalance", 0)
            accounts.append(entry)

    return {"accounts": accounts, "loans": loans}


@router.get("/accounts/{account_id}/transactions")
async def get_transactions(account_id: str, request: Request):
    env = request.app.state.environment
    result = await call(
        "GET", f"{env.base_url_for('Holdings')}/holdings/accounts/{_company_account_id(account_id)}/transactions"
    )
    if not result.ok:
        return {"items": []}
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
        ]
    }


@router.get("/accounts/{account_id}/details")
async def get_account_details(account_id: str, request: Request):
    env = request.app.state.environment
    company_account_id = _company_account_id(account_id)
    details_result = await call(
        "GET",
        f"{env.base_url_for('Holdings')}/holdings/accounts/{company_account_id}/accountDetails",
        params={"alternatekey": "accountId", "alternatename": "ACCOUNT"},
    )
    if not details_result.ok:
        raise HTTPException(404, {"errors": details_result.errors})
    body = details_result.data or {}
    product = body.get("productDetails", {})
    dates = body.get("accountDates", {})
    return {
        "productName": product.get("productGroup", ""),
        "status": body.get("baseDetails", {}).get("arrangementStatus", ""),
        "openingDate": dates.get("startDate", ""),
        "currency": body.get("baseDetails", {}).get("currency", ""),
    }


@router.post("/accounts")
async def open_account(payload: OpenAccountPayload, request: Request):
    env = request.app.state.environment
    account_body = {
        "parties": [{"partyId": payload.partyId, "partyRole": "OWNER"}],
        "productId": "CurrentAccount",
        "currency": "USD",
        "accountName": "Current Account",
        "openingDate": settings.system_date,
        "quotationReference": _ref("QUOT"),
    }
    result = await call("POST", f"{env.base_url_for('Deposits')}/holdings/accounts/currentAccounts", json=account_body)
    if not result.ok:
        raise HTTPException(400, {"errors": result.errors})
    account_id = result.data.get("accountId") or result.data.get("accountReference")

    if payload.fundingAmount:
        fund_body = {
            "paymentTransactionReference": _ref("FUND"),
            "paymentValueDate": settings.system_date,
            "creditAccount": account_id,
            "paymentAmount": payload.fundingAmount,
            "creditCurrency": "USD",
            "paymentDescription": "Initial deposit",
        }
        await call("POST", f"{env.base_url_for('Deposits')}/order/payments/creditAccount", json=fund_body)

    return {"accountId": account_id}


@router.post("/transfer")
async def transfer(payload: TransferPayload, request: Request):
    env = request.app.state.environment
    body = {
        "paymentTransactionReference": _ref("TRF"),
        "paymentValueDate": settings.system_date,
        "debitAccount": payload.fromAccountId,
        "creditAccount": payload.toAccountId,
        "debitCurrency": "USD",
        "paymentAmount": payload.amount,
        "paymentDescription": payload.description,
    }
    result = await call("POST", f"{env.base_url_for('Deposits')}/order/payments/internalTransfer", json=body)
    if not result.ok:
        raise HTTPException(400, {"errors": result.errors})
    return {"ok": True}


@router.post("/loans")
async def create_loan(payload: CreateLoanPayload, request: Request):
    env = request.app.state.environment
    # disbursementAccount/repaymentAccount use the composite
    # "deposits|{companyId}|{accountId}" reference format, NOT a plain
    # account id -- matches Sandbox/03-demoflow-lending.py (100%-verified)
    # exactly. A plain id was tried live and superficially "worked" (loan
    # created, auto-disbursed), but it's not the documented/canonical
    # format and the same live session hit "NO CONSTANT OR LINEAR TYPE ON
    # CALL CONTRACT" with it -- repaymentStartDate/repaymentFrequency
    # (also in the verified script, missing here before) are the likely
    # fix for that specific error.
    settlement_ref = f"deposits|{settings.company_id}|{payload.settlementAccountId}"
    body = {
        "parties": [{"partyId": payload.partyId, "partyRole": "OWNER"}],
        "productId": "ConsumerLoan",
        "currency": "USD",
        "accountName": f"Consumer Loan {payload.term}",
        "loanAmount": payload.amount,
        "loanTerm": payload.term,
        "openingDate": settings.system_date,
        "repaymentStartDate": settings.system_date,
        "repaymentFrequency": "Monthly",
        "quotationReference": _ref("QUOT"),
        "disbursementAccount": settlement_ref,
        "repaymentAccount": settlement_ref,
    }
    result = await call(
        "POST", f"{env.base_url_for('Lending')}/holdings/lending/consumerLoans", json=body,
        timeout=settings.long_request_timeout_seconds,
    )
    if not result.ok:
        raise HTTPException(400, {"errors": result.errors})
    loan_id = result.data.get("accountReference") or result.data.get("id")
    return {"loanId": loan_id}


@router.get("/loans/{loan_id}/schedule")
async def get_loan_schedule(loan_id: str, request: Request):
    # get-loan-details (a separate enquiry) returns TGVCP-007 on this
    # sandbox -- payment schedule is used instead, it works. Response key
    # is "paymentSchedules" (not "items"), amounts are formatted strings
    # with thousands separators -- both discovered live.
    env = request.app.state.environment
    result = await call("GET", f"{env.base_url_for('Lending')}/holdings/lending/{loan_id}/paymentSchedule")
    if not result.ok:
        return {"items": []}
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
        ]
    }
