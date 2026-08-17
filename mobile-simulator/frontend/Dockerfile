# Build context is this directory (self-contained, no sibling folders needed):
#   docker build -f mobile-simulator/frontend/Dockerfile -t mobile-frontend:local mobile-simulator/frontend

FROM node:20-alpine AS build
WORKDIR /src
COPY package.json package-lock.json* ./
RUN npm install
COPY . ./
RUN npm run build

FROM nginx:1.27-alpine
ENV BACKEND_HOST=mobile-backend
ENV BACKEND_PORT=8000
ENV BACKEND_SCHEME=http
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/05-set-resolver.envsh /docker-entrypoint.d/05-set-resolver.envsh
RUN chmod +x /docker-entrypoint.d/05-set-resolver.envsh
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
