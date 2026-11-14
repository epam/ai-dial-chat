## Context

`apps/chat-api` and `apps/mcp-app-sandbox` are both on NestJS 11 (`^11.0.0` across
`@nestjs/common`/`@nestjs/core`/`@nestjs/platform-express`, plus `@nestjs/config` `^4.0.4`,
`@nestjs/swagger` `^11.4.1`, `@nestjs/cache-manager` `^3.1.2`, `@nestjs/serve-static` `^5.0.5`,
`@nestjs/schematics` `^11.0.0`). NestJS 12 is now `latest` (`12.2.0` as of 2026-10-22); v11
moved to `legacy`. The workspace is on Nx `23.2.1`, TypeScript `~6.0.2`, and Vitest for both
apps' tests.
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
- Use `@nx/nest`'s `upgrade-to-nest-12` migration for the root core-package bump and hand-edit
  the rest (D1, D4) before hand-verifying the behavioral risk areas.

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
  `release.yml`, and the resolved minor clears `@nestjs/schematics`' v12 floor.
- Upgrading Nx 23 → 24 inside this change. It is a prerequisite with its own breaking changes and
  lands as a separate change first (D4).

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
versions in the issue's table (same versions the tool would have written) instead. D4 narrows
this: once on Nx 24.1, `@nx/nest`'s own migration covers the root core packages, so only the
app manifests and companion packages stay hand-edited.

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
- *Generic `ArgumentMetadata` in custom pipes*: guard check only. As of 2026-10-22 neither app
  has a `PipeTransform` implementation; the only pipe is the built-in `ValidationPipe`.

