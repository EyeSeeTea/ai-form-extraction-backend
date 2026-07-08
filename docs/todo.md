# TODO Plan

This document tracks follow-up work that is intentionally deferred.

## Conventions

- `status`: `todo` or `done`
- Add new items under the most relevant section
- Keep each item scoped to one concrete follow-up

## Upload Architecture

### UA-001 Domain Error Boundary

- `status`: `todo`
- `summary`: Move upload/domain validation errors out of `src/shared/ValidationError.ts`.
- `context`: Domain upload code and use cases currently depend on a shared error type instead of a domain-owned error abstraction.
- `next`: Introduce a domain-level validation error or throw plain domain errors and map them to HTTP errors at the API boundary.

### UA-002 Storage Key Boundary

- `status`: `todo`
- `summary`: Revisit whether `storageKey` should remain part of the domain upload model.
- `context`: `storageKey` is a storage-shaped concept that currently crosses the domain and form-extraction service boundaries.
- `next`: Decide whether `storageKey` is an acceptable opaque locator in the domain, or replace it with a more storage-agnostic document reference.

### UA-003 Extract Job Input Serialization

- `status`: `todo`
- `summary`: Evaluate whether extract-form job input serialization should expose source file information.
- `context`: `diagnostics.source` was removed from extract-form job results, so source provenance may need to be exposed from the serialized job input instead.
- `next`: Decide whether `GET /jobs/:id` should include extract-form input file metadata such as `storageKey` and related source document fields.

### UA-004 Multipart Buffering Limits

- `status`: `todo`
- `summary`: Keep multipart upload limits conservative while extract-form still buffers files in memory.
- `context`: `POST /api/jobs/extract-form` uses `attachFieldsToBody: true`, so uploaded files are materialized in heap before validation and persistence.
- `next`: Lower and document safe `UPLOAD_MAX_FILES` and `UPLOAD_MAX_FILE_SIZE_BYTES` values, and revisit a streaming upload path if larger budgets are required.

## Extraction Jobs

### EJ-001 Poppler Rendering Evaluation

- `status`: `todo`
- `summary`: Keep Poppler deferred unless `pdf-to-img` rendering proves insufficient.
- `context`: Extraction jobs now render PDF pages with `pdf-to-img` in-process. That keeps deployment simple, but Poppler or another native renderer may still be worth evaluating if fidelity, performance, or malformed-PDF handling becomes a problem in production.
- `next`: Revisit native rendering only with representative failing PDFs or measured performance problems; if adopted, document binary/runtime requirements explicitly.

### EJ-002 Missing Field Warning Policy

- `status`: `todo`
- `summary`: Review whether all missing LLM-extracted schema fields should remain warning-only.
- `context`: The current plan treats missing fields as warnings so incomplete model output does not fail the job. Some fields may later prove mandatory for downstream DTO creation or user workflows.
- `next`: After validating real extraction outputs, define per-form field policy for warning-only fields, critical missing fields, and invalid field handling.

### EJ-003 OpenRouter Runtime Tuning Configuration

- `status`: `todo`
- `summary`: Decide whether OpenRouter metadata, generation tuning, and timeout settings should be configurable.
- `context`: The first OpenRouter implementation should stay small and only require provider selection, API key, base URL, model, and PDF limits. Optional site/app headers, request timeout, max output tokens, temperature, and extract-form job timeout can be added after the first end-to-end path is stable.
- `next`: Revisit `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`, `LLM_REQUEST_TIMEOUT_MS`, `LLM_MAX_OUTPUT_TOKENS`, `LLM_TEMPERATURE`, and `EXTRACT_FORM_JOB_TIMEOUT_MS`; define defaults, validation rules, and tests if they are needed operationally.

### EJ-004 Vision Model Capability Guardrails

- `status`: `todo`
- `summary`: Add explicit capability checks or operator-facing documentation for vision-capable model selection.
- `context`: The extraction plan assumes the configured OpenRouter model accepts image inputs, but that requirement is easy to violate if the model name changes later.
- `next`: Decide whether to enforce this at startup/runtime validation or document a strict allowlist/selection rule in `.env.example` and extraction docs.

### EJ-005 LLM Image Payload Limits

