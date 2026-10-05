## Context

`apps/chat-api` and `apps/mcp-app-sandbox` are both on NestJS 11 (`^11.0.0` across
`@nestjs/common`/`@nestjs/core`/`@nestjs/platform-express`, plus `@nestjs/config` `^4.0.4`,
`@nestjs/swagger` `^11.4.1`, `@nestjs/cache-manager` `^3.1.2`, `@nestjs/serve-static` `^5.0.5`,
`@nestjs/schematics` `^11.0.0`). NestJS 12 (`12.0.3`) is now `latest`; v11 moved to `legacy`.
Full scope and the upstream checklist live in
[epam/ai-dial-chat#8904](https://github.com/epam/ai-dial-chat/issues/8904), which mirrors
NestJS's own [migration guide](https://docs.nestjs.com/migration-guide).

Both apps are built through `@nx/webpack`'s `NxAppWebpackPlugin` with `compiler: 'tsc'`,
producing a CommonJS bundle — neither app goes through the Nest CLI's own build/serve path, so
the CLI's `--webpack`/Rspack-default deprecation does not apply here. `apps/chat-api/main.ts`
boots via `NestFactory.create` with a custom `NestOtelLogger` (extends `ConsoleLogger`),
`ValidationPipe`, URI versioning, Helmet, and Swagger; `apps/chat-api/webpack.shared.js`
declares `NESTJS_RESOLVE_ALIASES` for dynamic-require Nest submodules
(`@nestjs/websockets/socket-module`, `@nestjs/microservices*`, `class-transformer/storage`,
`@fastify/static`) that the app never actually uses. There is no `@nestjs/terminus`, no GraphQL,
no microservices transport — the health endpoint (`apps/chat-api/src/health/*`, referenced from
`chat-api-backend`'s "Health check endpoint" requirement) is a plain controller, not a Terminus
health indicator, so v12's Terminus `HealthIndicatorService` migration does not apply.

The shared in-memory cache (`AppModule`'s `CacheModule.registerAsync`,
`apps/chat-api/src/app/cache.config.ts`) and every service injecting `CACHE_MANAGER` (
`theme.service.ts`, `models.service.ts`, `scheduled-tasks.service.ts`,
`header-token.strategy.ts`, `applications.service.ts`, `publish.service.ts`,
`conversation-publish.service.ts`, `application-schemas.service.ts`, `mcp-app.service.ts`,
`deployments-listing.service.ts`, `deployments-details.service.ts`,
`toolsets-listing.service.ts`, `dial/cached-dial-request.helper.ts`) depend on the exact
LRU/TTL/eviction contract specified in `chat-api-backend`'s "Bounded shared application cache"
and "In-memory caching for theme configuration" requirements. `cache-manager` is already at
`^7.2.8` (v12 floor: `>=6`) and `keyv` resolves transitively above v12's `>=5` floor, so those
two packages need no version bump themselves — only `@nestjs/cache-manager` does.

## Goals / Non-Goals

**Goals:**

- Move `apps/chat-api` and `apps/mcp-app-sandbox` from NestJS 11 to 12 with zero externally
  observable behavior change: same HTTP contracts, same 400/404/502/503 error shapes, same
  cache TTL/eviction semantics, same OTel log-bridge output, same env-validation fail-fast
  behavior.
- Land the full companion-package bump in one change (`@nestjs/swagger`,
  `@nestjs/cache-manager`, `@nestjs/serve-static`, `@nestjs/config`, `@nestjs/schematics`)
  rather than staggering it, per the issue's rationale for avoiding a larger future jump.
- Use `nest upgrade` (dry-run first) to handle the mechanical package-version reconciliation
  before hand-verifying the behavioral risk areas.

**Non-Goals:**

- Migrating `apps/chat-api`/`apps/mcp-app-sandbox` to ESM (`"type": "module"`). v12's core
  packages ship as ESM but remain consumable from CommonJS via Node's `require(esm)`
  interop — per the issue and the migration guide, staying CommonJS is explicitly supported
  "for as long as you like." The webpack bundles keep emitting CommonJS.
- Adopting `@nestjs/observe` or any other v12-only feature (native observability,
  `HttpExceptionOptions.errorCode`, `routeConflictPolicy`/`routeResolutionStrategy`,
  `StandardSchemaValidationPipe`). The issue lists these as future-unblocked capabilities, not
  scope for this migration.
- Changing CI's Node major version. CI already pins Node 24 in `.github/workflows/pr.yml` and
  `release.yml`; this only confirms the resolved minor clears `@nestjs/schematics`' v12 floor.

## Decisions

**D1 — Hand-edit every `package.json` version to the issue's table; `nest upgrade` does not
work in this repo.** Originally planned as `nest upgrade --dry-run` then apply, on the theory
that the CLI's own tool reconciles every `@nestjs/*` version more safely than hand-editing seven
version strings across three files. Verified not viable: `UpgradeAction` resolves the
`@nestjs/schematics:upgrade` schematic via `@angular-devkit/schematics`' `NodeWorkflow`, which
does plain Node module resolution for `@nestjs/schematics` starting at `process.cwd()`. Since
this repo already has `@nestjs/schematics@^11.0.0` installed at the root, that resolution finds
the old v11 collection — which has no `upgrade` schematic, since it ships new in v12 — instead of
the v12 copy `npx @nestjs/cli@latest` fetches for itself. Reproduced the failure
(`Error: Schematic "upgrade" not found in collection "@nestjs/schematics"`) against this repo's
root, and reproduced success with the identical command against an isolated scratch directory
with no pre-existing `@nestjs/schematics` install — confirming the cause. There is no ordering
that avoids this: the schematic that would bump `@nestjs/schematics` to v12 can only run once
`@nestjs/schematics` is already v12. So every `@nestjs/*` version in root `package.json`,
`apps/chat-api/package.json`, and `apps/mcp-app-sandbox/package.json` is hand-edited to the
versions in the issue's table (same versions the tool would have written) instead.

**D2 — Verify, don't rewrite, the behavior each migration-guide risk item touches.** For each
of ConsoleLogger structured-params, `@nestjs/config` Standard Schema, `@nestjs/cache-manager`
v12 wiring, and lifecycle-hook ordering, the plan is: read the current behavior, read what v12
changes, and add a **regression test** (or confirm an existing one already covers it) rather
than proactively rewriting code that isn't broken. Concretely:

- *ConsoleLogger*: `NestOtelLogger` (`apps/chat-api/src/telemetry/nestjs-otel-logger.ts`) always
  calls `super.log/warn/debug/verbose/fatal/error()` before emitting its own OTel record, and
  every call site passes a single string `message` plus an optional string `contextArg` — never
  a trailing plain object. V12's structured-params behavior only changes how `ConsoleLogger`
  renders a plain object passed *after* the message; since no call site does that, `output`
  should be provably unaffected without a `structuredParams: false` override. The migration task
  adds a test asserting NestOtelLogger's OTel-emitted `attributes`/`severityNumber`/`body` are
  unchanged for a representative log call, and a manual boot-log console diff (before/after) as
  a belt-and-suspenders check.
- *`@nestjs/config`*: `apps/chat-api/src/config/environment.config.ts` passes a
  `class-validator`-decorated `EnvironmentVariables` class to `ConfigModule.forRoot({ validate })`
  using a plain validator function, not the Joi-specific `validationSchema` option — the part
  v12 actually reshapes. The plain-function `validate` signature is unaffected, so no code change
  is expected here; the existing "Environment variable validation at startup" scenarios (missing
  `DIAL_CORE_URL`/`DIAL_API_KEY`/`THEMES_CONFIG_URL` fails fast) are the regression test.
- *`@nestjs/cache-manager`*: `CacheModule.registerAsync` in `apps/chat-api/src/app/app.module.ts`
  and the `cache.config.ts` factory are re-verified against v12's docs for a signature change;
  `cache-manager@^7.2.8` and `keyv` already clear v12's floors, so no store-level change is
  expected. The existing "Bounded shared application cache" scenarios (LRU eviction, TTL
  overrides, zero-TTL, background sweep, shutdown cleanup) gate this — see `specs/chat-api-backend`.
- *Lifecycle-hook ordering*: audit `onModuleInit`/`onApplicationBootstrap` implementers
  (telemetry setup, scheduled-tasks warm-up, any cache warm-up) for cross-provider ordering
  assumptions; v12 calls hooks per component-hierarchy level rather than a single flat pass.

**D3 — Regenerate the OpenAPI spec and `chat-api-client` as a required step, not an
afterthought.** `@nestjs/swagger` v12 can change generated `operationId`s or DTO schema shape.
`npm run openapi` + `npm run openapi:check` run as part of this change's verification, and any
diff in the generated client gets reviewed line-by-line before merge (the client is generated,
not hand-edited, per `AGENTS.md`'s library-isolation exception for `libs/chat-api-client`).

## Risks / Trade-offs

- [Risk] `@nx/webpack`'s CommonJS bundling of ESM-shipped v12 packages fails to build or fails at
  runtime (`ERR_REQUIRE_ESM` or similar), since Node's `require(esm)` interop has edge cases
  (e.g. packages without a usable default export shape). → Mitigation: build and boot-smoke both
  apps immediately after the package bump, before touching any behavioral code; if a specific
  `@nestjs/*` submodule fails to resolve under bundled CommonJS, add it to
  `NESTJS_RESOLVE_ALIASES` in `webpack.shared.js` following the existing pattern, rather than
  changing the module system.
- [Risk] `@nestjs/schematics`' v12 Node floor (`^22.22.3 || ^24.15.0 || >=26`) is narrower than
  the app runtime's floor. Confirmed during implementation: local dev Node is `v20.19.5`, which
  clears neither `@nestjs/schematics@12.0.4`'s floor nor `@angular-devkit/core@22.1.8`'s
  (`npm warn EBADENGINE` on install, non-fatal). CI's pinned Node 24 needs the same check. →
  Mitigation: this only affects local `nest g`/schematics usage and CI's `npm install`, not the
  deployed runtime or the actual package bump (`EBADENGINE` is a warning, not an install
  failure) — resolve the exact Node 24.x minor CI installs before merging and pin
  `actions/setup-node`'s `node-version` explicitly if it falls short; do not raise the local dev
  Node floor as part of this change.
- [Risk] `@nestjs/config` v12's Standard Schema shift silently changes error formatting or
  timing for the *shape* of validation even though the `validate` function itself is untouched
  (e.g. a wrapper Nest applies around the function's thrown error). → Mitigation: the existing
  "Missing required variable prevents startup" scenario is the regression test; run it against
  the bumped package before merge, not just after.
- [Risk] Regenerated Swagger output changes an `operationId` or DTO shape that
  `libs/chat-api-client` consumers depend on. → Mitigation: `npm run openapi:check` is designed
  to fail the build on unreviewed spec drift; treat any diff it reports as a blocking finding to
  resolve explicitly, not to suppress.
- [Trade-off] Bumping every companion package in one change (rather than one PR per package)
  is more to review at once, but matches the issue's own reasoning: staggering the bump risks
  landing in a longer-unsupported state and repeating this verification work per package for
  packages that are tightly version-coupled to `@nestjs/core` anyway.

## Migration Plan

1. Hand-edit every `@nestjs/*` version to the issue's table across root `package.json`,
   `apps/chat-api/package.json`, `apps/mcp-app-sandbox/package.json` (see D1 — `nest upgrade`
   does not work in this repo). Leave `@nestjs/throttler` at `^6.5.0`.
2. Install, then build and boot-smoke `chat-api` and `mcp-app-sandbox` before any behavioral
   verification — this is the fastest signal on the ESM/CommonJS bundling risk.
3. Work through the D2 verification list (ConsoleLogger, `@nestjs/config`, `@nestjs/cache-manager`,
   lifecycle ordering) and the `@Optional()` guard check.
4. Regenerate and review the OpenAPI spec / `chat-api-client` diff.
5. Run the full verification suite from the issue's checklist (test/lint/build for both apps,
   `openapi`/`openapi:check`, `validate:docs`, manual smoke of auth/session, SSE streaming, file
   endpoints, static serving).
6. Update `docs/architecture.md`, root `README.md`, and `apps/chat-api/README.md` if anything
   env/script-facing changed.

**Rollback**: this is a dependency-version bump with no data migration and no persisted schema
change — revert is a straight `git revert` of the version-bump commit(s); no rollback
choreography beyond normal deploy rollback is needed.

## Open Questions

- Does the CI-pinned Node 24 resolve to a minor that clears `@nestjs/schematics`' `^24.15.0`
  floor today? Needs checking against the actual `actions/setup-node` resolution at
  implementation time (not knowable from the repo alone).

## Status: On Hold (blocked by `@nx/nest`)

Attempted during apply on 2026-09-21; reverted after discovering a blocker with no clean fix
available today. Recorded here so a future attempt does not repeat the same dead ends.

**Blocker**: `npm install` after the version bump fails with an unresolvable `ERESOLVE` error.
`@nx/nest@23.2.1` — the currently pinned version, and also the current `latest` on the npm
registry — declares `peerDependencies` `@nestjs/core`/`@nestjs/common: ">=10.0.0 <12.0.0"`
(marked `peerOptional`, but npm's strict resolver still hard-fails on it once no version of
`@nestjs/core` can simultaneously satisfy that upper bound and this change's `^12.0.0` bump).
Checked every published `@nx/nest` prerelease as of 2026-09-21 (`23.3.0-beta.2`, six canary
builds through `23.3.0-canary.20260918-027a0b0`, and three open-PR builds) — all declare the
identical `<12.0.0` cap; none of them are in-flight NestJS-12-support work.

Inspected what `@nx/nest` actually uses `@nestjs/core`/`@nestjs/common` for: only its
generator/scaffolding code (`assert-supported-nestjs-version.js`, the `nx g @nx/nest:application`
/`:library` templates) — not the `@nx/webpack`/`@nx/node`/`@nx/js` executors this repo's existing
`chat-api`/`mcp-app-sandbox` build/serve/test targets actually run. So the peer cap is a
generator-time safety check with no runtime bearing on this repo's build, which is why a scoped
npm `overrides` entry pinning `@nx/nest`'s internal peer resolution to whatever `@nestjs/core`/
`@nestjs/common` versions are installed was offered as a low-risk workaround. The user chose to
hold the migration instead of taking that (or a `--legacy-peer-deps` / prerelease-pin) shortcut,
pending a stable `@nx/nest` release that raises the cap.

**Also found and fixed while attempting this**: the proposal/design/tasks originally said
`@nestjs/throttler` "stays at `^6.5.0` (already v12-compatible)" — this was a misreading of the
issue's table, which actually lists `^6.7.0` as the v12-compatible line; `6.5.0`'s own peer range
only reaches `@nestjs/core@^11`. That correction has already been applied throughout this
change's artifacts and is not itself blocked — re-apply it (bump `@nestjs/throttler` to
`^6.7.0` alongside the rest of the `@nestjs/*` bump) whenever this change resumes.

**`nest upgrade` does not work in this repo at all** (see D1, updated above) — any resumption
must hand-edit `package.json` versions directly, not rely on the CLI tool.

**To resume**: re-check `npm view @nx/nest peerDependencies` (and the same prerelease sweep)
for a release that raises the cap past `<12.0.0`. If still blocked, re-surface the `overrides`
workaround as an option, since the evidence above did not change. All three `package.json`
version edits from this attempt were reverted; task checkboxes in `tasks.md` reset accordingly.
