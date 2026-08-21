## 1. Investigation and verification

- [x] 1.1 Re-confirmed `Limits.tsx` (75%/100% thresholds, `isCapped`/`getProgressStatus`) and
      `map-deployment-limits-to-catalog.ts` (`Number.MAX_SAFE_INTEGER` sentinel, cost/number
      formatters) — both unchanged from design.md's citations.
- [x] 1.2 Confirmed `DeploymentIcon`/`InitialsAvatar` props unchanged (`libs/chat-shared/src/components/DeploymentIcon`,
      `.../InitialsAvatar`); `usage-dashboard`'s `package.json` peer deps already list
      `@epam/ai-dial-chat-shared` and `@epam/ai-dial-ui-kit ^0.13.0`.
- [x] 1.3 Verified via MCP: no 2.0 segmented-control replacement exists — `DialSegmentedControl`
      (1.0) confirmed with props `options: SegmentedControlOption<T>[]`, `value: T`,
      `onChange: (value: T) => void`, `disabled?`, `className?`, `ariaLabel?`; `SegmentedControlOption`
      is `{ value: T; label?: ReactNode; icon?: ReactNode; disabled?: boolean }`. `ProgressBar` (2.0)
      props confirmed during propose: `value`, `max = 100`, `size?: ElementSize`, `labelProps?`,
      `valueLabel?`, plus passthrough `aria-valuetext`.
- [x] 1.4 Confirmed `DeploymentItemDto` fields (`id`, `displayName: DeploymentItemDtoDisplayName`,
      `type: DeploymentItemDtoTypeEnum`, `iconUrl`, `displayVersion`) from the generated client
      (`libs/chat-api-client/dist/generated/src/models/index.d.ts`). Corrected design.md/spec/tasks:
      the real filter is `DeploymentItemDtoTypeEnum.Model` (not the backend-only `DeploymentItemType`
      enum), and `displayName` is a `LocalizedText` (`string | Record<string, string>`) requiring
      `resolveLocalizedText(item.displayName, activeLocale) || item.id`, following the exact pattern
      already used at `apps/chat/src/context/DeploymentsContext.tsx:109-130`.

## 2. Library: normalized types

- [x] 2.1 Added `ModelLimitStatus`, `ModelLimitsPeriod`, `ModelLimitMetricKind` enums and
      `ModelLimitMetricCell`, `ModelLimitRow`, `ModelLimitsLabels`, `ModelLimitsColors`,
      `ModelLimitsTypography`, `ModelLimitsStyles`, `ModelLimitsSectionProps` types in
      `libs/usage-dashboard/src/models/model-limits-props.ts`.
- [x] 2.2 Exported all new types/enums from `libs/usage-dashboard/src/index.ts` alongside the
      existing `UsageLimitCardGroup`/`UsageLimitCard` exports.

## 3. Library: ModelLimitsSection component

- [x] 3.1 Implemented the row identity cell (40px avatar via `DeploymentIcon`, model type label,
      inline name/version) inside `ModelLimitsRow.tsx`, using the public typography-class props
      with the established defaults.
- [x] 3.2 Implemented the per-metric `MetricCell` renderer (`ModelLimitsRow.tsx`) for
      `Finite`/`Unlimited`/`Unavailable` kinds, including the clamped-visual (`Math.min(…, 100)`)
      /uncapped-accessible (`aria-valuetext={cell.ariaLabel}`) progress bar via ui-kit `ProgressBar`.
- [x] 3.3 Implemented the row status treatment (`getBadgeClassName`/`getBadgeLabel` in
      `ModelLimitsRow.tsx`) covering all five `ModelLimitStatus` values: default/warning/error
      badges for finite statuses and plain secondary text for `NoLimit`/`Unavailable`.
- [x] 3.4 Implemented the controlled period selector using `DialSegmentedControl` in
      `ModelLimitsSection.tsx`, wired to `period`/`onPeriodChange` with no internal state.
- [x] 3.5 Implemented `ModelLimitsSection`: separately styled heading/count, period selector, and
      the ARIA-grid table (`role="table"/"row"/"columnheader"/"rowgroup"/"cell"`, desktop
      four-equal-columns-plus-160px-status CSS grid via the shared `MODEL_LIMITS_GRID_COLUMNS`
      template, mobile stacked layout with an inline `mobileColumnLabel` caption per cell), per
      design.md Decision 4.
