# composable-sandbox-gui

Two demo web apps for the Temenos Composable Banking `aekxuia` sandbox
(release 202604), sharing one local dev environment (Docker Compose /
Rancher Desktop) and one Azure deployment (Container Apps, auto-deployed on
every push via GitHub Actions).

| App | What it is | Local URL |
|---|---|---|
| [`console-app`](console-app/) | General-purpose API console -- browse/call any of 323 sandbox operations, or ask a natural-language assistant, with a confirm-before-execute safety gate. | http://localhost:8091 |
| [`mobile-simulator`](mobile-simulator/) | A demo-ready mobile banking app UI, backed live by the sandbox, with a settings-driven look-and-feel skin picker. | http://localhost:8092 |

See each app's own README for details specific to it, and
[`SANDBOX_NOTES.md`](SANDBOX_NOTES.md) for the sandbox-specific quirks both
apps bake in (fixed business date, error envelope shapes, known-broken
endpoints, etc.).

## Architecture

```
                    ┌─────────────────────┐        ┌─────────────────────┐
                    │   console-frontend   │        │   mobile-frontend    │
                    │   (React + nginx)    │        │   (React + nginx)    │
                    └──────────┬───────────┘        └──────────┬───────────┘
                               │ /api/*                         │ /api/*
                    ┌──────────▼───────────┐        ┌──────────▼───────────┐
                    │   console-backend     │        │   mobile-backend      │
                    │   (FastAPI)           │        │   (FastAPI)           │
                    └──────────┬───────────┘        └──────────┬───────────┘
                               │                                │
                               └───────────────┬────────────────┘
                                                │
                                   Party / Deposits / Holdings / Lending
                                       (aekxuia sandbox, live)
```

Each app is frontend + backend, matching the compose topology 1:1 on Azure
(Container Apps: frontends on external ingress, backends internal-only).

## Run it locally

Prerequisite: Rancher Desktop (or any Docker Compose engine) running,
`docker compose version` working.

```bash
docker compose up -d --build
```

- Console: http://localhost:8091
- Mobile simulator: http://localhost:8092

No password gate locally (`AUTH_MODE=none` by default in both apps). The
console-app's Assistant tab needs an OpenAI key pasted into its Environment
modal -- everything else works immediately against the live sandbox.

## Azure deployment

Auto-deployed to Azure Container Apps (subscription `BSGglobal`, resource
group `composable-demo-viewer`) on every push to `main` via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Both apps
run with `AUTH_MODE=password` there (shared demo password, set as a GitHub
Actions secret) -- the sandbox itself has no auth, so this is the only thing
gating the public URLs from the open internet mutating shared sandbox data.

Infrastructure (registry, Container Apps environment, the four Container
Apps themselves) is provisioned once via [`infra/provision.sh`](infra/provision.sh),
not on every push -- the workflow only builds images and updates existing
Container Apps.

## Repo layout

```
composable-sandbox-gui/
├── console-app/            # API console (frontend + backend)
├── mobile-simulator/       # mobile banking demo (frontend + backend)
├── API-Event/              # OpenAPI specs console-app's catalog is built from
├── docker-compose.yml      # local dev: all 4 services
├── infra/provision.sh      # one-time Azure infra bootstrap
├── .github/workflows/      # CI/CD: build + deploy on push to main
└── SANDBOX_NOTES.md        # aekxuia sandbox quirks both apps bake in
```
