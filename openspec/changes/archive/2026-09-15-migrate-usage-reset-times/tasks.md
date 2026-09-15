## 0. Contract confirmation (non-blocking)

- [ ] 0.1 Raise a documentation request with the DIAL Core team covering: whether `resetsAt` is always sent for day/week/month stats; whether it ever appears on `minuteCostStats`/`hourRequestStats`; whether per-deployment stats carry it; the exact format guarantee (always `Z`, always second precision?); whether it is the exclusive end of the current period; whether the week boundary is always UTC Monday; and whether `@epam/ai-dial-typescript-sdk` will type the field. Record answers in `design.md` §Open Questions and convert any confirmed assumption in the Decision 1 table from assumption to fact.
- [x] 0.2 Capture two real `GET /api/v1/user/usage` payloads from a Core environment — one with `resetsAt` present on every day/week/month stat, one with it absent — and save them as the fixtures every test in this change uses. Do not hand-write payload shapes when a real one can be captured.

## 1. Backend contract

- [x] 1.1 Add `@ApiPropertyOptional({ example: '2026-09-16T00:00:00Z', description: ... }) resetsAt?: string` to `LimitStatsDto` in `apps/chat-api/src/openapi/openapi-response.dto.ts`, documenting it as an optional ISO-8601 UTC instant marking the exclusive end of the stat's current calendar period.
- [x] 1.2 Rewrite the four top-level `*CostStats` `@ApiPropertyOptional` descriptions in the same file from trailing-window wording ("trailing 24 hours", "trailing 7 days", "trailing 30 days") to calendar wording ("current UTC day/week/month"), keeping the existing unlimited-sentinel and global-vs-per-deployment notes intact.
- [x] 1.3 Soften the per-deployment cost note in `UserLimitStatsResponseDto.deployments` from "with an unlimited `total`" to "whose `total` is the unlimited sentinel in every payload observed to date; consumers detect the sentinel rather than assume it", and restate the `deployments` description for `/user/usage` in calendar terms.
- [x] 1.4 Update both `@ApiOperation` descriptions in `apps/chat-api/src/deployments/user-limits.controller.ts` — drop "rolling-usage" and "trailing 30 days", and note that the response forwards Core's `resetsAt` verbatim.
- [x] 1.5 Add an integration test in `apps/chat-api/src/deployments/tests/user-limits.controller.integration.spec.ts` asserting that a mocked Core payload carrying `resetsAt` is forwarded byte-identically, and a second asserting a payload without `resetsAt` returns `200` with the field simply absent.
- [x] 1.6 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 2. Generated client

