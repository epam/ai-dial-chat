Slicing strategy: vertical — the mapper contract first (lib), then the single app call site, then
docs/i18n cleanup. The code was implemented before this change was written up; tasks record what was
done and how it was verified.

## 1. Mapper: drop cost, add reset line (`libs/chat-hooks`)

- [x] 1.1 In `libs/chat-hooks/src/catalog/map-deployment-limits-to-catalog.ts`, remove
  `DeploymentLimitsLabels.formatSpentCaption`, the `costKey` mappings, `isUsableCostStats`,
  `buildSpentCaption`, and the `formatCost` import; the mapper reads only `day/week/monthTokenStats`
  and sets no `captionLabel`.
- [x] 1.2 Add optional `DeploymentLimitsLabels.formatResetTime?: FormatResetTime` and spread
  `buildResetFields(stats, labels.formatResetTime)` into every row; export `buildResetFields` from
  `libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts` (module-level only, not added to
  `src/index.ts`).
- [x] 1.3 Update JSDoc and the mapping comment to state calendar UTC periods and why cost stats are
  not read.
- [x] 1.4 Architecture guard: the mapper imports no `i18next`, app key enum, `Date`/`Intl.DateTimeFormat`,
  server-api, or generated-client runtime; reset formatting arrives only via the callback.
- [x] 1.5 Tests in `libs/chat-hooks/src/catalog/tests/map-deployment-limits-to-catalog.spec.ts`:
  cost stats produce no caption and no row; each period's reset trio is set on capped and unlimited
  rows; reset fields are absent when the formatter is omitted or returns `undefined`; fixtures use
  Today / This week / This month labels. Drop `formatSpentCaption` from
  `libs/chat-hooks/src/catalog/tests/useCatalogItemDetails.spec.ts`.

  Verification: `npm run test:file -- libs/chat-hooks/src/catalog/tests/map-deployment-limits-to-catalog.spec.ts libs/chat-hooks/src/catalog/tests/useCatalogItemDetails.spec.ts`
  (run as `npm exec nx -- run-many -t test,lint -p @epam/ai-dial-chat-hooks`: 138 files / 2191 tests
  passed, lint 0 errors).

## 2. App call site (`apps/chat`)

- [x] 2.1 In `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`, take
  `tokensPerDay/Week/Month` from `UsageI18nKeys.TodayTitle/ThisWeekTitle/ThisMonthTitle`, remove
  `formatSpentCaption`, and set `formatResetTime` to `formatUsageResetTime` bound to `language` and
  `t` (cast to the plain signature as in `UsageTab`); memo deps become `[t, language]`.
- [x] 2.2 Remove `catalog.details.limits.spentLabel` and
  `catalog.details.limits.tokensPer{Day,Week,Month}` from `apps/chat/src/i18n/locales/en.json` and
  the matching `CatalogI18nKeys` members in `apps/chat/src/constants/translation-keys.ts`. No new
  keys.
- [x] 2.3 RTL: no new markup — the reset line is rendered by the existing `LimitRow` in
  `libs/catalog`, which already uses logical utilities and no directional icon.

  Verification: `npm run test:file -- apps/chat/src/hooks/useCatalogItems` (run as
  `npm exec nx -- test @epam/chat -- useCatalogItems CatalogView`: 4 files / 77 tests passed) and
  `npm exec nx -- run-many -t typecheck,lint -p @epam/chat` (passed, 0 errors).

## 3. Docs

- [x] 3.1 Update the `mapDeploymentLimitsDtoToCatalogLimits` section of `libs/chat-hooks/README.md`
  (calendar periods, reset line, cost ignored; example without `formatSpentCaption`, with
  `formatResetTime`).
- [x] 3.2 Run `npm run validate:docs` (passed, 49 markdown files; install matrix unchanged).

## 4. Close-out

- [x] 4.1 Remove the temporary debug logging added to
  `apps/chat-api/src/deployments/details/deployments-details.service.ts#getDeploymentLimits` during
  diagnosis (file is back to its pre-diagnosis content).
- [x] 4.2 Run `npm run verify:full` once. Typecheck and lint passed; tests had failures unrelated to
  this change: `apps/chat/src/hooks/skills/tests/useSkillFileSystemPicker.spec.ts` fails identically
  with this change stashed, and `@epam/chat-api` (untouched by this change) fails a different
  test set on each full run while `app-config.service.spec.ts` passes in isolation.
