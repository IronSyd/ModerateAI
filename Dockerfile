# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
ARG VITE_SUPPORT_TELEGRAM_URL
ARG VITE_DOCS_BASE_URL
ARG VITE_DISCORD_CLIENT_ID
ENV VITE_SUPPORT_TELEGRAM_URL=$VITE_SUPPORT_TELEGRAM_URL
ENV VITE_DOCS_BASE_URL=$VITE_DOCS_BASE_URL
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID
COPY . .
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.js"]
