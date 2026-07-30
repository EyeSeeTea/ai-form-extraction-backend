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

curl -X POST \
  -H "Authorization: ApiToken $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example item created from curl"
  }' \
  http://localhost:3000/api/example-items
```

Jobs:

```sh
curl -X POST \
  -H "Authorization: ApiToken $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "count_example_items",
    "input": {
      "sleepMs": 1000
    }
  }' \
  http://localhost:3000/api/jobs

curl -H "Authorization: ApiToken $AUTH_TOKEN" \
  http://localhost:3000/api/jobs/<job-id>
```

The generic `POST /api/jobs` endpoint exists for JSON jobs that are registered as public job types.

Requests under `/api` are rate limited by default. The limit is configured with
`RATE_LIMIT_MAX` and `RATE_LIMIT_TIME_WINDOW_MS`.

Uploaded file storage is controlled by `UPLOADS_DIR`, `UPLOAD_MAX_FILES`, `UPLOAD_MAX_FILE_SIZE_BYTES`, and `UPLOAD_RETENTION_MS`. Cleanup is planned for a later iteration.

## Form Extraction

Form extraction jobs are asynchronous. Create a job, then poll `GET /api/jobs/<job-id>` until the job is `succeeded` or `failed`.

There are two extraction entrypoints:

- `POST /api/jobs/extract-form` creates a caller-defined generic extraction job from JSON.
- `POST /api/jobs/extract-form/:formType` creates a curated form-specific extraction job from multipart uploads.

Set `LLM_PROVIDER=openrouter` to enable real extraction requests. The required OpenRouter settings are:

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`, default `https://openrouter.ai/api/v1`
- `OPENROUTER_MODEL`, default `qwen/qwen3-vl-32b-instruct`

Extraction jobs prepare uploaded files before calling the LLM:

- JPEG uploads are passed through as ordered page images.
- PDF uploads are rendered page-by-page with `pdf-to-img`.
- `PDF_MAX_PAGES` limits the source PDF page count. Default: `20`.
- `PDF_MAX_EXTRACTED_IMAGES` limits how many rendered page images are produced. Default: `20`.

Missing mapped-result fields are warning-only for now. The job still succeeds, and the warnings are reported in `diagnostics.warnings` together with `diagnostics.quality`.

When requested, extraction results add a sibling `fieldConfidence` map to `result`. The map uses
JSON Pointer paths (for example, `/household/members/0/name`) for scalar values, including
schema-valid explicit `null` values. Unextracted fields are absent from both `result` and
`fieldConfidence`. An extracted field without a valid model score is retained in `result`, omitted
from `fieldConfidence`, and reported as an `Unscored field` warning.

Scores are finite model-reported values from `0` through `1`. They are prioritisation signals, not
calibrated correctness probabilities. Clients own the review threshold and review policy; this
release does not provide calibration, backend routing, or review evidence such as page locations or
source excerpts.

### Generic Extraction

Use the generic endpoint when the caller provides the form label, extraction instructions, files, and desired output JSON schema. The `form` value is only a label. The optional `profile` currently defaults to `default`; non-default profiles are reserved for future use. Set `confidence` to `true` to request field-confidence metadata. It defaults to `false`, so generic results omit `fieldConfidence` and confidence-related warnings unless requested.

Request body:

```json
{
  "form": "semi-annual-report",
  "confidence": true,
  "profile": "default",
  "inputFiles": [
    {
      "contents": "<base64-pdf-or-jpeg>",
      "mimeType": "application/pdf",
      "filename": "report.pdf"
    }
  ],
  "prompt": "Extract the report fields using the mapping rules provided by the caller.",
  "outputSchema": {
    "type": "object",
    "required": ["country"],
    "properties": {
      "country": { "type": "string" }
    }
  }
}
```

Example using `jq`, `base64`, a prompt file, and a schema file:

```sh
jq -n \
  --arg form "semi-annual-report" \
  --argjson confidence true \
  --arg profile "default" \
  --arg filename "report.pdf" \
  --arg mimeType "application/pdf" \
  --rawfile prompt ./prompt.txt \
  --rawfile contents <(base64 < ./report.pdf | tr -d '\n') \
  --slurpfile outputSchema ./schema.json \
  '{
    form: $form,
    confidence: $confidence,
    profile: $profile,
    inputFiles: [
      {
        contents: $contents,
        mimeType: $mimeType,
        filename: $filename
      }
    ],
    prompt: $prompt,
    outputSchema: $outputSchema[0]
  }' \
  | curl -X POST \
      -H "Authorization: ApiToken $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      --data-binary @- \
      http://localhost:3000/api/jobs/extract-form
```

Succeeded generic extraction jobs return:

```json
{
  "status": "succeeded",
  "result": {
    "form": "semi-annual-report",
    "profile": "default",
    "result": {
      "country": "Kenya"
    },
    "fieldConfidence": {
      "/country": 0.92
    },
    "diagnostics": {
      "providerName": "openrouter",
      "model": "qwen/qwen3-vl-32b-instruct",
      "profile": "default",
      "warnings": [],
      "quality": {
        "missingFieldCount": 0,
        "invalidFieldCount": 0,
        "schemaCoverage": 1
      }
    }
  }
}
```

### Form-Specific Extraction

Use the form-specific endpoint for curated forms registered by the backend. The current curated form is `end-of-season`.

Example with one PDF:

```sh
curl -X POST \
  -H "Authorization: ApiToken $AUTH_TOKEN" \
  -F 'files=@./end-of-season.pdf;type=application/pdf' \
  http://localhost:3000/api/jobs/extract-form/end-of-season
```

Example with ordered JPEG pages:

```sh
curl -X POST \
  -H "Authorization: ApiToken $AUTH_TOKEN" \
  -F 'files=@./page-001.jpg;type=image/jpeg' \
  -F 'files=@./page-002.jpg;type=image/jpeg' \
  http://localhost:3000/api/jobs/extract-form/end-of-season
```

Succeeded `extract_form` jobs return a payload shaped like:

```json
{
  "status": "succeeded",
  "result": {
    "formType": "end-of-season",
    "result": {},
    "fieldConfidence": {},
    "diagnostics": {
      "providerName": "openrouter",
      "model": "qwen/qwen3-vl-32b-instruct",
      "warnings": [],
      "quality": {
        "missingFieldCount": 0,
        "invalidFieldCount": 0,
        "schemaCoverage": 1
      }
    }
  }
}
```

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
