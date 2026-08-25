## 1. Adapter: filter rows with no usage in the selected period

- [x] 1.1 In `apps/chat/src/utils/map-user-usage-to-model-limits.ts`, inside
      `mapUserUsageToModelLimits`, capture the three raw `LimitStatsDto | undefined` values
      already looked up for `fieldMapping.cost` / `.tokens` / `.requests` before they're passed to
      `buildCostMetricCell` / `buildFiniteMetricCell`, so the filter can reuse them without
      re-fetching or re-deriving anything.
- [x] 1.2 Add a `hasUsageInPeriod` check per candidate row: `true` if any of those three raw stats
      is usable (`Number.isFinite(total) && Number.isFinite(used)`, i.e. `isUsableStats`) and has
      `used > 0`; `false` otherwise.
- [x] 1.3 Filter the mapped array to rows where `hasUsageInPeriod` is `true` before returning, so
      row set and order still follow `Object.keys(deployments)` order among the surviving rows.
- [x] 1.4 Update the function's JSDoc to state that the returned rows are additionally scoped to
      the selected period's usage (per `specs/usage-model-limits/spec.md`'s new "Rows with no usage
      in the selected period are excluded" requirement).

## 2. ModelLimitsSection: internal empty state, selector always visible

Superseded plan: the original task 2 had `UsageTab` swap `ModelLimitsSection` for a standalone
`PanelEmptyState` whenever rows were empty. That hid the period `SegmentedControl` along with the
table, trapping the user on an empty period with no control to pick a different one, and rendered
the empty state outside the section's own heading/selector chrome. Fixed by moving the empty state
inside `ModelLimitsSection` itself, per the revised design.md decision.

- [x] 2.1 In `libs/usage-dashboard/src/models/model-limits-props.ts`, add
      `emptyStateLabel: string` to `ModelLimitsLabels` and optional
      `emptyStateIconSize?: number` to `ModelLimitsSectionProps` (JSDoc'd, default documented as
      `48`).
- [x] 2.2 In `libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsSection.tsx`,
      import `PanelEmptyState` from `@epam/ai-dial-chat-shared` and `IconChartBar` from
      `@tabler/icons-react`; destructure `emptyStateIconSize = 48`; when `rows.length === 0`,
      render `<PanelEmptyState icon={<IconChartBar aria-hidden size={emptyStateIconSize}
      stroke={1} />} label={labels.emptyStateLabel} />` in place of the column-header row and
      `rowgroup`, while the heading and `SegmentedControl` continue to render unconditionally
      above it.
- [x] 2.3 Add `@tabler/icons-react` (`^3.44.0`, matching `libs/scheduled-tasks/package.json`) as a
      peer dependency in `libs/usage-dashboard/package.json`.
- [x] 2.4 In `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx`, remove the
      `modelLimitRows.length > 0 ? <ModelLimitsSection ... /> : <PanelEmptyState ... />` branch —
      render `<ModelLimitsSection rows={modelLimitRows} ... />` unconditionally — and add
      `emptyStateLabel: t(UsageI18nKeys.ModelLimitsEmptyState)` to the existing
      `modelLimitsLabels` object. Remove the now-unused `PanelEmptyState`/`IconChartBar` imports
      from `UsageTab.tsx`.
- [x] 2.5 Update `libs/usage-dashboard/README.md`: document `emptyStateLabel` in the
      `ModelLimitsLabels` example and type list, document `emptyStateIconSize` in
      `ModelLimitsSectionProps`, add `@tabler/icons-react` to Peer Dependencies, and note that the
      heading/selector stay visible when `rows` is empty. Run `npm run validate:docs`.

## 3. Tests

- [x] 3.1 Update/add unit tests for `mapUserUsageToModelLimits` covering the new spec scenarios:
      row kept when only one of cost/tokens/requests has `used > 0`; row excluded when all mapped
      entries are zero or unavailable for the period; switching `period` changes which rows are
      included (same deployment, different periods) without any new fetch; classification/format
      of an included row's cells is unchanged by the filter.
- [x] 3.2 Update any existing `UsageTab` / `ModelLimitsSection` integration test that currently
      asserts a fixed row count independent of period, to account for period-scoped filtering.
      (No such test existed — the one row-rendering test already used `used: 1` fixtures, which
      remain included under the new filter.)
- [x] 3.3 Add a `UsageTab` test asserting the empty-state label renders (via the mocked
      `ModelLimitsSection`) when `modelLimitRows` is empty, for both the empty-`usage.deployments`
      and all-filtered-out-by-period cases.
- [x] 3.4 Update `libs/usage-dashboard/src/components/ModelLimitsSection/tests/ModelLimitsSection.spec.tsx`:
      add `emptyStateLabel` to the test `labels` fixture; update the empty-rows test to assert the
      empty-state label renders alongside the still-present heading and period selector; add a
      test that selecting a period from the empty state still calls `onPeriodChange`.

## 4. Verification

- [x] 4.1 `npm exec nx test chat` — 212 test files, 3061 passed, 2 skipped.
- [x] 4.2 `npm exec nx lint chat` — 0 errors, 40 pre-existing warnings unrelated to this change.
- [x] 4.3 `npm exec nx typecheck chat` (or the project's equivalent typecheck target) — passes.
- [x] 4.5 `npm exec nx test usage-dashboard` — 33 tests passed (18 in `ModelLimitsSection.spec.tsx`).
- [x] 4.6 `npm exec nx lint usage-dashboard` and `npm exec nx typecheck usage-dashboard` — both pass.
- [x] 4.7 `npm run validate:docs` — passes (42 markdown files checked) after the
      `libs/usage-dashboard/README.md` and `package.json` updates.
- [x] 4.4 Manually verify in the browser: open Settings → Usage, switch between Last minute/Last
      hour/Last 24 hours/Last 7 days/Last 30 days, confirm rows with no usage in the selected
      period disappear while the heading count matches the visible rows, confirm the empty state
      renders (with the expected label and icon) when a period has no usage across all
      deployments, and confirm the period selector stays visible and clickable from that empty
      state so a different period can be picked without leaving the page.
