FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
COPY . .
RUN npm ci
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/app/.output ./app/.output
COPY --from=build /app/admin/.output ./admin/.output
COPY --from=build /app/api/.output ./api/.output
COPY --from=build /app/scripts/run-applications.mjs ./scripts/run-applications.mjs
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/app/package.json ./app/package.json
COPY --from=build /app/admin/package.json ./admin/package.json
COPY --from=build /app/api/package.json ./api/package.json
EXPOSE 3000
CMD ["node", "scripts/run-applications.mjs", "start"]
