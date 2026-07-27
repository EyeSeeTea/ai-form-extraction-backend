# AI Form Extraction Backend

Fastify + strict TypeScript backend for AI-assisted form value extraction, exposed through HTTP endpoints and compatible with DHIS2 route-backed deployments.

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

`yarn dev` runs the TypeScript entrypoint directly with `tsx --watch`, so it is
the command to use during development. It reloads on file changes and does not
require a prior build.

`yarn start` runs the compiled output from `dist/src/Main.js`. Use it for
production-like local runs, after building the project first:

```sh
yarn build
yarn start
```

Health endpoints:

```sh
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
```

Example endpoint:

```sh
curl -H "Authorization: ApiToken $AUTH_TOKEN" http://localhost:3000/api/example-items
```

Requests under `/api` are rate limited by default. The limit is configured with
`RATE_LIMIT_MAX` and `RATE_LIMIT_TIME_WINDOW_MS`.

## API Documentation

OpenAPI (Swagger) docs are auto-generated from Zod schemas and served at:

- **Swagger UI:** [http://localhost:3000/docs](http://localhost:3000/docs)
- **OpenAPI JSON:** [http://localhost:3000/docs/json](http://localhost:3000/docs/json)

## DHIS2 Routes

This API is intended to be called from DHIS2 Routes, using `ApiToken` authentication.

Example route configuration:

```sh
curl -X POST \
  -H "Content-Type: application/json" \
  -u "system:System123" \
  -d '{
    "name": "backend",
    "code": "backend",
    "url": "http://172.17.0.1:3000/**",
    "auth": {
      "type": "api-token",
      "token": "test"
    }
  }' \
  "http://localhost:8080/api/routes"
```

Depending on the DHIS2 version, you may also need to allow the backend origin in `dhis.conf`:

```properties
route.remote_servers_allowed = http://172.17.0.1:3000
```

Some versions may require a broader value such as:

```properties
route.remote_servers_allowed = http://*
```

## Docker

Build the production image directly:

```sh
docker build -t ai-form-extraction-backend .
```

Run the app with Docker Compose:

```sh
cp .env.example .env
# Edit .env and set AUTH_TOKEN before starting the containers.
docker compose up --build
```

Compose reads shared settings such as `AUTH_TOKEN` from the ignored `.env` file and overrides container-specific production settings in `docker-compose.yml`. Compose builds one runtime image and reuses it for both the one-off `migrate` service and the app container. The image includes the Drizzle config and schema files so `yarn db:migrate` can run inside the container before the app starts.

If you want to inspect or reset the SQLite file, the data lives in the `sqlite-data` named volume declared in `docker-compose.yml`.

## Scripts

```sh
yarn dev
yarn build
yarn start
yarn typecheck
yarn lint
yarn lint:fix
yarn format
yarn format:fix
yarn test
yarn test:watch
yarn test:coverage
yarn check
yarn db:generate
yarn db:migrate
yarn db:studio
```

## Dependency Maintenance

This project uses Yarn 4. For dependency maintenance, use the built-in Yarn
commands:

```sh
# Review outdated packages in an interactive UI
yarn upgrade-interactive
# Upgrade dependencies interactively
yarn up -i
# Upgrade dependencies across the project
yarn up
# Run an npm vulnerability audit
yarn npm audit
```

## Observability

Production logs are JSON written to stdout. Development logs are pretty-printed.

Set `OTEL_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT` to export traces to an OTLP HTTP collector.
