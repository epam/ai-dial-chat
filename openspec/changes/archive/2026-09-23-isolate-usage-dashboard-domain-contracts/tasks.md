**Slicing strategy: risk-first.** The highest risk is silent behaviour drift in ~600 lines of pure
mapping code. Group 1 therefore pins the behaviour with characterization tests *against the current
implementation* before a single line moves; every later group re-runs those same assertions. Groups
2–5 then proceed as thin vertical slices (move → delink → prove → document), each independently
verifiable.

No new user-visible strings are introduced, so there is no `en.json` task. No UI is added or
restyled, so there is no new-component RTL task — group 5 instead verifies that existing
desktop/mobile/RTL and a11y behaviour is unchanged. No endpoint, DTO, or OpenAPI change is in scope,
so there are no generated-client tasks.

## 1. Inventory, spec reconciliation, and characterization (slice A)

- [x] 1.1 Record the public-API migration decision in the change: the seven exports leaving
      `libs/usage-dashboard/src/index.ts` are `mapUsageDataToDashboard`, `mapUserUsageToModelLimits`,
      `mapOverallCostLimitsToPeriodStatuses`, `USAGE_DATA_I18N_KEYS`, `USAGE_MODEL_LIMITS_I18N_KEYS`,
      `FormatResetTime`, `ResetTimeDisplayLike`. Confirm by re-reading
      `libs/usage-dashboard/src/index.ts` that no other export is affected, and that
      `UsageLimitCard`, `UsageLimitCardGroup`, `ModelLimitsSection`, `UsageLimitStatus`,
      `ModelLimitMetricKind`, `ModelLimitStatus`, `USAGE_DASHBOARD_CLASS` and all display types stay.
- [x] 1.2 Re-run the consumer inventory across `.ts`, `.tsx`, `.mts`, `.json` and `.md` for all seven
      names plus the package specifier. Expected in-repo consumers:
      `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`,
      `apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx`,
      `libs/usage-dashboard/README.md`, and the two lib spec files. Record anything else found.
      Do **not** record "no external consumers" — repository search is evidence about this
      repository only.
- [x] 1.3 Verify the 22 i18n key paths in `USAGE_DATA_I18N_KEYS` and `USAGE_MODEL_LIMITS_I18N_KEYS`
      each have a byte-identical member in `UsageI18nKeys`
      (`apps/chat/src/constants/translation-keys.ts:1351-1387`). Any key without a match blocks the
      substitution in 2.1/2.2 — that key's const entry moves verbatim instead.
- [x] 1.4 Add missing characterization cases to
      `libs/usage-dashboard/src/utils/tests/map-usage-data-to-dashboard.spec.ts`, **in place**, for
      any invariant the suite does not already assert: UTC Today/This week/This month ordering;
      omission of a period with absent or non-finite `total`/`used`; `total` exactly `2 ** 53` and
      above treated as unlimited; finite `total` of `0` yielding 100%; negative `used` floored to
      zero; `usedPercent` above 100 left unclamped with `LimitReached`; the 75% and 100% threshold
      boundaries; and the reset trio being present-or-all-absent.
- [x] 1.5 Add missing characterization cases to
      `libs/usage-dashboard/src/utils/tests/map-user-usage-to-model-limits.spec.ts`, **in place**,
      for: row order following `Object.keys(usage.deployments)` regardless of `deploymentItems`
      order; `DeploymentItemDtoTypeEnum.Model`-only enrichment; fallback identity (`item.id`, then
      the raw deployment key) and no avatar when unmatched; duplicate-metadata behaviour; exclusion
      of rows with no positive usage across the twelve displayed stats while minute/hour/request
      usage is ignored; `getRowStatus` precedence of finite token and cost statuses over the
      `NoLimit` fallback, and that sentinel cost cells alone never promote an all-unavailable-tokens
      row; the divergent token-vs-cost unlimited outputs asserted as-is (token cell gets
      `supportingLabel` + `followsCostLimit`/`noLimit` aria variants, cost cell gets spend-only)
      **without** unifying them; and `mapOverallCostLimitsToPeriodStatuses` producing no reset fields
      when `formatResetTime` is omitted.
- [x] 1.6 Confirm no library **component** test imports `@epam/ai-dial-chat-api-client`, so only the
      two utility suites move: check
      `libs/usage-dashboard/src/components/*/tests/*.spec.tsx`.

**Verification (slice A)**

