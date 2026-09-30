# composable-sandbox-gui

The **Composable Hands-on Lab** -- a single web app for Temenos Composable
Banking, deployed locally via Docker Compose and to Azure Container Apps
automatically on every push via GitHub Actions. Points at either the Azure
`aekxuia` sandbox (release 202604) or a real modular Composable Banking
stack (Deposits, Lending, Holdings, Party) running locally as k3s pods --
switch between them from the Environment modal, see
[Environments](#environments) below.

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
      (aekxuia on Azure, or a local k3s modular pack --
                see Environments below)
```

Frontend + backend, matching the Compose topology 1:1 on Azure (frontend on
external ingress, backend internal-only).

## Run it locally

Prerequisite: a working Docker Compose engine. Native Docker Engine inside
a WSL2 distro is the recommended setup on Windows (no Rancher Desktop /
Docker Desktop / Podman Desktop needed) -- `docker compose version` working
is all that matters.

```bash
docker compose up -d --build
```

Open **http://localhost:8091**. No password gate locally (`AUTH_MODE=none`
by default). The Assistant tab needs an OpenAI key pasted into its
Environment modal -- everything else, including the Mobile tab, works
immediately against whichever environment is active (see below).

## Environments

The Environment modal (⚙ button, top right) has a one-click switcher
between two named presets (`console-app/backend/app/environment.py`):

| Preset | Points at |
|---|---|
| **aekxuia (R26.04)** | The Azure-hosted `aekxuia` sandbox -- works everywhere this app runs, local or Azure. |
| **Local WSL (k3s modular pack)** | A real modular Composable Banking deployment (Deposits, Lending, Holdings, Party, ...) running as k3s pods on the same machine, under a WSL Ubuntu distro. Only reachable when this app *itself* also runs locally under that same WSL distro -- it's a no-op on Azure. |

The local preset uses `host.docker.internal` (via `docker-compose.yml`'s
`extra_hosts: host-gateway`) to reach the k3s cluster's NodePort/LoadBalancer
ports from inside the `console-backend` container. If your local k3s
cluster's ports differ from what's baked in, either edit
`app/environment.py`'s `LOCAL_WSL_ENVIRONMENT.base_url_overrides` and
rebuild, or use the Environment modal's manual prefix/seed/region fields to
point at a different Azure-style sandbox instead -- switching away from a
preset by hand-editing a field turns it into a custom/ad-hoc environment
(shown as such in the modal) rather than replacing the preset itself.

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
