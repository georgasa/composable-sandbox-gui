# Mobile Banking Simulator

A demo-ready mobile banking app UI (phone-frame mockup, running in a
browser) backed live by the Temenos Composable Banking `aekxuia` sandbox --
create a customer, watch a real current account get opened and funded,
transfer between accounts, take out a consumer loan, and browse its payment
schedule, all against real sandbox API calls.

Part of the [composable-sandbox-gui](../README.md) monorepo, alongside the
[console-app](../console-app/) API console.

## Why a separate app from console-app

`console-app` is a general-purpose "call any of 323 operations" tool with a
confirm-before-execute safety gate -- right for exploring the API surface,
wrong for a sales/demo flow that should feel like using an actual banking
app. This app instead exposes a small, curated, fixed set of backend
endpoints (`backend/app/api/mobile_routes.py`) covering exactly what the
mobile screens need, and executes them directly -- no confirm step, no
general catalog.

## Look & feel

Settings → Look & Feel lets you switch between 4 generic style presets,
each a distinct CSS custom-property token set
(`frontend/src/styles/tokens.css`), applied instantly via a `data-skin`
attribute:

- **Minimal Light** -- clean, airy, blue accent
- **Midnight Dark** -- dark navy, single accent
- **Classic Retail** -- navy & gold, boxier cards, serif headings
- **Bold Gradient** -- vibrant gradient header, large rounded buttons

These are deliberately generic (no real bank names, logos, or trademarked
colors/marks) -- this is a public demo URL, and literal branded skins would
carry real trademark/impersonation risk.

## Architecture

```
frontend (React/nginx)
   |  /api/mobile/* proxied by nginx
   v
backend (FastAPI) --curated endpoints--> aekxuia sandbox (Party/Deposits/Holdings/Lending)
```

Unlike console-app, base URLs are fixed at startup via env vars (no runtime
Environment modal -- this is a curated demo, not a general console).
`backend/app/sandbox_client.py` applies the same fixed-date/companyId/error-
envelope conventions documented in the root `CLAUDE.md`.

Two sandbox quirks fixed at the source here (rather than inherited from the
reference implementation this was built from -- see git history / PR
description for the upstream bug reports):
- Closed and pending-closure accounts/loans are filtered out of the
  arrangements list (`get_arrangements` in `mobile_routes.py`) -- the
  sandbox's own arrangements endpoint never drops them on its own.
- The literal string `"null"` that the sandbox sometimes returns for
  `extensionData.ShortTitle` is treated as "no title" and falls back to the
  product name, instead of being displayed verbatim.

## Run it locally

From the **repo root**:

```bash
docker compose up -d --build mobile-backend mobile-frontend
```

Open **http://localhost:8092**. No password gate locally (`AUTH_MODE=none`
by default) -- see console-app's README for the auth model, shared by both
apps.

## Screens

Login (create demo customer) → Dashboard (accounts, open account) →
Transactions (drill into an account) → Transfer (between own accounts) →
Loans (list, create consumer loan) → Payment Schedule (drill into a loan) →
Profile → Settings (skin picker).
