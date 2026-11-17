# Tasks

Slicing strategy: **contract-first, then outside-in**.

1. The BFF contract and the operator setting land first and are verified against the generated
   client. Nothing in the UI reads them yet.
2. The pure `chat-hooks` helpers come next.
3. The lib component follows.
4. The app wiring comes last.

Every slice leaves `off` rendering byte-identical to today. The default verification per task is
`npm run test:file -- <spec>`, and `npm run verify:changed` runs at the end of each group.

## 1. BFF contract: `costObject` and `object`

- [x] 1.1 In `apps/chat-api/src/openapi/tests/user-limits-response.schema.spec.ts`, add failing assertions. Verify the test is red with `npm run test:file -- apps/chat-api/src/openapi/tests/user-limits-response.schema.spec.ts`. The assertions are:
  - `UserLimitStatsResponseDto.properties.costObject` is a string and is not in `required`;
  - `BudgetStatsDto.properties.object` is a `oneOf` of a string (`enum: ['*']`) and an array of strings, and is not in `required`.
- [x] 1.2 In `apps/chat-api/src/openapi/openapi-response.dto.ts`, update the DTOs, then verify that 1.1 is green. The changes are:
  - add `costObject?: string` to `UserLimitStatsResponseDto`;
  - add `object?: '*' | string[]` to `BudgetStatsDto`, using the D8 `oneOf`;
  - in `budgets`, `day` and `month`, replace "current UTC day/month" with the rate-limit schedule time zone wording;
  - state that only entries matching `costObject` are charged;
  - update `displayName` to say that Core ≥ #2283 falls back to the policy path.
- [x] 1.3 Extend the pass-through tests in `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts` and `apps/chat-api/src/deployments/tests/user-limits.controller.integration.spec.ts`. Verify both files pass with `npm run test:file`. The tests cover:
  - `costObject` present: forwarded as is;
  - `costObject` absent with `budgets: []`: no key in the response;
  - `object: '*'` stays a string;
  - an `object` list keeps its order.
- [x] 1.4 Run `npm run openapi` and inspect the generated `BudgetStatsDto.object` type. If it is not usable as `string | string[]`, apply the D8 fallback and regenerate. Verify that `npm run openapi:check` passes, and that `git diff libs/chat-api-client/src/generated` shows only the two new properties.
- [x] 1.5 Update the endpoint row descriptions in `docs/architecture.md` to mention `costObject`. Verify with `npm run validate:docs`.

## 2. Operator setting `SPENDING_LIMITS_MODE`

- [x] 2.1 Add the backend `SpendingLimitsMode` enum, and add `SPENDING_LIMITS_MODE?: SpendingLimitsMode = SpendingLimitsMode.Off` with `@IsOptional() @IsEnum` to `apps/chat-api/src/config/env/feature-flags.env.ts`. Update the snapshot in `apps/chat-api/src/config/tests/environment-composition.spec.ts`. Add validation cases to `apps/chat-api/src/config/tests/validation.spec.ts`:
  - unset gives `off`;
  - `enforce` is accepted;
  - `ENFORCE `, `on` and `true` fail.
  - **Verification:** both spec files pass.
