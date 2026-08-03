FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
COPY database database
RUN npm run build --workspace @relayops/api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S relayops && adduser -S relayops -G relayops
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace @relayops/api && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY database database
USER relayops
EXPOSE 8080
CMD ["node", "apps/api/dist/server.js"]