- [x] 2.1 Run `npm run openapi`, then `npm run openapi:check`. Confirm `resetsAt` appears on `LimitStatsDto` in `libs/chat-api-client/openapi.json` and in `src/generated/src/models/`.
- [x] 2.2 Build and lint `chat-api-client`; confirm `LimitStatsDto.resetsAt` is importable as `string | undefined` from `@epam/ai-dial-chat-api-client`.
- [x] 2.3 Add a short note to `libs/chat-api-client/README.md` (or the change's design doc if the README does not enumerate models) recording the SDK divergence: `@epam/ai-dial-typescript-sdk@0.1.1` does not type `resetsAt`, and `deployments-details.service.ts`'s existing cast is what carries it through.

## 3. App-edge reset-time formatter

- [x] 3.1 Create `apps/chat/src/utils/usage-reset-time.ts` exporting `ResetTimeDisplay` and `formatUsageResetTime(resetsAt, activeLocale, t)` per the `usage-period-reset-times` spec — `Date.parse` with a `NaN` guard, `Intl.DateTimeFormat(activeLocale, { dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'shortOffset' })`, zone resolution in a `try`/`catch`, and `undefined` on every failure path.
- [x] 3.2 Add i18n keys `usage.resetsAtLabel` (`"Resets {{dateTime}}"`) and `usage.resetsAtAriaLabel` (`"Usage resets {{dateTime}}"`) to `apps/chat/src/i18n/locales/en.json` and the `UsageI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`; add the same keys to every other locale bundle.
- [x] 3.3 Write `apps/chat/src/utils/tests/usage-reset-time.spec.ts` covering: a UTC boundary rendered in a non-UTC zone (assert the local wall-clock value, not just "contains a digit"); the same instant under two different zones producing different labels but an identical `resetsAtMs`; a timezone designator always present in `label`; `undefined` for `undefined`, `''`, `'not-a-date'`; `undefined` when `Intl.DateTimeFormat` is stubbed to throw; `isoValue` echoing the input verbatim.
- [x] 3.4 Run `npm run test:file -- apps/chat/src/utils/tests/usage-reset-time.spec.ts`.

## 4. Library prop models and period rename

- [x] 4.1 In `libs/usage-dashboard/src/models/usage-limit-card-props.ts`, add `resetLabel?`, `resetIsoValue?`, `resetAriaLabel?` to `UsageLimitCardData` with JSDoc stating they are host-preformatted strings the library never parses.
- [x] 4.2 In `libs/usage-dashboard/src/models/model-limits-props.ts`, add the same trio to `ModelLimitPeriodStatus`; rename `ModelLimitPeriodStatuses` and `ModelLimitRow` keys `last24Hours`/`last7Days`/`last30Days` to `day`/`week`/`month`; rename `ModelLimitsLabels` fields `last24HoursColumnLabel`/`last7DaysColumnLabel`/`last30DaysColumnLabel` to `dayColumnLabel`/`weekColumnLabel`/`monthColumnLabel`.
- [x] 4.3 Replace every "rolling"/"Last N" phrase in both models' JSDoc with calendar wording (e.g. `ModelLimitRow.day` → "Cost and Tokens metrics for the current UTC day").
- [x] 4.4 Update `ModelLimitsSection.tsx`'s three `PeriodHeader` call sites and its "three rolling periods" JSDoc to the renamed keys and labels; update `ModelLimitsRow.tsx` if it reads the renamed row keys.
- [x] 4.5 Run `npm exec nx lint usage-dashboard` and confirm the rename compiles cleanly inside the lib (app call sites are fixed in step 6).

## 5. Mappers

- [x] 5.1 In `map-usage-data-to-dashboard.ts`, add a `formatResetTime: (resetsAt: string | undefined) => ResetTimeDisplay | undefined` parameter (typed by a locally declared structural interface — the lib must not import an app type), and populate each card's reset trio from its result, leaving all three fields absent when it returns `undefined`. Verify no `Intl`, `Date`, or locale reference is introduced.
- [x] 5.2 In the same file, change the three `titleKey`s from `*PeriodDescription` to the matching `*Title` keys so the card title is the calendar name, and confirm `periodDescription` still carries the accessible period label.
- [x] 5.3 In `map-user-usage-to-model-limits.ts`, rename `PERIOD_FIELD_MAPPINGS` and `OVERALL_COST_PERIODS` keys to `day`/`week`/`month`, thread the same `formatResetTime` callback into `mapOverallCostLimitsToPeriodStatuses`, and populate each period status's reset trio from the matching **top-level** `*CostStats` only.
- [x] 5.4 Replace `buildCostMetricCell`'s unconditional `Unlimited` return with the same `total >= UNLIMITED_TOTAL_THRESHOLD` test the token path uses: sentinel → today's exact `'$X spent'` `Unlimited` cell; finite → a `Finite` cell with `usedPercent`, `status`, `totalLabel` formatted via `formatCost`, and a progress-aware `ariaLabel`. Update the comment above it to describe detection rather than assumption.
- [x] 5.5 Confirm finite cost statuses now reach `getRowStatus` (they flow in through the `Finite` cells) and that `hasUsageAcrossDisplayedPeriods` and row ordering are unchanged.
- [x] 5.6 Update `libs/usage-dashboard/src/index.ts` if any renamed type name is re-exported by name.

## 6. App wiring

- [x] 6.1 In `UsageTab.tsx`, build a `useCallback`-stable `formatResetTime` closing over `activeLocale` and `t`, and pass it into `mapUsageDataToDashboard` and `mapOverallCostLimitsToPeriodStatuses`; add it to both `useMemo` dependency arrays.
- [x] 6.2 Rename the three `modelLimitsLabels` entries to `dayColumnLabel`/`weekColumnLabel`/`monthColumnLabel`.
- [x] 6.3 Change the `usage.todayPeriodDescription` / `thisWeekPeriodDescription` / `thisMonthPeriodDescription` **values** in `en.json` from "Last 24 hours"/"Last 7 days"/"Last 30 days" to calendar wording; keep the keys. Update the same values in every other locale bundle. Re-read `usage.pageDescription` and `usage.overallCostLimitReachedTooltip` and correct any trailing-window implication.
- [x] 6.4 Run `npm run verify:changed`.

## 7. Reset-line rendering

- [x] 7.1 In `UsageLimitCard.tsx`, render the reset line below the existing caption row when `data.resetLabel` is set: a `<time dateTime={data.resetIsoValue}>` inside a muted `dial-tiny-text` row using `--uld-secondary-amount`, with `aria-label={data.resetAriaLabel}` when supplied. Confirm the unlimited branch reaches it too.
- [x] 7.2 In `ModelLimitsSection.tsx`'s `PeriodHeader`, render `periodStatus.resetLabel` as a second line beneath the column label, in the same `<time>` form. Keep `PeriodStatusIndicator` where it is.
- [x] 7.3 Verify the mobile period block in `ModelLimitsRow.tsx` (or wherever the mobile period label renders) also shows the reset line, or record explicitly why it is desktop-only.
- [x] 7.4 Audit every class added in 7.1–7.3 against `.claude/rules/rtl.md`: no `ml-*`/`mr-*`/`pl-*`/`pr-*`/`left-*`/`right-*`/`text-left`/`text-right`, and the line wraps (no `whitespace-nowrap`).
- [x] 7.5 Run `npm exec nx lint usage-dashboard`.

## 8. Boundary re-fetch

- [x] 8.1 Add the `refreshToken = 0` third parameter to `useUsageData`, include it in the effect's dependency array, and stop clearing `usage` on a re-run so the previous response stays rendered while a refresh is in flight. Confirm the hook still contains no timer, clock read, or `resetsAt` reference.
- [x] 8.2 In `UsageTab.tsx`, derive `earliestResetMs` as a `useMemo` over the mapped cards' `resetsAtMs`, ignoring past and absent boundaries.
- [x] 8.3 Add the scheduling effect: `setTimeout` for `earliestResetMs - Date.now() + SETTLE_MS`, delay clamped to `2 ** 31 - 1` with a re-arm (not a re-fetch) on a clamped wake, cleared on unmount and re-derived when `usage` changes; on fire, bump a `refreshToken` state value.
- [x] 8.4 Add a `visibilitychange` listener that, on `visible`, re-fetches when the earliest boundary has already elapsed; remove it on unmount.
- [x] 8.5 Confirm the refresh is silent: the full-tab `Spinner` branch must key off initial load, not a refresh, and the existing `usageError` notification effect must still fire on a failed refresh.
- [x] 8.6 Grep the change's diff for any local zeroing of `used`, restoring of `total`, or synthesized post-reset state and confirm there is none.

## 9. Tests

- [x] 9.1 Extend `libs/usage-dashboard/src/utils/tests/map-usage-data-to-dashboard.spec.ts` with the 0.2 fixtures: reset trio populated from a present `resetsAt`; all three fields absent when `formatResetTime` returns `undefined`; an unlimited card that still carries its reset trio; card titles now reading calendar names.
- [x] 9.2 Extend `libs/usage-dashboard/src/utils/tests/map-user-usage-to-model-limits.spec.ts`: period statuses keyed `day`/`week`/`month`; header reset trio sourced from the top-level stat; a differing per-deployment `resetsAt` ignored for the header; a sentinel cost cell still `Unlimited` with `'$X spent'`; a **finite** cost cell producing `Finite` with the right `usedPercent`, status, and contribution to row status.
- [x] 9.3 Extend `UsageLimitCard.spec.tsx` and `ModelLimitsSection.spec.tsx`: reset line rendered with the correct `<time dateTime>`; nothing rendered when the label is absent; existing assertions for badge, progress, and `aria-valuetext` unchanged.
- [x] 9.4 Extend `libs/chat-hooks/src/usage/useUsageData/tests/useUsageData.spec.ts`: a `refreshToken` bump re-fetches; previous `usage` survives an in-flight refresh; a bump while `enabled: false` does not fetch.
- [x] 9.5 Extend `apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx` with fake timers: a boundary firing triggers exactly one re-fetch; a >24-day month boundary does **not** fire immediately (the `setTimeout` clamp regression); `visibilitychange` after a missed boundary re-fetches; a failed refresh keeps the rendered figures and raises the notification; no timer is armed when no card carries a future `resetsAt`; the full-tab spinner does not reappear on refresh.
- [x] 9.6 Add a timezone-difference test that renders the tab twice under two `TZ`/`Intl` settings and asserts the same UTC boundary produces two different visible labels, each carrying its own zone designator.
- [x] 9.7 Run `npm run verify:changed`.

## 10. Documentation and validation

- [x] 10.1 Update `libs/usage-dashboard/README.md`: the new `UsageLimitCardData` and `ModelLimitPeriodStatus` fields, the renamed `ModelLimitRow`/`ModelLimitPeriodStatuses`/`ModelLimitsLabels` properties with an explicit old → new migration table flagged **BREAKING**, calendar wording throughout, and every code fence updated so it compiles against the new API.
- [x] 10.2 Update `libs/chat-hooks/README.md` for `useUsageData`'s third parameter and its documented refresh semantics.
- [x] 10.3 Update `docs/architecture.md`: the `GET /api/v1/user/usage` endpoint-table row ("trailing 30 days" → calendar wording) and the `@epam/ai-dial-usage-dashboard` library description.
- [x] 10.4 Run `npm run validate:docs` and fix every reported issue.
- [x] 10.5 Run `npm run verify:full` once, then the five-axis review in `.claude/skills/code-review-and-quality/SKILL.md`, including the responsive-parity and documentation-accuracy gates.
- [x] 10.6 Re-read `design.md` §Open Questions against whatever task 0.1 returned and update it before the change is archived.
