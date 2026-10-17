Slicing strategy: risk-first. The highest-risk unknown is whether `@nx/webpack`'s CommonJS
bundling still builds and boots against v12's ESM-shipped core packages (design.md Risk 1), so
that is proven immediately after the version bump, before any behavioral verification work.
Everything after is a vertical slice per migration-guide risk area called out in design.md's D2.

**On hold** — see design.md's "Status: On Hold" section. An apply attempt on 2026-09-21 got as
far as 1.1 and confirmed 1.2's approach doesn't work, but blocked on 1.4: `@nx/nest`'s current
`latest` (and every prerelease) caps `@nestjs/core`/`@nestjs/common` at `<12.0.0`, and the user
chose to hold rather than take the available `overrides` workaround. All package.json edits from
that attempt were reverted; checkboxes below reset to reflect that.

## 1. Bump `@nestjs/*` versions

- [ ] 1.1 Run `npm exec nx run-many -t build --projects=chat-api,mcp-app-sandbox` once
  beforehand to capture a pre-migration baseline build (sanity check that both apps build clean
  before touching dependencies).
- [ ] 1.2 ~~Run `npx nest upgrade --dry-run`~~ — confirmed non-viable: `nest upgrade` resolves
  the `@nestjs/schematics:upgrade` schematic via Node module resolution from the project root,
  which finds this repo's already-installed `@nestjs/schematics@^11.0.0` (no `upgrade`
  schematic — it's new in v12) instead of the v12 copy the CLI fetches for itself. Reproduced
  the failure against this repo's root and reproduced success with the identical command in an
  isolated scratch directory with no pre-existing `@nestjs/schematics` install, confirming the
  cause (see design.md D1, updated). Hand-edit per the issue's version table instead.
- [ ] 1.3 Hand-edit root `package.json`, `apps/chat-api/package.json`, and
  `apps/mcp-app-sandbox/package.json` so that: `@nestjs/common`/`@nestjs/core`/
  `@nestjs/platform-express`/`@nestjs/testing` are at `^12.0.0`; root-only `@nestjs/schematics`
  is at `^12.0.0`; `apps/chat-api/package.json`'s `@nestjs/swagger`, `@nestjs/cache-manager`,
  `@nestjs/serve-static`, `@nestjs/config` are at `^12.0.0`; `apps/mcp-app-sandbox/package.json`'s
  `@nestjs/config` is at `^12.0.0`; `@nestjs/throttler` to `^6.7.0` (root and
  `apps/chat-api/package.json` — this is the actual v12-compatible line per the issue's table;
  `^6.5.0`'s own peer range only reaches `@nestjs/core@^11`, confirmed by the ERESOLVE below).
- [ ] 1.4 Resolve the `@nx/nest` peer conflict before `npm install` will succeed:
  `@nx/nest@23.2.1` (current `latest`, and every prerelease as of 2026-09-21) declares
  `@nestjs/core`/`@nestjs/common: ">=10.0.0 <12.0.0"` as a `peerOptional` dependency, which
  still hard-fails npm's resolver against this change's `^12.0.0` bump. Confirmed `@nx/nest`
  only uses those packages in its generator/scaffolding code
  (`assert-supported-nestjs-version.js`, `nx g @nx/nest:application`/`:library` templates), not
  in the `@nx/webpack`/`@nx/node`/`@nx/js` executors this repo's build/serve/test targets run —
  get explicit sign-off on the fix approach (scoped npm `overrides` pinning `@nx/nest`'s peer
  resolution to the installed versions is the lowest-risk option evaluated) before applying it,
  since holding the migration until a stable `@nx/nest` release lifts the cap is also on the
  table.

### Verification

- Run `npm install` and confirm it completes without an unresolved peer-dependency error.
- `npm run docs:install-matrix` if any `dependencies`/`peerDependencies` range changed, then
  review the regenerated `docs/host-install-matrix.md` diff before committing.

## 2. Build and boot smoke both apps (risk-first check)

- [ ] 2.1 Run `npm exec nx build chat-api` and `npm exec nx build mcp-app-sandbox`; if either
  fails on an ESM/CommonJS resolution error for a `@nestjs/*` submodule, add the failing module
  to `NESTJS_RESOLVE_ALIASES` in `apps/chat-api/webpack.shared.js` following the existing
  pattern (do not change `apps/chat-api`'s module system or `tsconfig` module target to resolve
  this).
- [ ] 2.2 Boot `apps/chat-api` locally (`npm run start:api`) and confirm the process starts
  without a runtime `require`/`import` resolution error, then stop it.

### Verification

- `npm exec nx build chat-api`
- `npm exec nx build mcp-app-sandbox`
- `npm run build:quiet` (affected-build smoke covering both apps' dependents)

## 3. Verify `ConsoleLogger` / OTel log-bridge behavior unchanged

- [ ] 3.1 Re-read `apps/chat-api/src/telemetry/nestjs-otel-logger.ts` against v12's
  `ConsoleLogger` structured-params change; confirm no call site passes a trailing plain object
  after the message (per design.md D2, none currently does).
- [ ] 3.2 If `apps/chat-api/src/telemetry/nestjs-otel-logger.spec.ts` does not already assert the
  emitted `severityNumber`/`severityText`/`attributes`/`body` shape for a representative
  `log`/`warn`/`error` call, add that assertion; otherwise confirm it still passes unmodified.

### Verification

- `npm run test:file -- apps/chat-api/src/telemetry/nestjs-otel-logger.spec.ts`
- `npm run test:file -- apps/chat-api/src/telemetry/http-lifecycle-listener.spec.ts` (if present;
  covers the same bootstrap logger wiring)

## 4. Verify `@nestjs/config` v12 validation behavior unchanged

- [ ] 4.1 Re-read `apps/chat-api/src/config/environment.config.ts` and its `ConfigModule.forRoot`
  wiring in `apps/chat-api/src/app/app.module.ts` against v12's Standard Schema option shape;
  confirm the plain `class-validator`-based `validate` function (not the Joi-specific
  `validationSchema` option) is unaffected, per design.md D2.
- [ ] 4.2 If no existing spec test covers the "missing required environment variable fails
  startup" scenario for `DIAL_CORE_URL`/`DIAL_API_KEY`/`THEMES_CONFIG_URL`, add one; otherwise
  confirm it still passes unmodified against the bumped `@nestjs/config`.

### Verification

- `npm run test:file -- apps/chat-api/src/config/environment.config.spec.ts`
- `npm run test:file -- apps/chat-api/src/app/app.module.spec.ts` (if present)

## 5. Verify `@nestjs/cache-manager` v12 wiring and TTL/eviction behavior unchanged

- [ ] 5.1 Re-read `CacheModule.registerAsync` in `apps/chat-api/src/app/app.module.ts` and the
  factory in `apps/chat-api/src/app/cache.config.ts` against v12's `CacheManagerOptions` type;
  confirm `cache-manager@^7.2.8` and the resolved `keyv` version already clear v12's `>=6`/`>=5`
  floors (per design.md Context) and no store-level code change is required.
- [ ] 5.2 Confirm the existing "Bounded shared application cache" and "In-memory caching for
  theme configuration" test coverage (LRU eviction at capacity, default/override TTL, zero-TTL,
  background sweep, shutdown cleanup) still passes unmodified against the bumped
  `@nestjs/cache-manager`.

### Verification

- `npm run test:file -- apps/chat-api/src/app/cache.config.spec.ts`
- `npm run test:file -- apps/chat-api/src/themes/theme.service.spec.ts`
- `npm run test:file -- apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.spec.ts`

## 6. Audit lifecycle-hook ordering and `@Optional()` usage

- [ ] 6.1 List every `onModuleInit`/`onApplicationBootstrap` implementer under
  `apps/chat-api/src/**` and `apps/mcp-app-sandbox/src/**` and confirm none assumes a specific
  cross-provider execution order that v12's per-component-hierarchy-level hook invocation could
  reorder (per design.md D2).
- [ ] 6.2 Grep both apps for `@Optional()` usage on a subclassed provider constructor; confirm
  the issue's "no current usages" finding still holds (guard check only — no code change
  expected).

