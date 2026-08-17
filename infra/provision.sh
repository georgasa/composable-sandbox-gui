#!/usr/bin/env bash
# One-time Azure infra bootstrap -- run manually, NOT part of CI. Creates:
#   - an ACR (composablesandboxgui) in the composable-demo-viewer RG
#   - a Container Apps Environment
#   - 2 Container Apps (1 internal-only backend, 1 externally-exposed
#     frontend) for the single Composable Banking Console app -- the mobile
#     banking demo lives inside it as the "Mobile" tab, not a separate app
#   - a Service Principal scoped as Contributor on the RG, whose creds
#     .github/workflows/deploy.yml uses on every subsequent push
#
# After this runs once, deploy.yml only builds new images and runs
# `az containerapp update` against the apps this script already created --
# it never creates/deletes infra itself.
#
# Usage: DEMO_PASSWORD=... ./infra/provision.sh   (run from repo root)

set -euo pipefail

RG="composable-demo-viewer"
LOCATION="northeurope"
ACR_NAME="composablesandboxgui"
ENV_NAME="composable-sandbox-env"
SUB_ID=$(az account show --query id -o tsv)

DEMO_PASSWORD="${DEMO_PASSWORD:?Set DEMO_PASSWORD before running (the shared password that gates the public demo URL)}"

DEPOSITS_BASE_URL="http://deposits-aekxuia0951.westeurope.cloudapp.azure.com/irf-deposits-container/api/v1.0.0"
HOLDINGS_BASE_URL="http://aekxuia0951.westeurope.cloudapp.azure.com/ms-holdings-api/api/v1.0.0"
PARTY_BASE_URL="http://aekxuia0951.westeurope.cloudapp.azure.com/ms-party-api/api/v5.0.0"
LENDING_BASE_URL="http://lending-aekxuia0951.westeurope.cloudapp.azure.com/irf-lending-container/api/v1.0.0"

echo "== 1/5: ACR =="
az acr create -g "$RG" -n "$ACR_NAME" --sku Basic --admin-enabled true --only-show-errors -o none

ACR_SERVER="${ACR_NAME}.azurecr.io"
ACR_USER=$(az acr credential show -n "$ACR_NAME" --query username -o tsv)
ACR_PASS=$(az acr credential show -n "$ACR_NAME" --query "passwords[0].value" -o tsv)

echo "== 2/5: Container Apps Environment =="
az containerapp env create -g "$RG" -n "$ENV_NAME" --location "$LOCATION" --only-show-errors -o none

echo "== 3/5: Build images directly to ACR (no local Docker needed) =="
az acr build -r "$ACR_NAME" -t console-backend:latest -f console-app/backend/Dockerfile . --only-show-errors -o none
az acr build -r "$ACR_NAME" -t console-frontend:latest -f console-app/frontend/Dockerfile . --only-show-errors -o none

echo "== 4/5: Backend Container App (internal ingress only) =="
az containerapp create -g "$RG" -n console-backend --environment "$ENV_NAME" \
  --image "$ACR_SERVER/console-backend:latest" \
  --registry-server "$ACR_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
  --ingress internal --target-port 8000 --min-replicas 0 --max-replicas 1 \
  --cpu 0.5 --memory 1.0Gi \
  --env-vars DEPOSITS_BASE_URL="$DEPOSITS_BASE_URL" HOLDINGS_BASE_URL="$HOLDINGS_BASE_URL" \
    PARTY_BASE_URL="$PARTY_BASE_URL" LENDING_BASE_URL="$LENDING_BASE_URL" \
    COMPANY_ID=GB0010001 SYSTEM_DATE=2025-03-14 \
    AUTH_MODE=password DEMO_PASSWORD="$DEMO_PASSWORD" \
    LLM_PROVIDER=openai OPENAI_MODEL=gpt-4o-mini \
    REQUEST_TIMEOUT_SECONDS=30 LONG_REQUEST_TIMEOUT_SECONDS=90 PENDING_EXECUTION_TTL_SECONDS=300 \
  --only-show-errors -o none

CONSOLE_BACKEND_FQDN=$(az containerapp show -g "$RG" -n console-backend --query properties.configuration.ingress.fqdn -o tsv)

echo "== 5/5: Frontend Container App (external ingress) =="
# BACKEND_PORT=80 (not 8000): Container Apps ingress always terminates on
# port 80/443 at the platform layer regardless of the container's own
# target-port, so other apps in the environment reach it on 80.
az containerapp create -g "$RG" -n console-frontend --environment "$ENV_NAME" \
  --image "$ACR_SERVER/console-frontend:latest" \
  --registry-server "$ACR_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
  --ingress external --target-port 80 --min-replicas 1 --max-replicas 1 \
  --cpu 0.25 --memory 0.5Gi \
  --env-vars BACKEND_HOST="$CONSOLE_BACKEND_FQDN" BACKEND_PORT=80 \
  --only-show-errors -o none

echo "Service principal for GitHub Actions =="
# MSYS_NO_PATHCONV=1: on Git Bash for Windows, an argument starting with
# "/" (like "/subscriptions/...") gets silently mangled into a Windows path
# (e.g. "C:/Program Files/Git/subscriptions/...") by MSYS's automatic
# path-conversion heuristic -- discovered live, caused the role assignment
# to fail with a cryptic "MissingSubscription" error. No-op on Linux CI
# runners or a real POSIX shell.
SP_JSON=$(MSYS_NO_PATHCONV=1 az ad sp create-for-rbac --name "composable-sandbox-gui-deploy" --role Contributor \
  --scopes "/subscriptions/$SUB_ID/resourceGroups/$RG" -o json)

echo
echo "======================================================================"
echo "Done. Add these as GitHub Actions secrets (gh secret set, or Settings"
echo "-> Secrets and variables -> Actions) on georgasa/composable-sandbox-gui:"
echo
echo "  AZURE_CREDENTIALS = <the full raw JSON printed by az ad sp create-for-rbac above>"
echo "  DEMO_PASSWORD     = $DEMO_PASSWORD"
echo
echo "Console (with Mobile tab): https://$(az containerapp show -g "$RG" -n console-frontend --query properties.configuration.ingress.fqdn -o tsv)"
echo "======================================================================"
