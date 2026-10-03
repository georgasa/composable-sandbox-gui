# Build context is the REPO ROOT, not this directory -- this image needs
# to COPY the sibling API-Event/ folder in, which sits outside
# console-app/. Build from repo root:
#   docker build -f console-app/backend/Dockerfile -t console-backend .

FROM python:3.12-slim

WORKDIR /app

COPY console-app/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY console-app/backend/app ./app
# Specs are baked in at build time, keeping the image self-contained and
# reproducible.
COPY API-Event ./app/specs/API-Event

ENV SPECS_DIR=app/specs/API-Event
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
