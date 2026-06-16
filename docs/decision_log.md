# Decision Log

## 1 better-sqlite3 over node:sqlite

- Main decision: Use stable `better-sqlite3` with Drizzle's SQLite support instead of `node:sqlite`.
- Motivation/explanation: It works on stable releases, keeps the runtime simple, and integrates cleanly with Yarn and Docker without a special allowlist.

## 2 .yarnrc.yml `enableScripts: true`

- Main decision: Keep Yarn lifecycle scripts enabled so the native module builds normally during install.
- Motivation/explanation: `better-sqlite3` needs a native build step, and the repo is simpler when Yarn handles that automatically.
