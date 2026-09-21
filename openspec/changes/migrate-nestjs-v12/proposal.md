## Status: On Hold

An apply attempt on 2026-09-21 found that `@nx/nest`'s current `latest` release (and every
published prerelease) caps `@nestjs/core`/`@nestjs/common` peer support below v12, which blocks
`npm install` after the version bump. See design.md's "Status: On Hold" section for the full
findings and how to resume.

## Why

`@nestjs/core`/`@nestjs/common`/`@nestjs/platform-express` are pinned to `^11.0.0` in the root
`package.json`, `apps/chat-api/package.json`, and `apps/mcp-app-sandbox/package.json`. NestJS 11
moved to the `legacy` dist-tag once v12 (`12.0.3`) shipped, so the project is on an unsupported
line for security fixes and new companion-package releases. Related packages
(`@nestjs/config` `^4.0.4`, `@nestjs/swagger` `^11.4.1`, `@nestjs/cache-manager` `^3.1.2`,
`@nestjs/serve-static` `^5.0.5`, `@nestjs/schematics` `^11.0.0`) drift further behind the longer
this waits, and later jumping straight from v11 to v13+ would be a larger, riskier change than
migrating one major now. Tracked in
[epam/ai-dial-chat#8904](https://github.com/epam/ai-dial-chat/issues/8904).

## What Changes

- Bump `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/testing`,
  `@nestjs/schematics` to `^12.0.0` in the root `package.json`, and
  `@nestjs/common`/`@nestjs/core`/`@nestjs/platform-express`/`@nestjs/testing` to `^12.0.0` in
  `apps/chat-api/package.json` and `apps/mcp-app-sandbox/package.json`.
- Bump `@nestjs/swagger` (`^11.4.1` → `^12.0.0`), `@nestjs/cache-manager` (`^3.1.2` → `^12.0.0`),
  `@nestjs/serve-static` (`^5.0.5` → `^12.0.0`), and `@nestjs/config` (`^4.0.4` → `^12.0.0`) in
  `apps/chat-api/package.json` (and `apps/mcp-app-sandbox/package.json` for `@nestjs/config`).
  `@nestjs/throttler` bumps from `^6.5.0` to `^6.7.0` (the actual v12-compatible line per the
  issue's table — `6.5.0`'s own peer range only reaches `@nestjs/core@^11`).
- Run the framework's own `nest upgrade` CLI (with `--dry-run` first) from the workspace root to
  apply the mechanical parts of the migration (see
  [migration guide](https://docs.nestjs.com/migration-guide)), then hand-verify every risk area
  the guide and the issue call out: ESM-shipped core packages under `@nx/webpack`'s CommonJS
  bundling (`apps/chat-api/webpack.shared.js` dynamic-module aliases), `ConsoleLogger`
  structured-params behavior in `apps/chat-api/src/telemetry/nestjs-otel-logger.ts`,
  `@nestjs/config` v12's Standard-Schema validation option shape in
  `apps/chat-api/src/config/environment.config.ts`, `@nestjs/cache-manager` v12's wiring in
  `apps/chat-api/src/app/app.module.ts` / `apps/chat-api/src/app/cache.config.ts`, regenerated
  Swagger/OpenAPI output and the `chat-api-client` build, `@Optional()` non-inheritance (no
  current usages, guard check only), and per-component-hierarchy lifecycle-hook ordering for
  telemetry, cache warm-up, and scheduled tasks.
- **BREAKING** (internal/tooling only, not user-facing): raises the minimum Node.js runtime to
  `>=20.19.0 <21 || >=22.12.0 <23 || >=24` and the `@nestjs/schematics` CLI floor to
  `^22.22.3 || ^24.15.0 || >=26`. CI already pins Node 24 (`.github/workflows/pr.yml`,
  `release.yml`), so this requires confirming the resolved Node 24 minor satisfies the
  schematics floor (pin explicitly if not) rather than changing CI's major version.
- No externally observable HTTP behavior changes: environment-variable fail-fast validation,
  `ValidationPipe`'s `{ whitelist: true, forbidNonWhitelisted: true, transform: true }` contract
  and its 400 error body shape, the shared in-memory cache's TTL/LRU/eviction semantics, and the
  OTel log-bridge output must all remain identical after the upgrade — these become explicit,
  testable acceptance criteria (see Capabilities) precisely because the migration guide flags
  each of them as a behavior-risk area, not because any of them are intentionally changing.

## Capabilities

### New Capabilities

_None._ This is a framework-version migration; no new user-facing capability is introduced.

### Modified Capabilities

- `chat-api-backend`: adds one new requirement pinning the backend to a supported NestJS major
  version. Today no spec states a floor, so the running framework version is implicit; this
  change makes it explicit and testable. This is an `ADDED` requirement — every existing
  requirement in this capability (env validation, `ValidationPipe` shape, cache TTL/eviction,
  health check, etc.) is already version-agnostic behavior, so none of that text changes.
  `observability-telemetry`'s existing "Application log export through OpenTelemetry" /
  "Console output preserved" scenario already specifies that console output must stay unchanged
  regardless of implementation, which is what guards against v12's `ConsoleLogger`
  structured-params change — no delta needed there.

## Impact

- **Code**: root `package.json`; `apps/chat-api/package.json`; `apps/mcp-app-sandbox/package.json`;
  `apps/chat-api/webpack.shared.js`; `apps/chat-api/src/main.ts`;
  `apps/chat-api/src/telemetry/nestjs-otel-logger.ts`;
  `apps/chat-api/src/config/environment.config.ts`; `apps/chat-api/src/app/app.module.ts`;
  `apps/chat-api/src/app/cache.config.ts`; every `apps/chat-api/src/**/*.controller.ts` (Swagger
  decorator/regeneration surface only, no route changes).
- **Generated API client**: `npm run openapi` + `npm run openapi:check` must be re-run;
  `libs/chat-api-client` build/lint must pass with the regenerated spec.
- **Dependencies**: `@nestjs/*` packages across root, `apps/chat-api`, and `apps/mcp-app-sandbox`;
  transitively `cache-manager` (`^7.2.8`, already satisfies v12's `>=6` floor) and `keyv`
  (already satisfies `>=5`) need no version change themselves.
- **CI/tooling**: `.github/workflows/pr.yml` / `release.yml` Node 24 pin must be confirmed to
  satisfy `@nestjs/schematics`'s v12 floor.
- **Docs**: `docs/architecture.md` (Monorepo & Tooling version table), root `README.md`
  tech-stack list, and `apps/chat-api/README.md` if any env/script surface changes.
- **i18n**: none — no user-visible strings are added or changed.
