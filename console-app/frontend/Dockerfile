# Build from repo root (consistent with the backend image):
#   nerdctl --namespace k8s.io build -f console-app/frontend/Dockerfile -t console-app-frontend:local .

FROM node:20-alpine AS build
WORKDIR /src
COPY console-app/frontend/package.json console-app/frontend/package-lock.json* ./
RUN npm install
COPY console-app/frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
# Defaults match the local Docker Compose service name/port; Azure
# overrides BACKEND_HOST via the Container App's env vars (see
# infra/provision.sh) to the backend Container App's internal FQDN.
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=8000
COPY console-app/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY console-app/frontend/docker-entrypoint.d/05-set-resolver.envsh /docker-entrypoint.d/05-set-resolver.envsh
RUN chmod +x /docker-entrypoint.d/05-set-resolver.envsh
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
