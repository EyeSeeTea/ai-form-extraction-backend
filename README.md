# DHIS2 App Backend Skeleton

Fastify + strict TypeScript backend skeleton for DHIS2 apps that call backend endpoints through the DHIS2 Routes feature.

## Stack

- Fastify for HTTP APIs.
- Pino for structured logging. This matches Fastify's native logger and is suitable for containerized production logs.
- OpenTelemetry SDK and auto-instrumentation hooks for traces.
- Drizzle ORM with SQLite via `better-sqlite3` and Drizzle migrations.
- Vitest for unit/integration tests.
- ESLint flat config and Prettier for linting/formatting.
- Dockerfile and Docker Compose with an `app` service and persisted SQLite storage.

## Clean Architecture Layout

```text
src
  domain
    entities
    repositories
    usecases
  data
    database
    repositories
  api
    plugins
    routes
  config
  observability
  shared
  CompositionRoot.ts
  Main.ts
```

The EyeSeeTea frontend `webapp` presentation layer is adapted to `api` because this backend exposes HTTP routes. The dependency rule stays the same: domain does not import infrastructure or presentation code, data implements domain repository interfaces, and `CompositionRoot.ts` wires concrete implementations to use cases.

## Naming Conventions

- Folders are `kebab-case` where names contain multiple words.
- Files are `PascalCase`.
- Repositories and use cases include their type as a suffix.
- Use cases expose `constructor(...dependencies).execute(...parameters)`.
- Data repositories follow `{Interface}{Implementation}Repository`, for example `HealthDatabaseRepository`.

## Local Development

```sh
corepack enable
yarn install --immutable
cp .env.example .env
yarn db:generate
yarn db:migrate
yarn dev
```

Health endpoints:

```sh
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
```

Example endpoint:

```sh
curl http://localhost:3000/api/example-items
```

## API Documentation

OpenAPI (Swagger) docs are auto-generated from Zod schemas and served at:

- **Swagger UI:** [http://localhost:3000/docs](http://localhost:3000/docs)
- **OpenAPI JSON:** [http://localhost:3000/docs/json](http://localhost:3000/docs/json)

## Docker

Build the production image directly:

```sh
docker build -t dhis2-app-backend-skeleton .
```

Run the app with Docker Compose:

```sh
docker compose up --build
```

Compose builds one runtime image and reuses it for both the one-off `migrate` service and the app container. The image includes the Drizzle config and schema files so `yarn db:migrate` can run inside the container before the app starts.

If you want to inspect or reset the SQLite file, the data lives in the `sqlite-data` named volume declared in `docker-compose.yml`.

## Scripts

```sh
yarn build
yarn typecheck
yarn lint
yarn format
yarn test
yarn db:generate
yarn db:migrate
yarn db:studio
```

## Observability

Production logs are JSON written to stdout. Development logs are pretty-printed.

Set `OTEL_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT` to export traces to an OTLP HTTP collector.