### Verification

- `npm exec nx test chat-api`
- `npm exec nx test mcp-app-sandbox`

## 7. Regenerate OpenAPI spec and `chat-api-client`

- [ ] 7.1 Run `npm run openapi` and review the diff in `libs/chat-api-client/openapi.json` for
  any `operationId` or DTO schema change introduced by the `@nestjs/swagger` v12 bump.
- [ ] 7.2 Run `npm run openapi:check`; resolve any reported drift explicitly rather than
  regenerating over it without review.
- [ ] 7.3 Build and lint `libs/chat-api-client` against the regenerated spec.

### Verification

- `npm run openapi`
- `npm run openapi:check`
- `npm exec nx build chat-api-client`
- `npm exec nx lint chat-api-client`

## 8. CI Node-version floor check

- [ ] 8.1 Confirm the Node 24 minor resolved by `actions/setup-node` in
  `.github/workflows/pr.yml` / `release.yml` satisfies `@nestjs/schematics`' v12 floor
  (`^22.22.3 || ^24.15.0 || >=26`); if it does not, pin `node-version` to a satisfying 24.x value
  in both workflow files (per design.md's Open Question — this cannot be resolved from repo
  contents alone).

### Verification

- No local command; confirmed against the CI runner's actual resolved Node version.

## 9. Update documentation

- [ ] 9.1 Update `docs/architecture.md`'s Monorepo & Tooling version table to NestJS 12.
- [ ] 9.2 Update the root `README.md` tech-stack list's NestJS version reference.
- [ ] 9.3 Update `apps/chat-api/README.md` if any env variable or npm script surface changed as
  part of this migration (expected: none).

### Verification

- `npm run validate:docs`

## 10. Full verification pass

- [ ] 10.1 Run the complete non-mutating verification suite once, after all prior slices pass
  individually.

### Verification

- `npm run verify:full`
