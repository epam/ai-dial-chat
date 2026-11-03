## Why

`apps/chat-api/src/config/environment.config.ts` is 1321 lines, and `EnvironmentVariables` is one class with 181 env vars. That class is the most-edited backend file: 33 commits in the last 60 days. It is item B6 (P2) of the 2026-10-26 refactoring audit.

Almost every backend feature adds a var to it, and they all add at the bottom of one class, so parallel branches conflict there constantly. A reader looking for the scheduler's settings has to scroll past 76 `AUTH_*` declarations. Nothing groups a domain's vars, its decorators and its parse helpers (the celebration list parser, for example) together.

## What Changes

- **New folder `apps/chat-api/src/config/env/`** with one class per domain. Each class carries its vars' existing decorators, initializers and JSDoc unchanged. The 181 vars are grouped mostly by prefix:
  - `server.env.ts`: HTTP server, CORS, CSP and logging.
  - `dial.env.ts`: DIAL Core connection, themes and the MCP app sandbox.
  - `auth.env.ts`: session, cookies, roles and header-token auth.
  - `auth-providers.env.ts`: `AUTH_<PROVIDER>_*` for the 9 IdPs.
  - `files.env.ts`: file upload and transfer, archive download and upload, publish attachments, skill uploads.
  - `generation.env.ts`: models, utility prompts, naming, transcription and generation timeouts.
  - `client-ui.env.ts`: values sent to the client, such as announcements, deployment defaults, visualizers, overlay, file-manager tabs and UI features.
  - `celebrations.env.ts`: `UI_EVENT_*` and its private list parser and patterns.
  - `feature-flags.env.ts`: `*_ENABLED` and `*_ENABLED_ROLES` gates, usage limits.
  - `integrations.env.ts`: scheduler, custom Core API and project context limits.

  The exact var-to-file table is in design.md.
- **`environment.config.ts` stays as the composition root.** It exports `EnvironmentVariables` composed with `IntersectionType(...)` from `@nestjs/swagger`, which is already a `chat-api` dependency. Its other exports (`ApplicationLogLevel`, `IFRAME_ORIGIN_PATTERN`) are re-exported from the domain file that now holds them.
  - Every one of the 108 importers keeps `import { EnvironmentVariables } from '…/config/environment.config'` and `ConfigService<EnvironmentVariables>`.
  - `validation.ts` is unchanged.
  - The 25 specs that cite `apps/chat-api/src/config/environment.config.ts` still resolve.
- **A new `config/tests/environment-composition.spec.ts`** pins the composition:
  - the composed class declares exactly the 181 var names, from a snapshot list in the spec;
  - no var is declared in two domain classes;
  - implicit conversion still turns a numeric string such as `PORT` into a number, and a list string into an array;
  - initializer defaults such as `PORT = 5000` survive.
- **Docs:** `apps/chat-api/AGENTS.md` and `.claude/rules/nestjs-best-practices.md` now tell contributors to add a new var to its domain class under `config/env/`, or to a new domain file wired into the root. `docs/architecture.md`'s `config/` line names the folder.

There are no runtime changes: the same var names, validation rules, defaults, transforms, error messages, `validate()` output and `ConfigService` typing.

### Non-goals

- Renaming, adding, removing or re-defaulting any env var. `.env.template` and the README's var tables do not change.
- Changing `validation.ts`'s cross-var checks: the callback-URL fallbacks and the project-context bounds.
- Typing `ConfigService` per domain, such as `ConfigService<FilesEnv>`. A follow-up can narrow injections once the classes exist.
- Editing the 25 specs. They describe the composed `EnvironmentVariables`, which still declares every var.

### Acceptance criteria

- `environment.config.ts` is under 80 lines and holds no `@Is*` decorator. No file under `config/env/` exceeds about 350 lines.
- The composition spec passes. So do the existing `config/validation.spec.ts`, `config/tests/*.spec.ts` and every `chat-api` test.
- `npm exec nx run-many -t test lint build typecheck -p chat-api` passes. The module wiring specs that build the real config, such as `feature-guard-module.spec.ts`, also pass.
- `npm run openapi:check` reports no diff, and `npm run validate:specs` and `npm run validate:docs` pass.

### Alternatives considered

1. **Leave the file and add section comments** (baseline). It costs nothing, but every branch still edits one class and nothing stops new vars from landing in the wrong section. Rejected: it does not reduce conflicts.
2. **Domain classes composed with `IntersectionType`, keeping the root file and the type name** (chosen). Nest's mapped-types copy class-validator and class-transformer metadata, property initializers and `design:type`, which `enableImplicitConversion` needs. The `design:type` copy is confirmed in `@nestjs/mapped-types` `inheritValidationMetadata`, and the composition spec proves it end to end. No importer changes.
3. **An inheritance chain** (`class EnvironmentVariables extends AuthEnv`, `AuthEnv extends FilesEnv`, …). This works without helpers, but it couples unrelated domains in an arbitrary order, and a conflict on the chain line replaces the conflict on the class. Rejected.
4. **Separate `registerAs` config namespaces per domain.** This is the idiomatic Nest pattern, but it changes every `configService.get('X')` call site to a namespaced read. Rejected as far beyond a structural split.

### Rollback

No behavior changes. Reverting the commit restores the single class. No importer, deployment or env change is needed either way.

## Capabilities

### New Capabilities

- `chat-api-environment-config`: how `chat-api` declares and composes its env schema: domain classes under `config/env/`, one root `EnvironmentVariables`, and the parity guard.

### Modified Capabilities

None. Existing specs describe individual vars on `EnvironmentVariables`, which still declares every one of them.

## Impact

- **Code:**
  - `apps/chat-api/src/config/environment.config.ts` is rewritten as the root.
  - 10 new files go under `apps/chat-api/src/config/env/`.
- **Tests:** new `apps/chat-api/src/config/tests/environment-composition.spec.ts`. Existing config specs are unchanged.
- **Docs:** `apps/chat-api/AGENTS.md`, `.claude/rules/nestjs-best-practices.md` and `docs/architecture.md` (the `config/` tree line).
- **Unaffected:**
  - the 108 importers of `EnvironmentVariables` and `validation.ts`;
  - `.env.template`, the README var tables and Helm/deploy config;
  - OpenAPI and the frontend;
  - i18n, RTL, a11y and telemetry. There is no UI and no new string.