- [x] 3.6 Added `ModelLimitsSection.module.scss` following the three-tier CSS-variable pattern with
      a `--mls-*` variable namespace; wired via `buildCssVars` in `ModelLimitsSection.tsx`.
- [x] 3.7 Verified RTL: no physical-direction utility classes in the new component/SCSS (checked by
      grep); paddings/gaps are symmetric, the row divider uses the direction-agnostic
      `border-block-start`, and no directional icons are used, so no `rtl:` mirroring is needed.
      `npm exec nx lint usage-dashboard` and `npm exec nx run usage-dashboard:build` both pass.

## 4. App: period state and adapter

- [x] 4.1 Added `apps/chat/src/utils/map-user-usage-to-model-limits.ts`: reads `usage.deployments`
      (**corrected mid-implementation from `limits.deployments`** — confirmed against real
      production payloads that `usage.deployments` already carries every stat field the table needs
      for every model the caller has actually used; see design.md's data-source correction). Row set
      and order are exactly `Object.keys(deployments)` (**corrected a second time** — the first cut
      ordered by `items`' catalog order with unmatched deployments appended after, which reshuffled
      visibly once `items` finished loading; see design.md Decision 11). `items` (filtered to
      `DeploymentItemDtoTypeEnum.Model`) is consulted only to enrich a matched row's display
      name/version/avatar, resolving the name through
      `resolveLocalizedText(item.displayName, activeLocale) || item.id`, with the deployment ID as
      the fallback name when unmatched.
- [x] 4.2 Implemented `PERIOD_FIELD_MAPPINGS` (Last24Hours/Last7Days/Last30Days → day/week/month
      Cost/Tokens fields, `requests` key omitted outside Last24Hours so it always falls through to
      `buildUnavailableCell`).
- [x] 4.3 Implemented `buildFiniteMetricCell`/`buildCostMetricCell`/`buildUnavailableCell` —
      finite/unlimited/unavailable classification per metric, with cost always `Unlimited` unless its
      stat entry itself is missing/non-finite (→ `Unavailable`).
- [x] 4.4 Implemented `getMetricStatus` (75%/100% thresholds) and `getRowStatus` (the
      `LimitReached` > `RunningLow` > `WithinLimits` > `NoLimit` > `Unavailable` reduction).
- [x] 4.5 Implemented `costFormatter`/`numberFormatter` (same pattern as
      `map-usage-data-to-dashboard.ts`) and full-value accessible labels via the reused
      `UsageI18nKeys.ProgressAriaLabel`/`UnlimitedProgressAriaLabel`/`UnavailableLabel` keys.
      `npm exec nx run chat:typecheck` and `npm exec nx run chat:lint` both pass (only pre-existing,
      unrelated warnings).

## 5. App: UsageTab integration

- [x] 5.1 Added local `useState(ModelLimitsPeriod.Last24Hours)` (`period`/`setPeriod`) in `UsageTab`.
- [x] 5.2 Rendered `ModelLimitsSection` below `UsageLimitCardGroup`, wired to
      `mapUserUsageToModelLimits`'s output, the period state, and `modelLimitsLabels`; the entire
      dashboard is withheld behind the combined `isUsageLoading || isDeploymentsLoading` state and
      replaced with a visible localized UI-kit `Spinner`. After both requests settle, a localized
      `ModelLimitsEmptyState` message is shown when `modelLimitRows` is empty (covers both
      "`usage.deployments` absent/empty" and "`usage` fetch failed" per the spec, without a
      stale/zeroed table).
- [x] 5.3 Confirmed no new notification path was added — `modelLimitRows`/`period` changes only feed
      `useMemo`, and the only `useEffect` in `UsageTab.tsx` remains the pre-existing
      `limitsError`/`usageError` one; `setPeriod` never touches that effect's dependency array.

## 6. Localization

- [x] 6.1 Added 12 new `UsageI18nKeys` members (`ModelLimitsHeading`, `ModelLimitsEmptyState`,
      `PeriodSelectorAriaLabel`, `ItemColumnLabel`, `CostColumnLabel`, `TokensColumnLabel`,
      `RequestsColumnLabel`, `StatusColumnLabel`, `ModelTypeLabel`, `NoLimitLabel`, `UnavailableLabel`,
      `UnavailableBadgeLabel`) to `translation-keys.ts`. Deliberately did **not** add separate period
      labels or "within limits"/"running low"/"limit reached" badge keys — checked existing
      `UsageI18nKeys` first and reused `TodayPeriodDescription`/`ThisWeekPeriodDescription`/
      `ThisMonthPeriodDescription` (identical "Last 24 hours"/"Last 7 days"/"Last 30 days" text) and
      `DefaultBadgeLabel`/`RunningLowBadgeLabel`/`LimitReachedBadgeLabel`/
      `ProgressAriaLabel`/`UnlimitedProgressAriaLabel` per the no-duplicate-translation-values rule.
- [x] 6.2 Added the corresponding English strings to `en.json`'s existing `usage` namespace.

## 7. Tests

- [x] 7.1 Added `ModelLimitsSection.spec.tsx` (17 tests): row rendering/order, empty rows, heading
      count, per-metric finite/unlimited/unavailable rendering (including the over-100% clamp),
      status treatments (`NoLimit`/`Unavailable` plain text, distinct from `WithinLimits`), controlled period
      selector (real `DialSegmentedControl` click → `onPeriodChange`, no internal state change),
      avatar fallback (`DeploymentIcon` initials), long-name `title` accessibility, semantic roles
      (`table`/`row`/`rowgroup`/`columnheader`/`cell`), named table region, RTL smoke test, and the
      desktop-columnheader + mobile-inline-label information-parity test.
- [x] 7.2 Added `map-user-usage-to-model-limits.spec.ts` (27 tests, renamed/re-sourced alongside the
      `usage.deployments` correction): `usage.deployments` join (zero-usage and unresolved-ID
      fallback rows), non-model item exclusion, row order following `Object.keys(usage.deployments)`
      regardless of `items`' order (rewritten for the row-set/order correction in design.md
      Decision 11), a dedicated test that an accessible-but-unused model never produces a row,
      period-to-field mapping (all three periods, including "no fallback to dayRequestStats"), cost
      always-unlimited-unless-malformed, finite/unlimited/unavailable classification, exact
      75%/100% status boundaries, `NoLimit`/`Unavailable` row reduction, no currency symbol on
      tokens/requests, full-value accessible labels.
