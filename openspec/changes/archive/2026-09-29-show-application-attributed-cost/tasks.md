Slicing strategy: **risk-first, then vertical.** Slices 1–2 prove the riskiest part (prerelease SDK + Core's single-value `deploymentTypes` parsing) at the BFF boundary with URL-level assertions, before anything builds on it. Slice 3 fixes the contract (OpenAPI + generated client). Slices 4–6 run one path end to end: lib presentation → `chat-hooks` adapter → `UsageTab` wiring. Each slice is independently verifiable. Read `apps/chat-api/AGENTS.md` before slices 1–3 and `.claude/rules/libs.md` + `.claude/rules/lib-styling.md` before slices 4–5.

## 1. SDK bump (risk-first)

- [x] 1.1 Bump `@epam/ai-dial-typescript-sdk` to exactly `0.2.0-dev.11` in `apps/chat-api/package.json` and refresh the lockfile via the workspace package manager. Diff `dist/index.d.ts` of `0.1.1` vs `0.2.0-dev.11` for every SDK method `apps/chat-api/src/**` calls, and fix only typing breaks the bump itself introduces.
  - Verification: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm run build:quiet` (bundling affected by a dependency bump).
- [x] 1.2 Run `npm run docs:install-matrix` and commit the regenerated `docs/host-install-matrix.md` only if it changed.
  - Verification: `npm run validate:docs`.

## 2. BFF `deploymentTypes` (risk-first)

- [x] 2.1 Add `apps/chat-api/src/deployments/dto/deployment-type.ts` with string enum `DeploymentType { Model = 'model', Application = 'application' }` and the shared `normalizeDeploymentTypesInput` helper (no imports), and `apps/chat-api/src/deployments/dto/user-stats-query.dto.ts` with `UserStatsQueryDto.deploymentTypes?: DeploymentType[]` with a `@Transform` that accepts a string (`a,b`) or a string array (repeated keys), splits each entry on `,`, trims, drops empties, and de-duplicates in order; then `@IsOptional()`, `@IsArray()`, `@IsEnum(DeploymentType, { each: true })`, `@ApiPropertyOptional({ enum: DeploymentType, isArray: true, description })`. Model: `deployments-query.dto.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/deployments/tests/dto/user-stats-query.dto.spec.ts`.
- [x] 2.2 Unit tests `apps/chat-api/src/deployments/tests/dto/user-stats-query.dto.spec.ts` (via `plainToInstance` + `validate`): comma form, repeated-key form, mixed `['model,application','model']`, whitespace/empty entries, duplicates collapse, `route` / `MODEL` / `toolset` rejected, absent → `undefined`.
  - Verification: same file.
- [x] 2.3a Add `USER_USAGE_DEPLOYMENT_TYPES?: DeploymentType[]` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`: comma-split/trim/drop-empty/dedupe `@Transform` (empty or unset → `[Model, Application]`), `@IsOptional()`, `@IsEnum(DeploymentType, { each: true })`, class default `[DeploymentType.Model, DeploymentType.Application]`, with a block comment on its purpose (follow `ADMIN_ROLE_NAMES` / `CSP_MODE`).
  - Verification: `npm run test:file -- apps/chat-api/src/config/tests/user-usage-deployment-types-environment.spec.ts` (through the real `validate()`): unset → both kinds; `model` → `[Model]`; ` model , application ,` normalized; `model,route` fails validation.
- [x] 2.3 In `apps/chat-api/src/deployments/details/deployments-details.service.ts`, extend `getUserLimits(accessToken, deploymentTypes?)` and `getUserUsage(accessToken, deploymentTypes?)`: when the list is non-empty pass `params: { query: { deploymentTypes: <comma-joined string> } }` through a single cast with a block comment citing Core `LimitController#getDeploymentTypes` (`getParam(...).split(",")`); when the request list is empty/absent, fall back to `configService.get('USER_USAGE_DEPLOYMENT_TYPES', { infer: true })` (inject `ConfigService` if the service does not already have it). Thread the argument through `DeploymentsService` (`deployments.service.ts:44-45`, binds only).
  - Verification: `npm run test:file -- apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`.
- [x] 2.4 Extend `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`: using a `fetch` stub on the SDK client, assert the **outgoing URL** has exactly one `deploymentTypes` key with value `model,application` for `[Model, Application]`; with the request list `undefined` or `[]`, the URL carries the configured default (`model,application` by default; `model` when the config stub returns `[Model]`); a request value overrides the config; existing error-mapping tests unchanged.
  - Verification: same file.
- [x] 2.5 In `apps/chat-api/src/deployments/user-limits.controller.ts`, add `@Query() query: UserStatsQueryDto` to `getUserLimits` / `getUserUsage` and forward `query.deploymentTypes`. Update both `@ApiOperation` descriptions: reported kinds follow `deploymentTypes`, or the server-configured default when omitted, per-deployment cost includes aggregated descendant cost and is not additive; add a `400` `@ApiResponse` for invalid `deploymentTypes`.
  - Verification: `npm run test:file -- apps/chat-api/src/deployments/tests/user-limits.controller.integration.spec.ts`.
- [x] 2.6 Extend `apps/chat-api/src/deployments/tests/user-limits.controller.integration.spec.ts` (supertest): `?deploymentTypes=model,application` and `?deploymentTypes=model&deploymentTypes=application` both call the service with `[Model, Application]`; no query → service called with `undefined` (the default is resolved in the service, not the controller); `?deploymentTypes=route` → `400` and the service is not called; `Cache-Control: private, no-store` still set.
  - Verification: same file; then `npm run verify:changed` (end of slice).

## 3. Contract: OpenAPI + generated client

- [x] 3.1 Run `npm run openapi` then `npm run openapi:check`; confirm `libs/chat-api-client/openapi.json` shows `deploymentTypes` (array of `model`/`application`) on both operations and the regenerated `UserApi.getUserUsage` / `getUserLimits` accept `deploymentTypes?: Array<…DeploymentTypesEnum>`. Record the exact generated enum names in `design.md` if they differ from `GetUserUsageDeploymentTypesEnum` / `GetUserLimitsDeploymentTypesEnum`. Do not hand-edit generated files.
  - Verification: `npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`.

## 4. `libs/usage-dashboard` presentation (vertical, step 1)

- [x] 4.1 Add `typeLabel?: string` with JSDoc to `ModelLimitRow` in `libs/usage-dashboard/src/models/model-limits-props.ts`; in `libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsRow.tsx:120` render `row.typeLabel || labels.modelTypeLabel`.
  - Verification: `npm run test:file -- libs/usage-dashboard/src/components/ModelLimitsSection/tests/ModelLimitsSection.spec.tsx`.
- [x] 4.2 In `libs/usage-dashboard/src/components/ModelLimitsSection/PeriodCell.tsx` `CostValue`, render `cell.supportingLabel` as a second line (same `secondaryValueClassName` + `styles.secondaryValue`, `break-words`) when non-empty and the cell is not `Unavailable`; keep markup identical when absent.
  - Verification: same file as 4.1.
- [x] 4.3 Tests in `libs/usage-dashboard/src/components/ModelLimitsSection/tests/ModelLimitsSection.spec.tsx` using text/role queries: a row with `typeLabel: 'Agent'` shows `Agent` while others show the section label; empty `typeLabel` falls back; a cost cell with `supportingLabel` shows both lines inside the period cell; `Unavailable` cost ignores it; without `supportingLabel` output is unchanged.
  - Verification: same file.
- [x] 4.4 RTL / layout check: confirm the two changes add no physical-direction classes (`ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`text-left|right`) and no directional icon; extend the existing RTL/mobile-layout test in the same spec (if present) to render a row with `typeLabel` and `supportingLabel` under `dir="rtl"`.
  - Verification: same file.
- [x] 4.5 Architecture guard for `libs/usage-dashboard`: grep the lib's `src/`, `package.json`, `tsconfig.lib.json`, `vite.config.mts` — no `@epam/ai-dial-chat-api-client`, no `'application'`/`'model'` kind comparison, no `applications/` parsing, no app/server-api/context/env/i18n import.
  - Verification: `npm exec nx lint usage-dashboard`.
- [x] 4.6 Update `libs/usage-dashboard/README.md`: `ModelLimitRow` type line gains `typeLabel?`; `ModelLimitMetricCell.supportingLabel` is now also rendered for Cost; add a one-line usage example row with `typeLabel`.
  - Verification: `npm run validate:docs`; then `npm run verify:changed` (end of slice).

## 5. `libs/chat-hooks` adapter (vertical, step 2)

- [x] 5.1 Add `applicationTypeLabel: 'usage.applicationTypeLabel'` and `includesCalledModelsLabel: 'usage.includesCalledModelsLabel'` to `USAGE_MODEL_LIMITS_I18N_KEYS` in `libs/chat-hooks/src/usage/map-user-usage-to-model-limits.ts`, with JSDoc (no interpolation).
  - Verification: `npm run test:file -- libs/chat-hooks/src/usage/tests/map-user-usage-to-model-limits.spec.ts`.
- [x] 5.2 In the same file: build the item map from `Model` and `Application` items keyed by `normalizeDeploymentId(item.id)` (import from `../catalog/deployment-id` or its actual relative path, extensionless), look up by `normalizeDeploymentId(key)`, keep `row.id` = the usage key. For application items: Unavailable token cells, cost cells via `buildCostMetricCell` plus `supportingLabel` when `Unlimited`, `typeLabel`, and a Cost-only usage filter. Leave the model path unchanged.
  - Verification: same file.
- [x] 5.3 Tests in `libs/chat-hooks/src/usage/tests/map-user-usage-to-model-limits.spec.ts`: application row enrichment (name/icon/`typeLabel`); Unavailable tokens despite `used: 0 / total: 10M`; Unlimited cost with supporting label; Cost-only filter excludes an app with token noise; status follows overall budget; raw↔encoded custom-app id match in both directions; toolset items never enrich; unmatched id stays a model row with no `typeLabel`; **every pre-existing test passes unedited** (model rows deep-equal) — except `does not enrich a model row from a non-model deployment item`, whose Application fixture now enriches by design; it is re-pointed at a Toolset item, matching the modified spec scenario.
  - Verification: same file.
- [x] 5.4 Add a regression test in `libs/chat-hooks/src/usage/tests/map-usage-data-to-dashboard.spec.ts`: adding application entries to `deployments` leaves `mapUsageDataToDashboard` and `mapOverallCostLimitsToPeriodStatuses` output unchanged.
  - Verification: `npm run test:file -- libs/chat-hooks/src/usage/tests/map-usage-data-to-dashboard.spec.ts`.
- [x] 5.5 Correct the comment at `libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts:55-61` and the `costGroup` JSDoc (line 18): cost stats are the caller's global spend plus this deployment's aggregated descendant cost (Core #2032), against the global budget; note the suspected router double count is tracked upstream. Comment-only — no behaviour change.
  - Verification: `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-deployment-limits-to-input.spec.ts` (unchanged, must pass).
- [x] 5.6 Architecture guard for `libs/chat-hooks`: the change adds no client construction, no base URL/headers, no app context/routing/env/feature-flag/i18n/UI-kit import; generated-client use stays type/enum-only (AGENTS.md §Library isolation, second and fourth exceptions).
  - Verification: `npm exec nx lint chat-hooks`.
- [x] 5.7 Update `libs/chat-hooks/README.md` for `mapUserUsageToModelLimits`: joins models and applications (id-normalized), application-row rules, the two new `USAGE_MODEL_LIMITS_I18N_KEYS` entries, and that app rows' cost includes called models and must not be summed.
  - Verification: `npm run validate:docs`; then `npm run verify:changed` (end of slice).

## 6. App wiring + i18n (vertical, step 3)

- [x] 6.1 Add i18n keys to `apps/chat/src/i18n/locales/en.json` under `usage`: `applicationTypeLabel: "Agent"`, `includesCalledModelsLabel: "Includes cost of models it called"`; add `ApplicationTypeLabel` and `IncludesCalledModelsLabel` to `UsageI18nKeys` in `apps/chat/src/constants/translation-keys.ts` with the same paths.
  - Verification: `npm run test:file -- apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx`.
- [x] 6.2 Leave `apps/chat/src/server-api/user-limits.ts` unchanged (no `deploymentTypes` — the BFF env default decides). Add `apps/chat/src/server-api/tests/user-limits.api.spec.ts` (follow `toolsets.api.spec.ts`) pinning that: `getUserUsage()` calls the generated method once with no `deploymentTypes` and returns its result untransformed.
  - Verification: `npm run test:file -- apps/chat/src/server-api/tests/user-limits.api.spec.ts`.
- [x] 6.4 Extend `apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx`: with a usage payload containing a model and an application (and deployment items for both), the table shows the application's display name (the BFF default supplies application entries; the test mocks the response), `Agent` caption, `Unavailable` token text, and the "Includes cost of models it called" line; the model row still shows `Model`; the fetcher is called exactly once across a re-render.
  - Verification: same file; then `npm run verify:changed` (end of slice).

## 7. Docs + specs close-out

- [x] 7.1 Update `docs/architecture.md` endpoint table rows for `GET /api/v1/user/limits` and `/user/usage` (lines ~579-580) to mention the optional `deploymentTypes` parameter and application entries; update the `UsageTab` paragraph (~line 238) to say the reported kinds follow the BFF's `USER_USAGE_DEPLOYMENT_TYPES` (default models and applications).
  - Verification: `npm run validate:docs`.
- [x] 7.2 Document `USER_USAGE_DEPLOYMENT_TYPES` in the `apps/chat-api/README.md` environment table (default `model,application`, allowed values, `model` restores the model-only view) and add a commented example to `apps/chat-api/.env.template`; if the README describes the user limits/usage endpoints, add `deploymentTypes` there too.
  - Verification: `npm run validate:docs`.
- [x] 7.3 Final gate: `npm run verify:full` once, plus `npm run build:quiet` (dependency bump affects bundling).
  - Result: `typecheck:full` and `build:quiet` pass. `lint:check`, `format:check`, and `test:full` fail only on issues reproduced on clean `development`, none in files this change touches: `import/order` in `apps/chat/src/components/CatalogView/CatalogView.tsx:18` (from #9112), prettier in `libs/prompt-editor/README.md`, `useSkillFileSystemPicker.spec.ts` (jsdom `Blob.text()` returns `[object Blob]`), and order-dependent flakes in `app-config.service.spec.ts` / `skills.controller.spec.ts` that pass in isolation.

## 8. Follow-ups (out of scope — record, do not implement here)

- [ ] 8.1 Move `@epam/ai-dial-typescript-sdk` from `0.2.0-dev.11` to the first stable `0.2.x` once published; re-run slice 1 verification.
- [ ] 8.2 After the Core bug report is filed (suspected `/v1/deployments/{name}/limits` double count; `deploymentTypes` should be `explode: false`), link it from the `map-deployment-limits-to-input.ts` comment, and remove the D1 cast once Core/SDK declare `explode: false`.