- [x] 2.2 Add the registry entry `usageLimits.spendingLimitsMode` to `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` (client visibility, default `off`, `envVar`, and a `managedConfigKey` with an enum string schema), after `usageLimits.warningThresholdPercent`. Verify that `apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts` and `env-resolution-characterization.spec.ts` pass after adding the key to their fixtures.
- [x] 2.3 Add `spendingLimitsMode` to `ClientConfigDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`, with `enum` and `enumName: 'SpendingLimitsMode'`). Add the `defineMapping` and the default in `apps/chat-api/src/app-config/client-config.mapper.ts`, falling back to `off` with a warning. Verify that `apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts` covers default, configured, invalid→`off`, and that managed applies when env is unset.
- [x] 2.4 Bump the managed contract to `1.1.0` (MINOR): update `MANAGED_CONFIG_SCHEMA_VERSION` and `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS`, run `npm run managed-config-schema`, and add the new pin to `PINNED_MANAGED_CONFIG_SCHEMA_SHA256` in `apps/chat-api/src/app-config/managed-config/managed-config.constants.ts`. First check `openspec/changes/consume-managed-app-config-snapshots` for a concurrent bump. Verify that the managed-config schema artifact tests pass and that 1.0.0 fixtures still validate.
- [x] 2.5 Run `npm run openapi` for the client-config field and verify `npm run openapi:check`. Document `SPENDING_LIMITS_MODE` in the `apps/chat-api/README.md` env table, stating that it must equal DIAL Core's `spendingLimits.mode` and what each value does to the Usage page, banner and dial. Add the commented line to `apps/chat-api/.env.template`. Verify with `npm run validate:docs`.
- [x] 2.6 In `apps/chat/src/context/AppConfigContext.tsx`, expose `config.spendingLimitsMode: SpendingLimitsMode`, imported from `@epam/ai-dial-chat-hooks/usage` and parsed with an `off` fallback. This depends on 3.1, so do it after 3.1 or land 3.1 first. Verify with `apps/chat/src/context/tests/AppConfigContext.spec.tsx` cases: before load, omitted, `enforce`, and an unknown string.

## 3. `chat-hooks` usage helpers

- [x] 3.1 Add `libs/chat-hooks/src/usage/spending-limits-mode.ts`, containing the `SpendingLimitsMode` enum, `resolveSpendingLimitsMode(configured, usage)` and `omitAccountCostStats(usage)`. Export them from the `./usage` entry. Verify that `libs/chat-hooks/src/usage/tests/spending-limits-mode.spec.ts` covers every scenario of "Effective spending limits mode", and that the helper keeps `deployments` and token stats while dropping the four `*CostStats`.
- [x] 3.2 Widen `AccountUsage` in `libs/chat-hooks/src/usage/useDeploymentUsageLimits/useDeploymentUsageLimits.ts` to include `costObject` and `budgets`. Verify that the existing hook and mapper specs still pass and that `npm exec nx run chat-hooks:typecheck` succeeds.
- [x] 3.3 Add `mapBudgetsToDashboard(usage, t, formatResetTime, resolveModelName)` and the i18n key const `BUDGET_DATA_I18N_KEYS` to `libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts`, next to the private `mapStatsToCardData` they reuse (a separate module would have had to export it through the root `export *`), returning `SpendingBudgetData[]`. Verify with `libs/chat-hooks/src/usage/tests/map-budgets-to-dashboard.spec.ts`, which covers:
  - charged-only filtering;
  - order;
  - duplicate policy keys;
  - `displayName` blank → `policy`;
  - sentinel windows;
  - over-budget (105%);
  - `object: '*'`, a list with an unknown id, and absent;
  - reset trio passthrough.
  - The existing `map-usage-data-to-dashboard.spec.ts` stays green, unchanged.
- [x] 3.4 Add the optional `spendingLimitsMode` option to `useUsageLimitBanner` (`libs/chat-hooks/src/usage/useUsageLimitBanner/useUsageLimitBanner.ts`). It resolves the effective mode from `sources.account` and applies `omitAccountCostStats` before selection. Verify that `useUsageLimitBanner.spec.ts` covers:
  - in `enforce`, a 95% account cost gives no banner;
  - in `enforce`, a 100% token limit still shows the banner;
  - `shadow` and omitted are unchanged.
- [x] 3.5 Document the new exports and the `AccountUsage` widening in `libs/chat-hooks/README.md`. Verify with `npm run validate:docs` and `npm run validate:lib-duplicates`.

## 4. `usage-dashboard` `SpendingBudgetsSection`

- [x] 4.1 Add the `libs/usage-dashboard/src/models/spending-budgets-props.ts` types. Add `libs/usage-dashboard/src/components/SpendingBudgetsSection/SpendingBudgetsSection.tsx` and its `.module.scss`, built on `UsageLimitCard` and the shared card-group grid, with a `Notification` (info, `role="note"`) for the notice. Add the `budgets` and `budget` entries to `USAGE_DASHBOARD_CLASS`, and export everything from `libs/usage-dashboard/src/index.ts`. Confirm the kit props via `getEntityDetails` for `Notification` and the typography scale before writing defaults. Verify that `SpendingBudgetsSection.spec.tsx` covers every scenario in the `usage-dashboard-lib` delta: order, empty with and without a label, color/typography/card-style forwarding, section/group/heading roles, and no physical-direction classes.
- [x] 4.2 Update `libs/usage-dashboard/README.md` with a component subsection, a usage example that compiles, the `*Colors` fields with defaults, and the class table. Update the `package.json` description to cover budgets. Verify with `npm run validate:docs` and the `lib-theming` audit of `libs/usage-dashboard`.