- `status`: `todo`
- `summary`: Bound image count and total encoded payload size before calling the LLM provider.
- `context`: The extraction plan sends ordered images as base64 data URLs, but there is no deferred safeguard yet for excessive page counts or oversized request bodies.
- `next`: Define `extract_form` limits for image count and total base64 payload bytes, then fail early with a clear non-retryable error when exceeded.

### EJ-006 Prepared Image Size Reduction

- `status`: `todo`
- `summary`: Evaluate downscaling or compression before LLM submission for oversized images.
- `context`: Large extracted or uploaded images can increase latency and token/cost usage even when the form remains visually readable at lower resolution.
- `next`: Measure representative form image sizes and decide whether preprocessing should be automatic, configurable, or deferred unless payload limits are hit.

### EJ-007 Human Review Workflow Hooks

- `status`: `todo`
- `summary`: Add early quality-review hooks if extraction results will be verified by people.
- `context`: The extraction plan already anticipates diagnostics and future quality tracking, but it does not yet define the minimal metadata or state transitions needed for a review queue.
- `next`: If human verification is in scope, define the smallest review-oriented contract now, such as review status, correction capture points, and linkage to extraction diagnostics.

### EJ-008 Prompt Version Diagnostics

- `status`: `todo`
- `summary`: Include prompt or extraction-template version identifiers in diagnostics.
- `context`: Result quality will be difficult to compare over time if prompt changes are not traceable alongside provider/model metadata.
- `next`: Add a stable prompt/version identifier to extraction diagnostics and structured logs without persisting full prompts by default.

### EJ-009 Provider Fallback Strategy

- `status`: `todo`
- `summary`: Revisit multi-provider fallback only after the single-provider OpenRouter path is stable.
- `context`: The extraction plan intentionally starts with one provider, but model unavailability could later justify routing to another configured provider.
- `next`: After basic behavior is stable, define which provider failures qualify for fallback, how routing remains observable, and how to avoid masking persistent prompt or schema issues.

### EJ-010 Extraction Service Factory Lifetime

- `status`: `todo`
- `summary`: Revisit whether form extraction services should be cached per provider/model instead of instantiated per extraction.
- `context`: Slice 3 introduced a profile-aware factory that currently constructs a fresh extraction service on each use-case execution. That keeps profile selection explicit, but it may give up reusable provider client state under worker or eval load.
- `next`: Decide whether the factory should memoize services by provider/model, and add tests that pin the intended lifetime behavior.

### EJ-011 Shared JSON Type Location

- `status`: `done`
- `summary`: Extract `JsonPrimitive`/`JsonArray`/`JsonObject`/`JsonValue` from `src/domain/entities/Job.ts` into a shared type module.
- `context`: These JSON types started as job-adjacent, but they are now used across forms, extraction, repositories, runtime job execution, and tests. Keeping them under the `Job` entity couples unrelated code to a job-specific file.
- `next`: Completed in `src/domain/entities/generic/Json.ts`; imports were updated so `Job.ts` now keeps only job-specific types.

### EJ-012 Generic Extraction Access Control

- `status`: `todo`
- `summary`: Revisit whether generic extraction should require a feature flag or separate authorization rule.
- `context`: The planned `POST /api/jobs/extract-form` JSON endpoint is enabled by default and uses the same authentication as other authenticated endpoints, but it accepts arbitrary extraction instructions and output schemas.
- `next`: After initial usage is understood, decide whether to add a deployment feature flag, role-based authorization, stricter prompt/schema policies, or tenant-specific limits.

### EJ-013 Extraction Profile Source Expansion

- `status`: `todo`
- `summary`: Support multiple extraction profiles beyond the current static `default` profile.
- `context`: The extraction profile repository abstraction now exists, but profile identifiers are still constrained to a static `"default"` value across domain types, request schemas, and job input validation. That is consistent for the current scope, but it prevents adding alternate static profiles or a future database-backed repository without another cross-cutting refactor.
- `next`: Decide how profile identifiers should evolve, including whether to support a richer static profile catalog first, a dynamic DB-backed repository later, or both; then widen the profile type/schema boundaries and add tests for multi-profile selection.

## Notes

- Add future follow-up items here as new review findings or deferred refactors appear.
