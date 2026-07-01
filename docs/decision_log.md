# Decision Log

## 1 better-sqlite3 over node:sqlite

- Main decision: Use stable `better-sqlite3` with Drizzle's SQLite support instead of `node:sqlite`.
- Motivation/explanation: It works on stable releases, keeps the runtime simple, and integrates cleanly with Yarn and Docker without a special allowlist.

## 2 .yarnrc.yml `enableScripts: true`

- Main decision: Keep Yarn lifecycle scripts enabled so the native module builds normally during install.
- Motivation/explanation: `better-sqlite3` needs a native build step, and the repo is simpler when Yarn handles that automatically.

## 3 In-process async job worker

- Main decision: Run the async job worker in the API server process for the first implementation.
- Motivation/explanation: This keeps deployment simple for the current DHIS2 route-backed backend skeleton. Jobs are persisted in SQLite, claimed with a worker-specific lease, and stale running jobs can be recovered after process crashes or restarts.
- Current assumptions:
  - The service runs as a single API instance, or duplicate-safe job leases are sufficient for the deployment.
  - Job volume is low enough that worker polling and execution do not materially affect API latency.
  - Job execution is mostly I/O-bound or otherwise safe to run in the same Node.js event loop as API request handling.
  - SQLite remains the source of truth for the queue, job status, and retry state.
  - Restarting or redeploying the API may temporarily pause job processing, and that is acceptable.
- Operational safeguards:
  - The worker starts only after the HTTP server has successfully bound.
  - Shutdown stops the worker before closing shared infrastructure such as the database client.
  - Failed or crashed jobs rely on lease recovery before they can be retried.
- Revisit this decision when:
  - The API runs multiple replicas and independent worker scaling becomes necessary.
  - Jobs become CPU-heavy, memory-heavy, long-running, or likely to block request handling.
  - Job processing requires separate operational controls, observability, deployment cadence, or service-level objectives.
  - The system needs a dedicated worker entrypoint, for example `src/WorkerMain.ts`, or separate API/worker container roles.

## 4 `src/infrastructure/` for outer adapters

- Main decision: Place provider-specific adapters in `src/infrastructure/` rather than mixing them into `src/data/`.
- Motivation/explanation: The new form extraction flow needs a clear outer layer for provider-agnostic LLM adapters. Keeping those adapters separate from persistence code preserves the Clean Architecture dependency direction and makes future provider swaps less invasive.
- Revisit this decision when:
  - The project settles on a different outer-layer naming convention.
  - Adapter count stays trivial enough that the extra folder adds no practical value.