**D3 — Regenerate the OpenAPI spec and `chat-api-client` as a required step, not an
afterthought.** `@nestjs/swagger` v12 can change generated `operationId`s or DTO schema shape.
`npm run openapi` + `npm run openapi:check` run as part of this change's verification, and any
diff in the generated client gets reviewed line-by-line before merge (the client is generated,
not hand-edited, per `AGENTS.md`'s library-isolation exception for `libs/chat-api-client`).

**D4 — Unblock through Nx 24.1 in two steps, not an `overrides` workaround.** NestJS 12 peer
support in `@nx/nest` comes from [nrwl/nx#36937](https://redirect.github.com/nrwl/nx/pull/36937),
approved 2026-10-21 but not merged as of 2026-10-22. Its head widens the peers to
`@nestjs/core`/`@nestjs/common: ">=10.0.0 <13.0.0"` and `@nestjs/schematics: ">=11.0.0 <13.0.0"`,
and its last commit ("target Nx 24.1 for Nest 12") moves the work to **Nx 24.1**. Nx 24.0.0
(`latest` since 2026-10-21) still caps at `<12.0.0`, and no 23.x backport is planned, so a patch
bump of our `23.2.1` pins will never unblock this.

1. **Step A — separate change: Nx 23.2.1 → 24.x.** Run `nx migrate` to 24 on its own, so the Nx
   major and the NestJS major stay reviewable apart. Nx 24's breaking changes that touch this
   workspace include: tasks waiting for a continuous dependency to become ready, framework
   plugins deferring typecheck to `@nx/js/typescript`, inferred project names kept when
   `project.json` omits `name`, and removal of the `dependsOn` `self`/`dependencies` magic-string
   shim. This step can land on 24.0.x now, without waiting for the Nest fix.
2. **Step B — this change, on Nx 24.1.** Bump to the 24.1 release, then run its optional migration
   (opt-in, so it needs `--include`), as in the PR's own re-run command:
   `npx nx migrate @nx/nest@<24.1.x> --from=@nx/nest@24.0.0 --include=all` followed by
   `npx nx migrate --run-migration=@nx/nest:upgrade-to-nest-12`.

What `upgrade-to-nest-12` does here (read from the PR head `3f8c136a83`; recheck against the
released code):

- It bumps only the `@nestjs/*` core packages **declared in the root `package.json`**
  (`common`, `core`, `platform-express`, `schematics`, `testing`) to `^12.0.1`. It does not touch
  `apps/chat-api/package.json`, `apps/mcp-app-sandbox/package.json`, or the companion packages
  (`swagger`, `config`, `cache-manager`, `serve-static`, `throttler`), so those stay hand-edited
  per D1.
- It upgrades TypeScript 5 → 6 for `@nestjs/schematics` 12 (which peers `typescript >=6.0.0`).
  This is a no-op here: we are on `~6.0.2`.
- It rewires Jest projects (Jest 30.5, `--experimental-vm-modules`, Node ≥24.9). This is a no-op
  too: `chat-api` and `mcp-app-sandbox` test with Vitest, so the migration's "keep NestJS 11
  because Jest runs on old Node" guard does not trigger, even on a local Node 20.
- Its paired AI prompt (`ai-instructions-for-nest-12.md`) walks the same judgment items D2
  already covers (lifecycle-hook ordering, `@Optional()` on subclasses, `@nestjs/config`), plus
  generic `ArgumentMetadata` in custom pipes. That item is added to the D2 audit.

If Nx 24.1 slips and the upgrade becomes urgent, the 2026-09-21 fallback still holds: a scoped npm
`overrides` entry for `@nx/nest`'s peers, on top of Step A (see "Status: On Hold").

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
  (`npm warn EBADENGINE` on install, non-fatal). → Mitigation: this only affects local
  `nest g`/schematics usage, not the deployed runtime or the actual package bump (`EBADENGINE` is
  a warning, not an install failure). CI is not affected: `node-version: 24` resolves to the
  newest 24.x (`v24.22.1` on 2026-10-22), which clears `^24.15.0`. Do not raise the local dev
  Node floor as part of this change.
- [Risk] The upstream fix changes before it ships: the PR head moved from 23.x to 24.1 on its
  last day of review, and the migration's behavior described in D4 is read from an unmerged
  head. → Mitigation: before Step B, re-read the released `packages/nest/package.json` peers and
  `migrations.json` for the 24.1 tag, and run `nx migrate` with the migration's dry-run output
  reviewed before applying.
- [Trade-off] Splitting the Nx 24 upgrade into its own change adds a PR, but keeps the two
  majors' failures distinguishable: a build break after Step A is Nx, a break after Step B is
  NestJS.
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

0. Prerequisite (separate change, D4 Step A): Nx 23.2.1 → 24.x merged on `development`.
1. Bump Nx to the 24.1 release and run `@nx/nest:upgrade-to-nest-12` for the root core
   packages (D4 Step B). Hand-edit the app manifests and companion packages to the issue's table
   (D1), including `@nestjs/throttler` → `^6.7.0`.
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

- ~~Does the CI-pinned Node 24 resolve to a minor that clears `@nestjs/schematics`' `^24.15.0`
  floor?~~ Resolved 2026-10-22: yes, `node-version: 24` resolves to `v24.22.1`.
- When does Nx 24.1 ship, and does it keep D4's migration shape? Track
  [nrwl/nx#36937](https://redirect.github.com/nrwl/nx/pull/36937) and
  [nrwl/nx#36936](https://redirect.github.com/nrwl/nx/issues/36936).

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

**Re-check 2026-10-22**: still blocked. `@nx/nest` `latest` is now `24.0.0` (released
2026-10-21), and `next` `24.0.0-rc.1` and `canary` `24.0.0-canary.20261021-b84b2a4` all keep
the `<12.0.0` cap. `packages/nest/package.json` on nrwl/nx `master` is unchanged. The fix PR
[nrwl/nx#36937](https://redirect.github.com/nrwl/nx/pull/36937) is approved (AgentEnder,
2026-10-21) but open, and it now targets Nx 24.1 (D4). Current companion releases:
`@nestjs/core`/`common`/`platform-express`/`testing` `12.2.0`, `schematics` `12.0.10`, `swagger`
`12.0.3`, `config` `12.0.1`, `cache-manager` `12.0.1`, `serve-static` `12.0.0`, `throttler`
`6.7.1` (peers `@nestjs/core` `^12.0.0`).

**To resume**: (1) land the Nx 24 upgrade as its own change (D4 Step A), which does not depend
on the Nest fix; (2) once `npm view @nx/nest@<24.1.x> peerDependencies` shows `<13.0.0`, start at
`tasks.md` section 1 (D4 Step B). If 24.1 slips and the upgrade becomes urgent, re-surface the
`overrides` workaround on top of Step A. All three `package.json` version edits from the first
attempt were reverted; task checkboxes in `tasks.md` reset accordingly.