- [x] 7.3 Extended `UsageTab.spec.tsx`: visible loading coverage for both the usage request and the
      deployments context (with all dashboard content withheld until both settle); model rows render below the cards from
      `usage.deployments` (mocking `useDeployments`/`ModelLimitsSection` via the new
      `createDeploymentsContextValue` test helper), empty state on empty `usage.deployments`, empty
      state (not a stale table) on a failed **usage** fetch with exactly one notification still shown
      (not a second one from the model-limits section). Also fixed `SettingsPage.spec.tsx`, which
      rendered `UsageTab` without a `DeploymentsContext` mock and started throwing once `UsageTab`
      began calling `useDeployments()`.
- [x] 7.4 Mobile/responsive coverage is the information-parity test in 7.1 (jsdom cannot evaluate
      real viewport/media-query CSS, so "no horizontal overflow at 360px" is verified structurally:
      one mounted tree with `mobile:`/`desktop:` visibility classes, both label copies always
      present in the DOM) plus the existing RTL smoke test.
      `npm exec nx run usage-dashboard:test`, `npm exec nx run usage-dashboard:lint`,
      `npm exec nx run chat:test -- UsageTab`, `npm exec nx run chat:test -- map-user-limits`, and
      `npm exec nx run chat:lint` all pass (0 errors; only pre-existing unrelated warnings).

## 8. Documentation

- [x] 8.1 Updated `libs/usage-dashboard/README.md`: overview paragraph, a new `### ModelLimitsSection`
      usage example, and 10 new `## Types` entries, matching the final prop/type names exactly.
- [x] 8.2 Ran `npm run validate:docs` — passed (42 markdown files; README coverage, H1/package
      identity, lib package metadata, relative links, and README-imports-vs-exports all clean).

## 9. Verification

