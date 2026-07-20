# Repository Guidelines

## Project Structure & Module Organization

This is a strict TypeScript Fastify backend for AI-assisted form value extraction using Clean Architecture. Source code lives in `src/`:

- `src/domain/`: entities, repository contracts, and use cases. Keep this layer free of API, database, or framework imports.
- `src/data/`: Drizzle database setup and repository implementations.
- `src/api/`: Fastify server, routes, middleware, plugins, serializers, and Zod/OpenAPI schemas.
- `src/config/`, `src/observability/`, `src/shared/`: environment loading, telemetry, and shared utilities.
- `test/integration/`: API and middleware integration tests. Unit tests are colocated in `__tests__/` folders under `src/domain/`.
- `drizzle/`: generated migrations and metadata. Do not hand-edit generated migration metadata.

## Build, Test, and Development Commands

Use nvm for node versioning: `nvm use`

- `corepack enable && yarn install --immutable`: install dependencies exactly from `yarn.lock`.
- `cp .env.example .env`: create local configuration.
- `yarn dev`: run the API with `tsx --watch`.
- `yarn build`: compile production output to `dist/`.
- `yarn start`: run the compiled server from `dist/src/Main.js`.
- `yarn run check`: run typecheck, lint, format check, and tests.
- `yarn db:generate`, `yarn db:migrate`, `yarn db:studio`: manage Drizzle schema, migrations, and inspection UI.

## Development

- Whenever you add a new API route, also add the corresponding request/response schema in `src/api/schemas/` and wire it into the route `schema` block so validation and Swagger stay in sync.

## Coding Style & Naming Conventions

Follow the existing ESLint flat config and Prettier formatting. Run `yarn lint:fix` and `yarn format:fix` before large changes when practical. TypeScript files use `PascalCase` names, while multi-word folders use `kebab-case`. Repository and use case classes include their role as a suffix, for example `HealthDatabaseRepository` or `GetHealthUseCase`. Use cases should expose `constructor(...dependencies).execute(...parameters)`.

- For object types intended to be immutable, prefer TypeScript's `Readonly<{ ... }>` utility type. Do not duplicate it with inline `readonly` property modifiers unless a type intentionally mixes mutable and immutable properties.
- Avoid broad `try/catch` blocks. Scope exception handling to the operation expected to throw, and use boundary-level handlers only when intentionally catching failures from an entire operation or request.

- When logging exceptions with pino, use the `err` key or pass the error as the logger error argument, and normalize non-`Error` throwables first. Do not log exceptions under a plain `error` key, because stack traces and messages may be omitted.

## Testing Guidelines

Vitest is the test runner. Name tests `*.test.ts`. Keep domain unit tests near the code in `__tests__/`; put route, middleware, and server behavior tests in `test/integration/`. Use `yarn test` for the full suite, `yarn test:watch` while developing, and `yarn test:coverage` when coverage output is needed.

## Commit Guidelines

- Follow Conventional Commit style: `feat: ...`, `fix: ...`, `refactor(scope): ...`, `test: ...`. 
- Keep commit messages imperative and scoped when useful. 
- Include multiline messages with change details.
- If any public api surface changes include it in the details

## Security & Configuration Tips

Keep secrets in `.env`, never in source. `AUTH_TOKEN` protects example routes with `Authorization: ApiToken ...`. For DHIS2 route-backed deployments, review allowed remote server settings and OpenTelemetry variables before promoting configuration.