```sh
npm run test:file -- libs/usage-dashboard/src/utils/tests/map-usage-data-to-dashboard.spec.ts
npm run test:file -- libs/usage-dashboard/src/utils/tests/map-user-usage-to-model-limits.spec.ts
```

Both suites must be green against the **unmoved** implementation before slice B starts. A new case
that fails here is a real behaviour discovery, not a case to adjust — record it and resolve it before
moving code.

## 2. Move adapters and migrate the consumer (slice B)

- [x] 2.1 Create `apps/chat/src/utils/map-usage-data-to-dashboard.ts` with
      `mapUsageDataToDashboard` moved verbatim from
      `libs/usage-dashboard/src/utils/map-usage-data-to-dashboard.ts`, including
      `UNLIMITED_TOTAL_THRESHOLD`, `RUNNING_LOW_THRESHOLD_PERCENT`, `isUsableStats`, `getStatus`,
      `buildResetFields`, `mapStatsToCardData` and their JSDoc. Replace `USAGE_DATA_I18N_KEYS` with
      `UsageI18nKeys` from `../constants/translation-keys`, and the local `ResetTimeDisplayLike` /
      `FormatResetTime` with `ResetTimeDisplay` from `./usage-reset-time`. Import
      `UsageLimitCardData` and `UsageLimitStatus` from `@epam/ai-dial-usage-dashboard`. Relative
      imports stay extensionless.
- [x] 2.2 Create `apps/chat/src/utils/map-user-usage-to-model-limits.ts` with
      `mapUserUsageToModelLimits` and `mapOverallCostLimitsToPeriodStatuses` moved verbatim from
      `libs/usage-dashboard/src/utils/map-user-usage-to-model-limits.ts`, including both
      `Intl.NumberFormat` instances, `PERIOD_FIELD_MAPPINGS`, `OVERALL_COST_PERIODS`, every helper
      (`getMetricStatus`, `getOverallCostStatus`, `isFiniteLimitStatus`,
      `buildOverallCostPeriodStatus`, `noResetTime`, `buildUnavailableCell`, `buildFiniteMetricCell`,
      `buildCostMetricCell`, `buildPeriodCell`, `getFiniteCellStatuses`, `getRowStatus`,
      `hasUsageAcrossDisplayedPeriods`) and their JSDoc. Substitute `UsageI18nKeys` for
      `USAGE_MODEL_LIMITS_I18N_KEYS` and `ResetTimeDisplay` for `FormatResetTime`. Keep the
      `resolveIconUrl` / `resolveDisplayName` / `t` parameters. Import the `ModelLimit*` types and
      enums from `@epam/ai-dial-usage-dashboard`.
- [x] 2.3 Move `libs/usage-dashboard/src/utils/tests/map-usage-data-to-dashboard.spec.ts` to
      `apps/chat/src/utils/tests/map-usage-data-to-dashboard.spec.ts` and
      `libs/usage-dashboard/src/utils/tests/map-user-usage-to-model-limits.spec.ts` to
      `apps/chat/src/utils/tests/map-user-usage-to-model-limits.spec.ts`. Change **only** import
      paths and the key-const/type substitutions from 2.1–2.2. Do not weaken, delete, or re-scope an
      assertion; DTO fixtures stay as they are and are now legitimately app-side.
- [x] 2.4 Update `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx` to import the three
      adapters from `../../../utils/map-usage-data-to-dashboard` and
      `../../../utils/map-user-usage-to-model-limits`, keeping `ModelLimitsSection` and
      `UsageLimitCardGroup` from `@epam/ai-dial-usage-dashboard`. Leave every `useMemo` dependency
      array, the `formatResetTime` `useCallback`, `resetBoundariesMs`, the `MAX_TIMEOUT_MS` boundary
      timer, the `visibilitychange` re-check, `requestRefresh`/`refreshToken`, the `usageError`
      notification effect, the `isLoading` gate and `memo()` exactly as they are. No new state, hook,
      context, effect or fetch.
- [x] 2.5 Update `apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx`: its
      `vi.mock('@epam/ai-dial-usage-dashboard', ...)` must no longer stub or import the moved
      mappers. Keep role/label/text queries and every behavioural assertion unchanged.

**Verification (slice B)**

```sh
npm run test:file -- apps/chat/src/utils/tests/map-usage-data-to-dashboard.spec.ts
npm run test:file -- apps/chat/src/utils/tests/map-user-usage-to-model-limits.spec.ts
npm run test:file -- apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx
npm run verify:changed
```

