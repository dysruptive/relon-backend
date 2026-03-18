FROM node:24-alpine

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY . .

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

RUN npm run prisma:generate && npm run build

EXPOSE 4000

CMD node scripts/fix-migrations.js && npm run prisma:deploy && node dist/main.js
