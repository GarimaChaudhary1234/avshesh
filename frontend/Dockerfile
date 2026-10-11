FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# Rendered to /etc/nginx/conf.d/default.conf at start-up with BACKEND_URL / BACKEND_HOST (defaults: the compose backend).
ENV BACKEND_URL=http://backend:8080 BACKEND_HOST=backend TRUST_PROXY_CIDR=127.0.0.1
COPY templates/default.conf.template /etc/nginx/templates/default.conf.template
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