## 5. App wiring

- [x] 5.1 Add `usage.budgets.*` to `apps/chat/src/i18n/locales/en.json` and the matching `UsageI18nKeys` members in `apps/chat/src/constants/translation-keys.ts`, reusing the existing Today and This month keys. Verify with `npm run test:file -- apps/chat/src/constants` (key/locale parity) and the `i18n-strings` audit for `apps/chat`.
- [x] 5.2 In `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`:
  - resolve the effective mode from `useAppConfig().config.spendingLimitsMode` and `usage`;
  - build `resolveModelName` from `useDeployments()` with `resolveLocalizedText`;
  - memoise `mapBudgetsToDashboard`;
  - render the layout per mode (shadow notice; enforce shows the budgets only, with the empty state);
  - pass `omitAccountCostStats(usage)` to `mapOverallCostLimitsToPeriodStatuses` in `enforce`;
  - concatenate budget `resetIsoValue`s into `resetBoundariesMs`.
  - **Verification:** `apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx` covers:
    - `off`, compared against the existing snapshot or assertions;
    - `shadow` order and notice;
    - `enforce` showing budgets only (no role cost card for a finite or unlimited limit), the empty state, and no header indicators;
    - a missing `costObject` → `off`;
    - the timer arming at the earliest budget reset.
- [x] 5.3 In `apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx`, pass `spendingLimitsMode` from `useAppConfig()` to `useUsageLimitBanner`. Verify that `UsageLimitBanner.spec.tsx` covers `enforce` with a high account cost rendering no banner.
- [x] 5.4 In `apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx`, apply the effective mode and `omitAccountCostStats` to `sources.account` inside the existing mapping `useMemo`. Verify that `UsageLimitsControl.spec.tsx` covers `enforce` listing no cost group and `shadow` unchanged.
- [ ] 5.5 Check mobile and desktop parity of the Usage page in all three modes with the `responsive-design` workflow, including Arabic RTL. Verify through the Playwright or `run` skill screenshots at phone and desktop widths, with no horizontal scroll.
  - **Deferred to the PR:** needs the running app against a DIAL Core that reports budgets. The section uses only `flex`/`gap` layout and the shared card grid, with no physical-direction class or directional icon (covered by `SpendingBudgetsSection.spec.tsx`), but no screenshot check was made.

## 6. Integration

- [ ] 6.1 Run `npm run verify:full`, `npm run validate:specs`, `npm run validate:docs`, `npm run validate:lib-duplicates` and `npm run openapi:check`. All must pass.
  - **Status (2026-11-17):** `validate:specs`, `validate:docs`, `validate:lib-duplicates` and `openapi:check` pass, as does typecheck for `chat-api`, `chat-hooks` and `usage-dashboard`. `verify:full` stops at `@epam/chat:typecheck` on `OnboardingHints` (`@epam/ai-dial-onboarding-tour` is not linked in the local `node_modules`), which this change does not touch. Re-run after `npm install`.
- [ ] 6.2 Do an end-to-end check against a DIAL Core build with #2284 in `shadow`. Verify that the BFF `/api/v1/user/usage` body carries `costObject` and `object`, and that the Usage page shows the charged budgets with correct names, coverage and figures. Record the result in the PR.
  - **Deferred to the PR:** needs a DIAL Core build with #2284.

## Workflow follow-up

- Open a DIAL Core issue asking to report `spendingLimits.mode` on `/v1/user/usage`, so the chat setting can become an override.
- Follow-up change: a budget-aware composer banner and dial, and recognising budget `429`s in the conversation.
- Archive the change after review (`opsx:archive`); archive syncs the three delta specs into `openspec/specs/`.
