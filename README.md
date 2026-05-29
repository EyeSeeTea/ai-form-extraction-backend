# DHIS2 App Backend Skeleton

Fastify + strict TypeScript backend skeleton for DHIS2 apps that call backend endpoints through the DHIS2 Routes feature.

## Stack

- Fastify for HTTP APIs.
- Pino for structured logging. This matches Fastify's native logger and is suitable for containerized production logs.
- OpenTelemetry SDK and auto-instrumentation hooks for traces.
- Drizzle ORM with PostgreSQL and Drizzle migrations.
- Vitest for unit/integration tests.
- ESLint flat config and Prettier for linting/formatting.
- Dockerfile and Docker Compose with `app` and `db` services.

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
docker compose up -d db
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
