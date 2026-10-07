# composable-sandbox-gui

The **Composable Hands-on Lab** -- a single web app for exploring and demoing
Temenos Composable Banking. It talks to either a real modular stack running
locally (Deposits, Lending, Holdings, Party as k3s pods under WSL) or the
Azure-hosted `aekxuia` sandbox, and is deployed to Azure Container Apps
automatically on every push to `main`.

One app, three tabs:

| Tab | What it is |
|---|---|
| **Catalog** | Browse and call any of 323 operations, grouped by API domain (Holdings, Order, Party, Reference), with a confirm-before-execute safety gate. |
| **Assistant** | Describe what you want in plain English; an LLM proposes the matching API call. |
| **Mobile** | A phone-frame mobile banking demo backed live by the APIs: accounts, transfers, personal loans and mortgages, closing accounts, with an "Under the Hood" panel showing the real calls behind each action. |
| **Architecture** | The Composable Banking reference architecture (Deposits, Lending, Payments, Product & Pricing): runtime and system views redrawn from the Temenos architecture pictures, with hover-to-trace flows. Deep link: `#architecture/<view-id>`. |

All tabs share one login (the password gate on Azure) and one **party
session**: pin a party ID once in the top bar -- or create a demo customer from
the Mobile tab -- and every tab picks it up.

## Mobile tab

- **Accounts**: open current and savings accounts, view transactions, transfer
  between your own accounts.
- **Loans**: switch between **Personal loan** (up to $20,000, 1-10 years) and
  **Mortgage** (up to $500,000, 10-20 years), each with its own offer text.
  Loans are paid out to and repaid from a USD account.
- **Close an account**: from the account screen. The account must be empty
  (balance 0) first -- the button explains this and stays disabled until then.
- **Under the Hood**: shows the real HTTP calls made by your **last action**
  (for example "Create mortgage" -> the one `POST .../mortgages`), including the
  calls of an action that failed. Background refreshes never replace it.
- **Auto refresh**: the Mobile tab re-reads balances and accounts every 15
  seconds, so changes made elsewhere (another tab, Postman) show up without a
  manual refresh.
- Settings (the gear) switch the look-and-feel skin.

## Environments

The Environment modal (the gear in the top bar) switches between two presets:

| Preset | Points at |
|---|---|
| **Local WSL (k3s modular pack)** -- default | A real modular Composable Banking deployment running as k3s pods on this machine under a WSL Ubuntu distro. Reached from the backend container through `host.docker.internal`. |
| **aekxuia (R26.04)** | The Azure-hosted sandbox. Works everywhere, and is what the Azure deployment uses. |

The preset the app **starts on** is the `DEFAULT_ENVIRONMENT` variable: `local`
in `docker-compose.yml`, `aekxuia` on Azure (set by `infra/provision.sh`),
because a cloud deployment cannot reach a pack on your machine. The ports and
paths of the local preset are in `console-app/backend/app/environment.py`; if
yours differ, edit them there and rebuild.

> After restarting the backend container the app returns to its configured
> default environment -- re-select a preset if you had switched at runtime.

## Run it locally

Prerequisite: a Docker Compose engine (native Docker Engine inside the WSL2
distro is the simplest on Windows) and, for the default preset, the local pack
running as k3s pods.

```bash
docker compose up -d --build
```

Open **http://localhost:8091**. No password gate locally (`AUTH_MODE=none`).
To start on the Azure sandbox instead:

```bash
DEFAULT_ENVIRONMENT=aekxuia docker compose up -d --build
```

The Assistant tab needs an OpenAI key pasted into the Environment modal;
everything else works without one.

## Azure deployment

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
it builds both images in Azure Container Registry and updates the two Container
Apps (subscription `BSGglobal`, resource group `composable-demo-viewer`; frontend on
external ingress, backend internal-only). The Azure backend runs with
`AUTH_MODE=password` (a shared demo password held as a GitHub Actions secret)
and `DEFAULT_ENVIRONMENT=aekxuia`.

The infrastructure itself (registry, Container Apps environment, the apps, the
service principal behind the `AZURE_CREDENTIALS` secret) is created once by
[`infra/provision.sh`](infra/provision.sh), not on every push. Environment
variables set on an existing app carry over between deployments; to change one,
use `az containerapp update --set-env-vars`.

## Things worth knowing

The sandbox has behaviours that are not obvious from the API specs; the app
encodes them and [`SANDBOX_NOTES.md`](SANDBOX_NOTES.md) explains them. The two
that cost the most time:

- **`paymentReservationReference` silently suppresses events.** A payment sent
  with it is booked and answers `201`, but its Kafka events are never published,
  so Holdings and the Mobile tab never see it. The console therefore does not
  auto-fill this field. Details in `SANDBOX_NOTES.md`.
- **The local Lending service differs from the spec**: settlement accounts must
  be objects, loan ids can collide with deposit account ids (Holdings then cannot
  list the loan), and loans are not paid out (the adapter that executes the payout is stuck). See
  `SANDBOX_NOTES.md`.

## Architecture

```
              ┌─────────────────────┐
              │   console-frontend   │
              │   (React + nginx)    │
              │ Catalog / Assistant  │
              │       / Mobile       │
              └──────────┬───────────┘
                         │ /api/*
              ┌──────────▼───────────┐
              │   console-backend     │
              │   (FastAPI)           │
              └──────────┬───────────┘
                         │
            Party / Deposits / Holdings / Lending
        (local k3s pack, or the aekxuia sandbox on Azure)
```

See [`console-app/README.md`](console-app/README.md) for how the backend and
frontend work.

## Repo layout

```
composable-sandbox-gui/
├── console-app/            # the app: React frontend + FastAPI backend
├── API-Event/              # OpenAPI specs the Catalog is built from
├── docker-compose.yml      # local run
├── infra/provision.sh      # one-time Azure infrastructure bootstrap
├── .github/workflows/      # build + deploy on push to main
└── SANDBOX_NOTES.md        # sandbox behaviours the app encodes
```
