# Composable Banking Console

The web app behind the repo: explore and call every API of the Temenos
Composable Banking stack (Party, Deposits, Holdings, Lending -- 323 operations),
let an LLM propose a call from plain English, or use the **Mobile** tab, a
phone-frame banking demo driven by the same APIs. Nothing in the Catalog or
Assistant fires against the real services until you explicitly confirm it.

See [`../README.md`](../README.md) for what the tabs do, the environments and
the Azure deployment, and [`../SANDBOX_NOTES.md`](../SANDBOX_NOTES.md) for the
service behaviours this app encodes.

## Architecture

```
frontend (React + nginx)
   |  /api/* proxied by nginx (lazy DNS resolution -- see nginx.conf.template)
   v
backend (FastAPI)  ---builds catalog from--->  ../API-Event/*/swagger/*.yaml (baked into the image)
   |  /api/assistant/query
   v
OpenAI (gpt-4o-mini by default)
```

- **Catalog**: parsed from the OpenAPI specs at backend startup, keyed
  `service/sourceFile:METHOD:path` (not `operationId` -- 11 operationIds collide
  across files). Plus 5 supplemental operations that are real and verified but
  absent from every spec (Holdings `accountDetails`/`transactions`/`balances`,
  party `arrangements`, and the flat `POST /party/parties`).
- **Confirm-before-fire**: `/api/prepare` (Catalog) and `/api/assistant/query`
  only ever *propose* a call and return a one-time `pendingExecutionId`.
  `/api/execute` is the only route that calls the real services and only accepts
  that token, never a raw operation. Enforced server-side.
- **Request building** (`catalog/request_builder.py`, `execution/sandbox_rules.py`):
  fills known-good defaults -- the fixed business date, company id, and
  alphanumeric-only references. Auto-fill skips `paymentReservationReference`
  (see `SANDBOX_NOTES.md`: it makes payments publish no events).
- **NL assistant**: BM25 shortlists candidate operations, then an LLM picks one
  and extracts parameters. Provider, model and key are editable live in the
  Environment modal.
- **Environments** (`environment.py`): two named presets, `local` (k3s pack via
  `host.docker.internal`) and `aekxuia` (Azure). The starting preset is the
  `DEFAULT_ENVIRONMENT` setting; the modal switches at runtime. The preset also
  carries per-environment request-shape differences (for example how Lending
  wants settlement accounts written).
- **Party session bar**: pin a party ID (or create a demo party) and it
  auto-fills into every `partyId` field; the party's accounts and loans are
  offered as pickers (closed accounts are filtered out).
- **Known-issue banners** (`catalog/known_issues.py`): broken endpoints and
  non-obvious required fields are shown in the operation detail and responses.

## Mobile tab

A curated, direct-execute set of endpoints (`backend/app/api/mobile_routes.py`,
mounted at `/api/mobile`) drives the phone UI
(`frontend/src/pages/MobileSimulator.tsx`). It reuses the app-wide party session.
There is no confirm gate here: it is a small, demo-safe operation set, not a
"call anything" console.

| Action | Calls |
|---|---|
| Create demo customer | `POST /party/parties`, open a current account, fund it |
| Open current / savings account | `POST /holdings/accounts/{currentAccounts,savingsAccounts}`, optional funding credit |
| Transfer | `POST /order/payments/internalTransfer` |
| Personal loan / mortgage | `POST /holdings/lending/{consumerLoans,mortgages}` |
| Close account | read the Holdings balance, then `PUT /holdings/accounts/{id}/closure` (refused with a reason unless the balance is 0) |
| View transactions / loan schedule | Holdings `transactions`, Lending `paymentSchedule` |

How the frontend behaves (`frontend/src/context/MobileSessionContext.tsx`):

- **Under the Hood** shows only the calls of the last *user action*, with a label,
  and keeps the calls of an action that failed. Loading and background refreshes
  are deliberately excluded.
- **15 second poll** re-reads the customer and accounts silently (no loading
  state, no panel update), so changes made in other tabs or tools appear.
- **Known loans**: the loan ids this browser created are remembered per party in
  `localStorage` and read from Lending's own `balances` endpoint, because on the
  local pack a loan can be missing from Holdings (id collision, see
  `SANDBOX_NOTES.md`).

## Run and redeploy

From the repo root:

```bash
docker compose up -d --build                  # both services
docker compose up -d --build console-backend  # after a backend change
docker compose up -d --build console-frontend # after a frontend change
```

Open **http://localhost:8091**. After the backend restarts the app returns to its
`DEFAULT_ENVIRONMENT`.

### AI Assistant

Paste an OpenAI key into Environment -> AI Assistant in the running app. It is
saved to a git-ignored file (`console-app/data/llm_config.json`, bind-mounted,
never baked into the image) and survives rebuilds. The Catalog and the
confirm/execute pipeline need no key.

## Configuration

Environment variables on the backend (see `backend/app/config.py`):

| Variable | Meaning |
|---|---|
| `DEFAULT_ENVIRONMENT` | `local` (compose default) or `aekxuia` (Azure) |
| `COMPANY_ID`, `SYSTEM_DATE` | `GB0010001`, `2025-03-14` -- the fixed company and business date |
| `AUTH_MODE`, `DEMO_PASSWORD` | `none` locally; `password` on Azure (the services themselves have no auth) |
| `LLM_PROVIDER`, `OPENAI_*`, `OLLAMA_*` | initial assistant provider settings |
| `REQUEST_TIMEOUT_SECONDS`, `LONG_REQUEST_TIMEOUT_SECONDS` | per-call timeouts (lending creates use the long one) |

## Known limitations

- `pending_store` is in-process memory in the single backend container -- do not
  run several backend replicas without moving it to Redis first.
- Base-URL resolution per operation is a best-effort default (see the comment in
  `backend/app/catalog/loader.py`); every prepared request shows its URL in the
  confirm step before it fires.
- The "Transact Lending API v8" endpoint has no OpenAPI spec here and is not
  covered by the Catalog.
