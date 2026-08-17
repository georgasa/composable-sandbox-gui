# composable-sandbox-gui

The **Composable Hands-on Lab** -- a single web app for the Temenos
Composable Banking `aekxuia` sandbox (release 202604), deployed locally via
Docker Compose (Rancher Desktop) and to Azure Container Apps automatically
on every push via GitHub Actions.

One app, four tabs:

| Tab | What it is |
|---|---|
| **Catalog** | Browse/call any of 323 sandbox operations, with a confirm-before-execute safety gate. |
| **Assistant** | Describe what you want in plain English; an LLM proposes the matching API call. |
| **Flows** | Multi-step demo flows (account onboarding, loan origination, etc.). |
| **Mobile** | A demo-ready mobile banking phone-frame UI, backed live by the sandbox, with a settings-driven look-and-feel skin picker. |

All four tabs share one login (the app-wide password gate on Azure) and one
**party session**: pin a party ID once (top bar) -- or create a new demo
party from the Mobile tab -- and every tab, including Mobile, picks it up
automatically. See [`console-app/README.md`](console-app/README.md) for
architecture detail, and [`SANDBOX_NOTES.md`](SANDBOX_NOTES.md) for the
sandbox-specific quirks the app bakes in (fixed business date, error
envelope shapes, known-broken endpoints, etc.).

## Architecture

```
              ┌─────────────────────┐
              │   console-frontend   │
              │   (React + nginx)    │
              │  Catalog / Assistant │
              │  / Flows / Mobile    │
              └──────────┬───────────┘
                         │ /api/*
              ┌──────────▼───────────┐
              │   console-backend     │
              │   (FastAPI)           │
              └──────────┬───────────┘
                         │
            Party / Deposits / Holdings / Lending
                (aekxuia sandbox, live)
```

Frontend + backend, matching the Compose topology 1:1 on Azure (frontend on
external ingress, backend internal-only).

## Run it locally

Prerequisite: Rancher Desktop (or any Docker Compose engine) running,
`docker compose version` working.

```bash
docker compose up -d --build
```

Open **http://localhost:8091**. No password gate locally (`AUTH_MODE=none`
by default). The Assistant tab needs an OpenAI key pasted into its
Environment modal -- everything else, including the Mobile tab, works
immediately against the live sandbox.

## Azure deployment

Auto-deployed to Azure Container Apps (subscription `BSGglobal`, resource
group `composable-demo-viewer`) on every push to `main` via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Runs with
`AUTH_MODE=password` there (shared demo password, set as a GitHub Actions
secret) -- the sandbox itself has no auth, so this is the only thing gating
the public URL from the open internet mutating shared sandbox data.

Infrastructure (registry, Container Apps environment, the two Container
Apps themselves) is provisioned once via [`infra/provision.sh`](infra/provision.sh),
not on every push -- the workflow only builds an image and updates the
existing Container Apps.

## Repo layout

```
composable-sandbox-gui/
├── console-app/            # the app: frontend (incl. Mobile tab) + backend
├── API-Event/              # OpenAPI specs the Catalog tab is built from
├── docker-compose.yml      # local dev
├── infra/provision.sh      # one-time Azure infra bootstrap
├── .github/workflows/      # CI/CD: build + deploy on push to main
└── SANDBOX_NOTES.md        # aekxuia sandbox quirks the app bakes in
```