## 3. Remove the library's generated-client edges (slice C)

- [x] 3.1 Delete `libs/usage-dashboard/src/utils/` (both modules and their `tests/` folder) and
      remove the seven exports from `libs/usage-dashboard/src/index.ts`.
- [x] 3.2 Remove `"@epam/ai-dial-chat-api-client": "*"` from `dependencies` in
      `libs/usage-dashboard/package.json`. Leave `@tabler/icons-react`, the peer block, `exports`,
      `./styles.css`, `private`, `license`, `description` and the `nx` block untouched — see
      `.claude/rules/libs.md`.
- [x] 3.3 Remove the `../chat-api-client/tsconfig.lib.json` project reference from
      `libs/usage-dashboard/tsconfig.lib.json`, keeping the `../chat-shared/tsconfig.lib.json` one.
- [x] 3.4 Remove the `@epam/ai-dial-chat-api-client` entry from the `test.alias` block in
      `libs/usage-dashboard/vite.config.mts:52-55`, keeping the `@epam/ai-dial-chat-shared` entry and
      its explanatory comment intact.
- [x] 3.5 Add a project-scoped `no-restricted-imports` rule for `@epam/ai-dial-chat-api-client` and
      its subpaths to `libs/usage-dashboard/eslint.config.mjs`, following the pattern-list form the
      root `eslint.config.mjs:92-103` already uses. Leave the existing `@nx/dependency-checks` block
      unchanged — it covers the manifest side of the same boundary.
- [x] 3.6 Run `npm install` at the workspace root to refresh `package-lock.json` metadata for the
      removed dependency edge. No upgrades, no `--force`, no hand-editing of the lockfile. Confirm
      the diff touches only the `libs/usage-dashboard` package entry.
- [x] 3.7 **Architecture guard.** Re-read every remaining file under `libs/usage-dashboard/src/**`
      and confirm it contains no generated-client import, no hardcoded `/api` path, no `server-api`
      import, no app context/hook, no auth/session/cookie/env access, no feature flag, no
      routing/navigation knowledge, no analytics/telemetry client, no storage key, and no
      `react-i18next`. Confirm no copied DTO interface and no hardcoded substitute for
      `DeploymentItemDtoTypeEnum` was introduced anywhere, and that neither `libs/chat-shared` nor
      `libs/chat-hooks` has absorbed the coupling.

**Verification (slice C)**

```sh
npm run test:file -- libs/usage-dashboard/src/components/UsageLimitCard/tests/UsageLimitCard.spec.tsx
npm run test:file -- libs/usage-dashboard/src/components/UsageLimitCardGroup/tests/UsageLimitCardGroup.spec.tsx
npm run test:file -- libs/usage-dashboard/src/components/ModelLimitsSection/tests/ModelLimitsSection.spec.tsx
npm run test:file -- libs/chat-hooks/src/usage/useUsageData/tests/useUsageData.spec.ts
npm run test:file -- apps/chat/src/utils/tests/usage-reset-time.spec.ts
npm exec nx lint usage-dashboard
npm run verify:changed
```

`npm exec nx lint usage-dashboard` must pass with both the new `no-restricted-imports` rule and
`@nx/dependency-checks` active.

## 4. Prove the boundary in built artifacts and a real install (slice D)

- [x] 4.1 Build the library and inspect the emitted output directly: confirm no file under
      `libs/usage-dashboard/dist/` — `.js` or `.d.ts` — contains the string
      `@epam/ai-dial-chat-api-client` or re-exports a generated DTO type name
      (`UserLimitStatsResponseDto`, `DeploymentLimitsResponseDto`, `LimitStatsDto`,
      `DeploymentItemDto`, `DeploymentItemDtoTypeEnum`). Also confirm the stale
      `libs/usage-dashboard/out-tsc/lib/utils/*.d.ts` artifacts are regenerated or removed rather
      than left behind as a misleading declaration surface.
