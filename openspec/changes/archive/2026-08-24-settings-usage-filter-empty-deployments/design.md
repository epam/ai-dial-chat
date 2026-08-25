## Context

`mapUserUsageToModelLimits` (`apps/chat/src/utils/map-user-usage-to-model-limits.ts`) currently
produces one `ModelLimitRow` per key in `usage.deployments`, unconditionally, and `UsageTab.tsx`
falls back to a plain `<p>` when that array is empty. The existing `usage-model-limits` spec
explicitly protects "a deployment with all-zero used values for the selected period still
appears" (it was written to distinguish "no data" from "zero usage") — this change deliberately
narrows that: a deployment must have nonzero usage *in the selected period* to be shown, because
in practice every deployment the org has ever configured shows up as a permanent zero row once the
period no longer covers its last request, which was the reported UX problem.

## Goals / Non-Goals

**Goals:**

- Hide rows with no cost/token/request usage in the currently selected period, recomputed on every
  period change (no refetch).
- Replace the plain-text empty-state fallback with the established `PanelEmptyState` component so
  the page matches the visual language used by `ScheduledTasks` and sidebar panels.
- Keep all DTO interpretation inside the app-level adapter; `libs/usage-dashboard` keeps rendering
  exactly the rows and count it is given, unchanged.

**Non-Goals:**

- No change to `useUsageData`, `useDeployments`, or any network call — filtering is purely a
  client-side derivation over already-fetched data.
- No change to per-metric classification (finite/unlimited/unavailable), status derivation, or
  formatting — only which *rows* are included.
- No new i18n key is introduced unless product wants period-specific empty-state copy (see Open
  Questions); the existing `ModelLimitsEmptyState` string is reused by default.
- No persistence of the selected period across reload — unchanged from today.

## Decisions

### Decision: Filter on raw `used` values, not on formatted cell output

`mapUserUsageToModelLimits` already reads the raw `LimitStatsDto` for each of
cost/tokens/requests before formatting it into a `ModelLimitMetricCell`. The filter reuses those
same raw stats (`isUsableStats(stats) && stats.used > 0`) rather than re-parsing the formatted
`usedLabel` string. A row is kept when **any** of its three raw stats is usable and has `used > 0`;
it is dropped when all three are either unusable (`unavailable`) or usable with `used <= 0`.

Alternative considered: filtering on the built `ModelLimitMetricCell`s (e.g. `kind === Finite &&
usedPercent > 0`). Rejected because `Unlimited` cost cells never carry `usedPercent`, and parsing
`usedLabel` back into a number would be locale-format-dependent and fragile — the raw DTO value is
already in hand at the point cells are built.

### Decision: Filtering happens in the existing adapter, after row construction

Add the filter as a final `.filter(...)` step inside `mapUserUsageToModelLimits`, keyed off the
same three `deploymentStats[fieldMapping.*]` lookups already used to build the row's cells. This
keeps the "which rows exist" decision in one place (the adapter), consistent with the existing
`usage-model-limits` spec's requirement that row set/order derives only from `usage.deployments`
plus this one new period-scoped condition — no change to `ModelLimitsSection`'s contract (it still
just renders `rows`).

Alternative considered: filtering inside `UsageTab` after calling the adapter. Rejected — it would
split "what counts as usage" logic across two files for no benefit, and the adapter already has
the raw stats in scope.

### Decision (revised): `ModelLimitsSection` renders its own empty state internally, keeping the period selector always visible

**This supersedes the original plan below.** The first implementation had `UsageTab` branch on
`modelLimitRows.length > 0` between `ModelLimitsSection` and a `PanelEmptyState` shown in its
place. That reproduced the original bug in a new component: whenever the filtered rows were empty,
`ModelLimitsSection` — and with it the period `SegmentedControl` — disappeared entirely, so a user
who landed on an empty period had no control to switch to a period that *does* have data. It also
put the empty state outside the section's heading/selector chrome, which read as a stray message on
the page rather than a state of the Model limits table.

