## Why

DIAL Core returns day, week, and month token limits for every deployment, but the usage popover
next to the conversation input shows only the month. `mapDeploymentLimitsToInput`
(`libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts:20`) reads `dto?.monthTokenStats`
and discards the rest before React ever sees it, so `UsageLimitsControl` renders exactly one
progress bar (`apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx:176-199`) and the
trigger ring derives its percentage from the month alone
(`UsageLimitsControl.tsx:112`). A user who is about to hit a daily cap gets no warning until the
request fails.

Reported as [epam/ai-dial-chat#8969](https://github.com/epam/ai-dial-chat/issues/8969): *"Only
monthly token limit left is displayed for model when use model in chat"*.

The same response also carries `resetsAt` on each period stat. Settings → Usage already parses and
renders it (`apps/chat/src/utils/usage-reset-time.ts`, keys `usage.resetsAtLabel` /
`usage.resetsAtAriaLabel`), but the chat popover shows nothing — so even the one limit it does
display never says when it frees up.

## What Changes

- **`libs/catalog` — additive only, catalog output unchanged.**
  - Export `LimitsTab`, `LimitsTabProps`, and `LimitsTabColors` from
    `libs/catalog/src/index.ts`. The component
    (`libs/catalog/src/components/Details/TabsContent/Limits/Limits.tsx:8`) is already
    presentation-only: it takes `CatalogItemLimits`, parameterises every typography class, and
    accepts `colors` through `buildCssVars`. Only the barrel file withholds it.
  - Add optional `resetLabel` / `resetIsoValue` / `resetAriaLabel` to `UsageLimitProgressRow`,
    mirroring `UsageLimitCardData` in `libs/usage-dashboard`. `LimitRow` renders them as a
    `<time dateTime={resetIsoValue}>` line only when present.
  - `libs/chat-hooks/src/catalog/map-deployment-limits-to-catalog.ts` is **not** touched, so the
    catalog details panel emits rows without the new fields and renders byte-for-byte as it does
    today.
- **`libs/chat-hooks` — `mapDeploymentLimitsToInput` reworked.** It returns `CatalogItemLimits`
  (a token group with day/week/month rows plus a `CatalogLimitStatus`) instead of a single
  `MonthlyUsageLimit`. Reset strings arrive through a caller-supplied
  `formatResetTime?: FormatResetTime` callback — the same structural type the usage adapters
  already use (`libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts:29-32`). **BREAKING** for
  the package's public API: `MonthlyUsageLimit` is removed. Its only consumer is `apps/chat`.
- **`apps/chat` — popover renders the list.** `UsageLimitsControl` drops its hand-rolled
  `ProgressBar` + "tokens remaining" line and renders `<LimitsTab>`. The trigger ring's error state
  is driven by `CatalogLimitStatus` across all capped rows instead of the month's `usedPercent`.
  `useDeploymentUsageLimits` passes `formatUsageResetTime` bound to the active locale and `t`.
- **Deliberately out of scope:** `minuteTokenStats` stays hidden (see Non-goals).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-input-usage-limits`: the mapping, trigger, and popover requirements move from a
  single monthly figure to a day/week/month row list with reset lines, a status-driven trigger, and
  `LimitsTab` as the renderer.
- `catalog-item-details-fetch`: the `CatalogItemLimits` row contract gains the optional reset trio,
  and `LimitsTab` becomes a documented public export of `@epam/ai-dial-catalog` reusable outside the
  details panel.
- `usage-period-reset-times`: reset display extends from Settings → Usage to the conversation-input
  popover, and the "no library interprets a timestamp" constraint is stated for `libs/catalog` as
  well as `libs/usage-dashboard`.

## Non-goals

- **Minute limits are not displayed.** `minuteTokenStats` is a rolling-minute counter whose value
  changes between two consecutive popover openings; a row that reads differently every time teaches
  the user nothing about their headroom. Issue #8969's repro step 1 sets a per-minute limit, so this
  part of the report is knowingly left uncovered. Recorded as a decision in `design.md`.
- **The catalog's own Limits tab is unchanged** — no new rows, no reset lines. The user scoped this
  change to the chat surface.
- **No boundary-triggered re-fetch** in the popover. The
  `usage-period-reset-times` timer requirement applies to the Usage tab; the popover already
  refreshes on open and once after a generation ends, which is sufficient for a transient affordance.
- **No backend change.** `apps/chat-api/src/deployments/details/deployments-details.service.ts:505`
  already forwards DIAL Core's response verbatim, and `LimitStatsDto` already types `resetsAt`.
- **No new endpoint, cache, polling, feature flag, or telemetry.**

## Acceptance criteria

1. With a deployment that has day, week, and month token limits configured, opening the popover
   shows three rows, each with its own progress bar, used/total figures, and `$X spent` caption.
2. A row whose stat carries `resetsAt` shows a reset line; a row without one renders exactly as it
   would have otherwise, with no error and no console output.
3. A stat with a total at or above `Number.MAX_SAFE_INTEGER` renders the "Follows cost limit"
   treatment rather than a progress bar, matching the catalog's existing handling.
4. The trigger uses the error state when **any** capped row has reached its limit, not only the
   month.
5. Opening a model's details panel in the catalog produces the same DOM as before this change.
6. `npm run verify:full` and `npm run validate:docs` pass.
7. No new axe violation at WCAG AAA in the popover; the layout holds at mobile width and under
   `dir="rtl"`.

## Alternatives considered

- **Duplicate the row renderer inside `apps/chat`** — keeps `libs/catalog` untouched, but copies
  ~150 lines of `LimitRow` plus the 75%/100% threshold logic in
  `libs/catalog/src/utils/usage-limits.ts`, which then drifts from the catalog. Rejected: the user
  scoped "don't touch the catalog" to its rendered output, and exporting an already-parameterised
  component changes nothing about that output.
- **Move `LimitsTab` into `libs/chat-shared`** — a cleaner home in the abstract, but it is a
  breaking move for `libs/catalog`'s internals and a larger diff for no behavioural gain. Rejected.
- **Keep `mapDeploymentLimitsToInput` returning a monthly model and add sibling fields** — avoids
  the breaking export change, but leaves two shapes for the same data and blocks `LimitsTab` reuse,
  since the component consumes `CatalogItemLimits`. Rejected.
- **Call `mapDeploymentLimitsDtoToCatalogLimits` directly from the popover** — maximum reuse, but it
  emits the catalog's own row set and labels, so adding reset lines or changing the period wording
  for the chat would change the catalog too. Rejected under the same constraint.

## Rollback / backward compatibility

- **Runtime:** no persisted state, no stored schema, no API surface. Reverting the commit restores
  the monthly-only popover; nothing needs migrating.
- **Package API:** removing `MonthlyUsageLimit` from `@epam/ai-dial-chat-hooks` is breaking for an
  external consumer of that named export. `apps/chat` is the only consumer in this repo
  (`apps/chat/src/hooks/useDeploymentUsageLimits.ts`). `libs/catalog`'s changes are purely additive
  — new optional row fields and new barrel exports — so no `@epam/ai-dial-catalog` consumer breaks.

## Impact

- **Code:** `libs/catalog/src/index.ts`, `models/item-details-data.ts`, `models/limits-props.ts`,
  `components/Details/TabsContent/Limits/LimitRow.tsx`;
  `libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts`;
  `apps/chat/src/hooks/useDeploymentUsageLimits.ts`,
  `apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx`.
- **Not touched:** `apps/chat-api/**`, `libs/chat-api-client/**`,
  `libs/chat-hooks/src/catalog/map-deployment-limits-to-catalog.ts`,
  `apps/chat/src/components/CatalogView/CatalogView.tsx`,
  `libs/catalog/src/components/Details/DetailsPanel.tsx`.
- **Library isolation:** `libs/catalog` keeps receiving preformatted strings only — it never sees a
  raw `resetsAt`, a locale, a timezone, or `t`. `libs/chat-hooks` keeps the DTO-shape knowledge it is
  already permitted (AGENTS.md §Library isolation, fourth exception) and takes reset formatting as a
  caller-supplied callback, following the `formatResetTime` pattern `UsageTab` already uses.
- **i18n:** new user-visible strings. Period labels are **not** reused from
  `catalog.details.limits.tokensPerDay/Week/Month`, whose current English values read
  `Last 24 hours` / `Last 7 days` / `Last 30 days` — trailing-window wording that
  `usage-period-reset-times` explicitly forbids for these calendar-anchored stats. Copying it into a
  new surface would propagate a known spec violation. New keys land under
  `conversationInput.usageLimits.*` with calendar wording aligned to `usage.todayTitle` /
  `usage.thisWeekTitle` / `usage.thisMonthTitle`. `usage.resetsAtLabel` and
  `usage.resetsAtAriaLabel` are reused as-is. The catalog's own mislabelling is pre-existing drift,
  recorded in `design.md` and left for a separate change.
- **Docs:** `libs/catalog/README.md` (new public export, new row fields) and
  `libs/chat-hooks/README.md` (changed mapper signature) must be updated in the same commit;
  `npm run validate:docs` enforces both.
- **Scope creep flag:** this change edits two shared libraries. Both edits are additive except the
  `chat-hooks` mapper signature, whose only consumer is `apps/chat`.