- [x] 9.1 `npm exec nx run usage-dashboard:lint/test/build` — all pass (32 lib tests).
- [x] 9.2 `npm exec nx run chat:lint`, `npm exec nx run chat:typecheck`, `npm exec nx run chat:test`
      — lint/typecheck clean (0 errors); full test run is 3018 passed / 2 skipped, with exactly two
      pre-existing, unrelated failures confirmed independent of this change via `git stash`
      (`Navigation.spec.tsx` — a mock-shape mismatch from a concurrent commit that landed on this
      branch during this session; `useUsageData.spec.ts` — a separate, occasionally-flaky pre-existing
      test). Along the way, fixed two real regressions this change introduced: `SettingsPage.spec.tsx`
      wasn't mocking the newly-added `useDeployments()` call, and the initial partial-object mock cast
      (`{ items: [] } as ReturnType<typeof useDeployments>`) didn't type-check against the full
      `DeploymentsContextType` — resolved by adding
      `apps/chat/src/context/tests/deployments-context-mock.ts`.
- [x] 9.3 `npm exec nx -- affected --targets=lint/test/build --base=origin/development` (28-29
      affected projects each run) — lint: 0 errors; test: same two pre-existing failures noted above,
      nothing new; build: succeeds for all affected projects including `@epam/chat` and
      `usage-dashboard`.

## 10. Post-completion corrections (user-directed, based on real production payloads)

- [x] 10.1 Expanded `ModelLimitsPeriod` from 3 to 5 values (`LastMinute`, `LastHour` added) in
      `libs/usage-dashboard/src/models/model-limits-props.ts`; updated `PERIOD_ORDER` in
      `ModelLimitsSection.tsx`. Real payloads showed non-sentinel `minuteTokenStats`/
      `minuteCostStats` and the sole `hourRequestStats` granularity were never surfaced.
- [x] 10.2 Made `PeriodFieldMapping.cost`/`.tokens` optional (mirroring the pre-existing optional
      `.requests`) in `map-user-usage-to-model-limits.ts`; added `LastMinute`→`minute*Stats` and
      `LastHour`→`hourRequestStats` mappings, each leaving the other two metrics `Unavailable`.
- [x] 10.3 Added 2 new `UsageI18nKeys` (`PeriodLastMinuteLabel`, `PeriodLastHourLabel`) + `en.json`
      entries + `UsageTab.tsx` `periodLabels` wiring.
- [x] 10.4 Dropped the `GET /api/v1/user/limits` fetch entirely: rewrote `useUsageData.ts` to call
      only `getUserUsage()` (`UseUsageDataResult` now `{ usage, isLoading, usageError }`); dropped
      `map-usage-data-to-dashboard.ts`'s `limits` parameter and its `limits ?? usage` fallback
      (`usage`'s top-level cost fields already carry the real global budget); simplified
      `UsageTab.tsx`'s notification effect to the single `usageError` path; removed the now-
      unreachable `UsageI18nKeys.PartialLoadError` (+ its `en.json` entry). `getUserLimits()` itself
      (`apps/chat/src/server-api/user-limits.ts`) is left in place, unused, per its own capability's
      "wrapper functions MAY be unused" allowance.
- [x] 10.5 Rewrote `useUsageData.spec.ts`, `map-usage-data-to-dashboard.spec.ts`, `UsageTab.spec.tsx`,
      and `SettingsPage.spec.tsx` for the single-fetch contract (dropped partial-vs-full-failure
      tests, now one failure-mode test); added `LastMinute`/`LastHour` mapping tests to
      `map-user-usage-to-model-limits.spec.ts` (29 tests total) and a `periodLabels` fixture update
      to `ModelLimitsSection.spec.tsx`.
- [x] 10.6 Updated `libs/usage-dashboard/README.md` (period list, `## Types` entry) and re-ran
      `npm run validate:docs` — passed.
- [x] 10.7 Updated openspec artifacts: `proposal.md` (two new correction notes, `usage-data-hook`
      added to Modified Capabilities), `design.md` (Decisions 12 and 13, one new Risk/Trade-off),
      `specs/usage-model-limits/spec.md` (5-row period-mapping table + 2 new scenarios),
      `specs/usage-dashboard-lib/spec.md` (5-value enum), and a new
      `specs/usage-data-hook/spec.md` (`## MODIFIED Requirements`, full rewritten blocks for all
      four requirements). `openspec validate --strict` passes.
- [x] 10.8 Re-ran full verification: `chat`/`usage-dashboard` lint (0 errors), typecheck (clean),
      test (3016+ passed; only the two pre-existing failures — `Navigation.spec.tsx` and an
      occasionally-flaky `useUsageData.spec.ts` timing test that passes reliably in isolation —
      both confirmed independent of these changes), and `chat:build` (succeeds).
