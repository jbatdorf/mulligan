---
name: feedback_env_loading
description: Always use dotenv-cli for env loading in dev scripts, consistent with the rest of the monorepo
metadata:
  type: feedback
---

Use `dotenv -e <path>.env <command>` for dev scripts that need env vars. This is the established pattern across all packages in this monorepo (e.g. `packages/db`).

**Why:** User called this out explicitly when I tried NODE_OPTIONS and --env-file alternatives. dotenv-cli is already a dep in the monorepo and is the consistent pattern.

**How to apply:** Any new package or service that needs env vars in its dev/run scripts should use `dotenv -e ../../.env <command>` (adjusting relative path as needed). Do not use NODE_OPTIONS, --env-file, or programmatic dotenv loading.