- [x] 4.2 Add `tools/usage-dashboard-consumer-fixture/` following the shape of
      `tools/attachment-canvas-consumer-fixture/project.json` — `pack-lib` (depending on the
      library's `build`), `build`, `verify`, and `test` as `nx:noop` depending on `verify` — with a
      `package.json` carrying `description`, `private: true` and `license: "Apache-2.0"`.
- [x] 4.3 Implement the fixture's script reusing `libs/chat-hooks/e2e-fixtures/harness.mjs`
      (`createTmpRoot`, `createFixtureDir`, `createFixtureDependencyResolver`, `npmInstallFixture`,
      `typecheckFixture`, `bundleFixture`) the way `tools/reusable-workflows-consumer-fixture/
      scripts/run.mjs` does. It must: (a) run the artifact scan from 4.1 as a hard assertion;
      (b) install the packed tarball into a temp tree **outside** the checkout, with only `react`,
      `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit` and their own required peers resolved
      through the harness, and **no** `@epam/ai-dial-chat-api-client`; (c) typecheck and bundle a
      consumer that imports `@epam/ai-dial-usage-dashboard/styles.css` and renders
      `UsageLimitCardGroup` and `ModelLimitsSection` from normalized fixture data; (d) fail with a
      message naming the offending file or missing package. Use the harness's isolated temp dir —
      an in-checkout fixture would resolve peers from the workspace root and pass for the wrong
      reason.
- [x] 4.4 Prove the check actually fails: temporarily reintroduce a generated-client import in
      `libs/usage-dashboard/src/index.ts`, confirm both `npm exec nx lint usage-dashboard` and the
      fixture fail, then revert. A boundary check that has never been seen to fail is not evidence.

**Verification (slice D)**

```sh
npm exec nx build usage-dashboard
npm exec nx run usage-dashboard-consumer-fixture:verify
npm run build:quiet
```

## 5. Documentation, specs, and final review (slice E)

- [x] 5.1 Update `libs/usage-dashboard/README.md`: delete the `## Utilities` section and its three
      subsections; remove `ResetTimeDisplayLike` and `FormatResetTime` from `## Types`; remove the
      `mapUsageDataToDashboard ... gained a required third parameter` line from the BREAKING notice;
      and add a new BREAKING section documenting the seven removed exports with a before/after host
      example (before: `import { mapUsageDataToDashboard } from '@epam/ai-dial-usage-dashboard'`;
      after: the host's own adapter producing the same `UsageLimitCardData[]`, with
      `apps/chat/src/utils/map-usage-data-to-dashboard.ts` named as the reference implementation).
      Confirm every remaining code fence still compiles against the current API, and leave the
      `dial-*` class table unchanged.
- [x] 5.2 Update `docs/architecture.md`: the `@epam/ai-dial-usage-dashboard` row in the libraries
      table and the Settings/Usage paragraph around line 213 must state that the library renders
      normalized display models and that BFF interpretation lives in `apps/chat/src/utils/`.
      `usage-reset-time.ts` keeps its existing description — it has not moved.
- [x] 5.3 Run `npm run docs:install-matrix` and commit the regenerated
      `docs/host-install-matrix.md`, which changes because the library's `dependencies` shrank.
- [x] 5.4 Apply the four delta specs, including the two non-requirement edits flagged in them: the
      `## Purpose` + `**Utilities**` preamble in `openspec/specs/usage-dashboard-lib/spec.md` and the
      `## Purpose` paragraph in `openspec/specs/usage-model-limits/spec.md`. Confirm
      `openspec/specs/usage-data-hook/spec.md`'s "Usage tab renders the aggregate limit cards"
      requirement — which already names `apps/chat/src/utils/map-usage-data-to-dashboard.ts` — is now
      accurate rather than aspirational.
- [x] 5.5 Verify responsive, RTL and a11y parity is unchanged: the Usage screen renders identically
      at mobile and desktop widths and under `dir="rtl"`, and the reset `<time>` elements, the
      visually-hidden `resetAriaLabel` siblings, `progressAriaLabel`, the period-header status
      `aria-label`s and the badge text are all byte-identical to before. No component, class,
      stylesheet or theme token changed, so any difference here is a regression to fix, not a
      finding to record.
- [x] 5.6 Run the five-axis quality review per `.claude/skills/code-review-and-quality/SKILL.md`,
      including the documentation-accuracy gate. Record any pre-existing, unrelated failure
      separately rather than fixing it in this change.
- [x] 5.7 Update the local item-26 entry and the local refactoring index to reflect proposal →
      implementation status truthfully. Keep their Git exclusion; do not reference local planning
      files from the proposal, an issue, or a PR description.

**Verification (slice E — closes the change)**

```sh
npm run validate:docs
npm run verify:full
```

Exactly one `npm run verify:full` closes the change. Merge and release remain separate statuses from
implementation; this change does not publish the package.
