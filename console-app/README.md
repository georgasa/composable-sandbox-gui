# Composable Banking Console

A web console for exploring and calling every API in the Temenos Composable
Banking `aekxuia` sandbox (release 202604). Browse the full catalog of 323
operations across Party, Deposits, Holdings, and Lending, or describe what
you want in plain English and let an LLM propose the matching API call --
nothing ever fires against the real sandbox until you explicitly confirm it.

Also includes a **Mobile** tab -- a phone-frame mobile banking demo UI
backed by the same sandbox, with a settings-driven look-and-feel skin
picker -- sharing this app's login and party session rather than being a
separate app/deployment.

See [`../SANDBOX_NOTES.md`](../SANDBOX_NOTES.md) for the sandbox-specific
rules baked into this app's `sandbox_rules.py` and `known_issues.py`.

## Architecture

```
frontend (React/nginx)
   |  /api/* proxied by nginx (lazy DNS resolution -- see nginx.conf.template)
   v
backend (FastAPI)  ---builds catalog from--->  ../API-Event/*/swagger/*.yaml (baked into image)
   |  /api/assistant/query
   v
OpenAI (gpt-4o-mini by default)
```

- **Catalog**: parsed from all 10 OpenAPI spec files at backend startup,
  keyed `service/sourceFile:METHOD:path` (not `operationId` -- 11
  operationIds collide across files). Plus 5 supplemental operations that
  are real and verified-working but absent from every spec (Holdings
  `accountDetails`/`transactions`/`balances`/party `arrangements`, and the
  flat `POST /party/parties`).
- **Confirm-before-fire**: `/api/prepare` (catalog browser) and
  `/api/assistant/query` (NL path) both only ever *propose* a call and
  return a one-time-use `pendingExecutionId`. `/api/execute` is the only
  route that calls the real sandbox, and it only accepts that token -- never
  a raw operation. This is enforced server-side, not just hidden in the UI.
- **NL assistant**: BM25 shortlists candidate operations from the query
  text, then an LLM picks one and extracts parameters. Provider/model/API
  key are editable live from the ⚙ Environment modal -- no restart needed.
- **Environment switching**: the same modal edits label/prefix/seed/region,
  and every service's base URL is derived from those automatically.
- **Party session bar**: pin a party ID (or create a new demo party) and it
  auto-fills into every subsequent `partyId` field; the party's open
  accounts/loans are auto-discovered and offered as picker dropdowns
  (closed/pending-closure arrangements are filtered out -- see
  `frontend/src/utils/discoverArrangements.ts`).
- **Known-issue banners**: sandbox quirks documented in the root
  `CLAUDE.md` (broken endpoints, non-obvious required fields, response
  shapes that differ from the spec) surface directly in the operation
  detail and response views via `backend/app/catalog/known_issues.py`.
- **Mobile tab**: a curated, direct-execute set of endpoints
  (`backend/app/api/mobile_routes.py`, mounted at `/api/mobile`) drives a
  phone-frame demo UI (`frontend/src/pages/MobileSimulator.tsx`). Reuses
  the same party session as the other tabs (`context/PartyContext.tsx`) --
  pin an existing party ID in the top bar, or create a new demo party from
  the Mobile tab itself, and it's picked up everywhere. No confirm gate on
  this tab's own endpoints: it's a small, curated, demo-safe operation set,
  not the general catalog.

## Run it locally

From the **repo root**:

```bash
docker compose up -d --build console-backend console-frontend
```

Open **http://localhost:8091**. No password gate locally (`AUTH_MODE=none`
by default) -- see [Auth](#auth) below.

### AI Assistant setup

The Assistant tab needs an OpenAI API key. Paste one into
⚙ Environment → AI Assistant in the running app -- it's saved to a local,
git-ignored file (`console-app/data/llm_config.json`, bind-mounted, never
baked into the image) and survives container rebuilds. Catalog browsing and
the confirm/execute pipeline work immediately without any key.

## Auth

`AUTH_MODE` env var: `none` (default, local dev -- no login screen) or
`password` (used on the Azure deployment, since the underlying sandbox has
no auth of its own and the app is the only thing gating it from the public
internet). See `backend/app/auth.py`.

## Redeploying after a code change

```bash
docker compose up -d --build console-backend    # or console-frontend
```

## Known limitations

- `pending_store` is in-process memory in the single backend container --
  don't run multiple backend replicas without moving it to Redis first.
- Base-URL resolution per operation is a best-effort default (see the long
  comment in `backend/app/catalog/loader.py`). Every prepared request's URL
  is visible in the confirm step before firing, so a wrong guess is caught
  by inspection, not by chance.
- The separate "Transact Lending API v8" base URL has no OpenAPI spec in
  this workspace and is not covered by this catalog.
