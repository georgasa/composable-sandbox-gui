# Build context is the REPO ROOT, not this directory -- this image needs
# to COPY the sibling API-Event/ folder in, which sits outside
# console-app/. Build from repo root:
#   nerdctl --namespace k8s.io build -f console-app/backend/Dockerfile -t console-app-backend:local .

FROM python:3.12-slim

WORKDIR /app

COPY console-app/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY console-app/backend/app ./app
# Specs are baked in at build time rather than runtime-mounted -- avoids
# hostPath-mounting an OneDrive-synced Windows path into the Rancher
# Desktop VM, and keeps the image self-contained/reproducible.
COPY API-Event ./app/specs/API-Event

ENV SPECS_DIR=app/specs/API-Event
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
