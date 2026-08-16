# Build context is this directory (unlike console-app/backend, this app
# doesn't need the sibling API-Event/ specs -- it's a curated, fixed
# endpoint set, not a general catalog):
#   docker build -f mobile-simulator/backend/Dockerfile -t mobile-backend:local mobile-simulator/backend

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