`ModelLimitsSection` now always renders its heading and period selector; only the table body swaps
between the row list and `PanelEmptyState` (imported from `@epam/ai-dial-chat-shared`, matching the
`ScheduledTasks` pattern where the lib owns an internal empty-state icon and takes only the label
via props). This requires `ModelLimitsLabels.emptyStateLabel: string` (new, required) and an
optional `emptyStateIconSize?: number` on `ModelLimitsSectionProps` (default `48`), plus
`@tabler/icons-react` as a new peer dependency of `usage-dashboard` for the icon — the same peer
already required by `scheduled-tasks` for its own empty state. `UsageTab` now renders
`ModelLimitsSection` unconditionally and passes `emptyStateLabel` through its existing
`modelLimitsLabels` object; it no longer branches on row count at all.

This keeps the lib's isolation intact: the icon is a generic, host-agnostic glyph chosen by the lib
itself (not passed in as an app-specific asset), and the label is an English-default, host-supplied
string like every other `ModelLimitsLabels` field — no host/API knowledge crosses the boundary.

#### Decision as originally written (superseded)

`UsageTab` already branches on `modelLimitRows.length > 0` to choose between `ModelLimitsSection`
and the plain-text fallback. Swap the fallback branch for `PanelEmptyState` (already used by
`ScheduledTasks` and sidebar panels), passing the existing `ModelLimitsEmptyState` translation as
`label`. This is an app-level change only: `PanelEmptyState` lives in `libs/chat-shared`, which
`apps/chat` already depends on, so no new library dependency or boundary exception is needed.
`libs/usage-dashboard` is a `type:ui` lib and could import `chat-shared` too, but keeping the
empty-state decision in `UsageTab` matches where the `rows.length` gate already lives and avoids
teaching the lib a new "empty" rendering mode for a case it doesn't otherwise need to know about
(zero rows vs. loading vs. error are already all app-level branches in `UsageTab`).

Alternative considered: adding an internal empty state to `ModelLimitsSection` itself (rendered
when `rows` is empty). Rejected — it would require threading label/icon props through the lib for
a state the app can already fully handle at its existing branch point, and `ModelLimitsSection`'s
existing contract ("renders exactly the rows it's given") stays simplest if it never special-cases
an empty array. **(Rejected in error — see the revised decision above: this is exactly what
trapped users on an empty period with no way to change it.)**

### Decision: One empty-state message for both "no deployments at all" and "all filtered out"

Both cases — `usage.deployments` empty, and every entry filtered out for zero usage in the
selected period — render the same `PanelEmptyState`. Distinguishing the two with different copy
would require the adapter to return not just `ModelLimitRow[]` but also a reason code, adding
surface area for a distinction users are unlikely to care about (either way, the table has nothing
to show for the selected period).

## Risks / Trade-offs

- [Hiding the period selector whenever the filtered result is empty traps the user on that period,
  since there is no visible control left to try a different one] → Mitigated by the revised
  decision above: `ModelLimitsSection` always renders its heading and period selector; only the
  table body swaps to the empty state.
- [Users lose visibility into deployments they used outside the selected period, even though the
  data still exists in `usage.deployments`] → Acceptable per proposal: the period selector's whole
  purpose is period-scoped visibility; a user who wants historical models picks "Last 30 days".
- [Switching periods can now change the row *count*, not just the metric values, which existing
  tests/snapshots may assume is stable] → Task list includes updating
  `map-user-usage-to-model-limits` unit tests and any `ModelLimitsSection`/`UsageTab` tests that
  assert row count independent of period.
- [The reused `ModelLimitsEmptyState` copy was written for "no deployments at all" and may read
  oddly for "you have deployments, just none used in this period"] → Flagged as an Open Question;
  default is to ship with the existing copy and revisit wording with product if needed.

## Open Questions

- Should the empty-state copy differ between "no deployments at all" vs. "no usage in this
  period"? Defaulting to the same message (see Decision above) unless product asks for a
  period-aware variant.
