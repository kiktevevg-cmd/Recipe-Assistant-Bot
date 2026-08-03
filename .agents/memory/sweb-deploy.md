---
name: sweb.ru deployment
description: How the bot is deployed to sweb.ru and why a standalone folder exists
---
- sweb.ru app hosting uses its own generic Node builder — it ignores our Dockerfile and copies only package.json + lockfile (no pnpm-workspace.yaml), so pnpm monorepo with catalogs fails with LOCKFILE_CONFIG_MISMATCH.
- **Fix:** `standalone/` folder at repo root holds a flat deployable copy: prebuilt esbuild bundle from `artifacts/api-server/dist` + minimal package.json (deps: grammy, openai — esbuild externals) + package-lock.json. User points sweb.ru app root to `standalone`, start `npm start`.
- **How to apply:** after any bot code change, rebuild api-server, re-copy dist into `standalone/dist`, `git add -f` (dist is gitignored) and push, or the deployed bot stays stale.
