## Context

Settings → Usage is assembled from four layers:

| Layer | File | Role today |
| --- | --- | --- |
| Core | `GET /v1/user/usage` | Source of truth for usage figures |
| BFF | `apps/chat-api/src/deployments/details/deployments-details.service.ts` → `user-limits.controller.ts` | Pass-through proxy; casts the SDK payload to `UserLimitStatsResponseDto` and forwards it unmodified |
| Contract | `apps/chat-api/src/openapi/openapi-response.dto.ts` → `libs/chat-api-client` | Hand-authored `LimitStatsDto { total: number; used: number }`, mirrored into the generated client |
| App edge | `libs/usage-dashboard/src/utils/map-*.ts`, invoked from `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx` | Turns DTOs into preformatted display data |
| UI | `libs/usage-dashboard` components | Renders only what the mappers hand it — no DTO knowledge |

The mappers live inside `libs/usage-dashboard` but are pure functions over the generated client's
types; `UsageTab` supplies `t`, `activeLocale`, `resolveCatalogIconUrl` and `resolveLocalizedText`.
That is the boundary this change must respect: components never see a raw timestamp.

Three facts drive the design.

1. **`resetsAt` is not verifiable in-tree.** `@epam/ai-dial-typescript-sdk@0.1.1` types both
   `CostItemLimitStats` and `ItemLimitStats` as `{ total?: number; used?: number }`.
   `libs/chat-api-client/openapi.json` has no `resetsAt`. A repo-wide search finds zero occurrences.
   The only evidence is the reported Core behaviour and the sample timestamps.
2. **The periods were never rolling.** `2026-09-16T00:00:00Z` / `2026-09-21T00:00:00Z` /
   `2026-10-01T00:00:00Z` are a UTC midnight, a UTC Monday midnight, and a UTC month start. The
   "Last 24 hours / Last 7 days / Last 30 days" labels — and `last24Hours`/`last7Days`/`last30Days`
   property names threaded through both mappers, both prop models, and `ModelLimitsSection` — encode
   an assumption that was wrong before this change and is now demonstrably wrong.
3. **Per-deployment cost has no configurable cap in Core's role model.** Core's `Role` carries a
   role-level `costLimit { minute, day, week, month }` and a per-deployment
   `limits: Map<String, Limit>` where `Limit` is `{ minute, day, week, month, requestHour,
   requestDay }` — token and request windows, no cost field. `buildCostMetricCell` therefore
   unconditionally emits an `Unlimited` cell and ignores `stats.total` entirely.

## Goals / Non-Goals

**Goals:**

- Carry Core's `resetsAt` end to end without the BFF interpreting it.
- Replace rolling-window vocabulary with calendar-period vocabulary in labels, property names, DTO
  descriptions, JSDoc, READMEs and `docs/architecture.md`.
- Show, for every aggregate cost card and every Model-limits period header, when the period resets —
  localized, in the viewer's timezone, with the timezone stated.
- Re-fetch usage from Core when the earliest displayed boundary elapses.
- Keep every current invariant intact: field mapping, the `>= 2^53` sentinel, status thresholds,
  row filtering, accessible labels.

**Non-Goals:**

- Adding reset-time UI to the header `UsageLimitsControl` popover or `libs/catalog`'s Limits tab.
- Displaying `minuteCostStats`, `hourRequestStats`, `dayRequestStats`, or `minuteTokenStats`, none of
  which the Usage tab renders today.
- Countdown timers ("resets in 4h 12m") — see Decision 5.
- Upgrading `@epam/ai-dial-typescript-sdk` — see Decision 1.
- Any server-side caching of usage. `Cache-Control: private, no-store` and the no-cache rule in
  `user-usage-limits-api` stand unchanged.

## Decisions

### Decision 1 — Hand-author `resetsAt` on the DTO; tolerate the SDK gap

`LimitStatsDto` gains `@ApiPropertyOptional() resetsAt?: string`. The SDK is not bumped.

`deployments-details.service.ts` already returns `result.data as unknown as
UserLimitStatsResponseDto`, so a field the SDK does not type still reaches the client at runtime —
the cast is what makes the gap survivable. The DTO is the contract `apps/chat` compiles against, and
regenerating `libs/chat-api-client` from it is what the frontend needs.

*Alternatives considered.* **Bump the SDK** — correct once a version ships `resetsAt`, but an SDK
major touches every Core-backed endpoint in `chat-api` and no such version is known to exist.
**Block until Core publishes an updated spec** — ships nothing and leaves users with the wrong
period labels, which are wrong independently of `resetsAt`.

*Consequence.* A divergence is recorded in `tasks.md` as a documentation request: Core must confirm
`resetsAt`'s presence rules (always sent for day/week/month? ever on `minuteCostStats`? on
per-deployment stats as well as top-level?), its format guarantee, and whether the SDK will type it.
Until that lands, every consumer treats `resetsAt` as *optional and untrusted* — which the
degradation rules in Decision 4 already require.

**What the captured payload establishes.** A real `GET /api/v1/user/usage` response was captured
from a Core environment on 2026-09-15 (13 deployments) and is stored, with a derived
`resetsAt`-stripped counterpart, in `fixtures/`. It converts most of this change's original
assumptions into observed facts:

| Statement | Status | Basis |
| --- | --- | --- |
| `resetsAt` is an ISO-8601 instant with an explicit UTC designator, at second precision | **Fact** | Every value in the capture is of the form `2026-09-16T00:00:00Z` |
| It appears on `dayCostStats`, `weekCostStats`, `monthCostStats` and their token counterparts | **Fact** | Present on all three cost and all three token stats, and additionally on `dayRequestStats` |
| It never appears on the sub-day windows | **Fact** | `minuteCostStats`, `minuteTokenStats`, and `hourRequestStats` carry it nowhere in the capture |
| Per-deployment stats carry it too | **Fact** | All 13 deployments carry it on their day/week/month stats |
| It marks the **exclusive end** of the current period (usage resets *at* that instant) | Consistent, not proven | The capture's own "today" is 15 Sep and its day boundary is `2026-09-16T00:00:00Z`; only Core's own documentation can make this a guarantee |
| The week boundary is a UTC Monday | Observed in one environment | `2026-09-21` is a Monday; whether it is configurable per Core deployment is still unknown |
| It is optional — Core may omit it | **Still an assumption** | The available environment always sends it, so an omitting payload could not be captured. Every consumer treats it as optional regardless, per Decision 4 |
| The top-level cost budget may be finite | **Fact** | `dayCostStats.total: 110` and `monthCostStats.total: 500` are finite while `weekCostStats.total` is the sentinel — a single payload mixes finite and unlimited aggregate periods |
| Per-deployment cost `total` is the unlimited sentinel | Observed, not guaranteed | All 13 deployments report the sentinel for every `*CostStats`, which is why Decision 6 detects it rather than assuming it |

### Decision 2 — Rename the period keys to `day` / `week` / `month`

`last24Hours` / `last7Days` / `last30Days` become `day` / `week` / `month` in
`ModelLimitPeriodStatuses`, `ModelLimitRow`, `ModelLimitsLabels` (`dayColumnLabel` etc.), and the
internal `PERIOD_FIELD_MAPPINGS` / `OVERALL_COST_PERIODS` tables. The i18n values behind
`usage.todayPeriodDescription` / `thisWeekPeriodDescription` / `thisMonthPeriodDescription` change
from "Last 24 hours" / "Last 7 days" / "Last 30 days" to calendar wording; the **keys stay**, so
other locale bundles do not need new keys, only retranslated values.

A rename is warranted rather than a doc-only fix because the names appear in a **published
package's public API** (`@epam/ai-dial-usage-dashboard`), where a consumer reading
`row.last30Days` reasonably concludes it holds a 30-day trailing window. This is the BREAKING change
flagged in the proposal; the README's migration note is part of the same change.

*Alternative considered.* Keep the names, fix only the visible labels. Cheaper, but it leaves the
exact wrong-assumption-encoded-in-an-identifier that caused this bug class, in a package other teams
consume.

### Decision 3 — Normalize and format reset times at the app edge; pass strings into the lib

A new `apps/chat/src/utils/usage-reset-time.ts` owns every `Date`/`Intl` call:

```ts
export interface ResetTimeDisplay {
  /** Exclusive end of the period, as an epoch ms value, for boundary scheduling. */
  resetsAtMs: number;
  /** Machine-readable instant for a <time dateTime> attribute, e.g. '2026-09-16T00:00:00Z'. */
  isoValue: string;
  /** Visible label, e.g. 'Resets 16 Sept at 03:00 (GMT+3)'. */
  label: string;
  /** Accessible expansion with the full zone name. */
  ariaLabel: string;
}
```

It parses with `Date.parse`, rejects `NaN`, formats with
`new Intl.DateTimeFormat(activeLocale, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'shortOffset' })`,
and resolves the zone via `Intl.DateTimeFormat().resolvedOptions().timeZone` inside a `try`/`catch`
— the same defensive shape as `libs/chat-hooks/src/shared/browser-timezone.ts`, which exists because
embedded and restricted runtimes expose incomplete `Intl` implementations. A throw anywhere in the
chain yields `undefined`, which Decision 4 treats as "no reset time".

`UsageLimitCardData` gains `resetLabel?: string` / `resetIsoValue?: string` /
`resetAriaLabel?: string`; `ModelLimitPeriodStatus` gains the same trio. Both are plain preformatted
strings. `libs/usage-dashboard` therefore never imports `Intl`, never sees a locale, and never sees
a raw timestamp — consistent with AGENTS.md §Library isolation and with how the lib already receives
`iconUrl` and `displayName` pre-resolved.

The mappers (`map-usage-data-to-dashboard.ts`, `map-user-usage-to-model-limits.ts`) live in the lib
but are pure; they must not call the formatter themselves. Instead `UsageTab` passes a
`formatResetTime: (resetsAt: string | undefined) => ResetTimeDisplay | undefined` callback into both
mappers, matching the existing `resolveIconUrl` / `resolveDisplayName` callback pattern in
`mapUserUsageToModelLimits`.

The components are named individually rather than through `dateStyle: 'medium'` /
`timeStyle: 'short'` — the shorthands this design originally specified — because ECMA-402 forbids
combining either style shorthand with `timeZoneName`. `new Intl.DateTimeFormat(locale, { dateStyle:
'medium', timeStyle: 'short', timeZoneName: 'shortOffset' })` throws
`TypeError: Can't set option timeZoneName when dateStyle is used`, and since the formatter returns
`undefined` whenever `Intl` throws, that call would have rendered the reset affordance permanently
dead on every platform. The explicit components reproduce the same medium-date / short-time output
(`Sep 16, 2026, 2:00 AM GMT+2`) and carry the offset. `timeStyle: 'long'` was the alternative — it
embeds the zone legally, but appends a meaningless `:00` seconds field to a midnight boundary.

*Alternative considered.* Let the lib format from a raw ISO string plus a `locale` prop. Rejected: it
puts locale and timezone knowledge inside a host-agnostic package and makes the lib's output
untestable without a fixed system clock.

### Decision 4 — Degradation is uniform and always silent

| Input | Behaviour |
| --- | --- |
| `resetsAt` absent | No reset affordance. Card/header renders exactly as today. |
| `resetsAt` unparseable (`Date.parse` → `NaN`) | Same as absent. No error, no notification. A malformed timestamp must never cost the user their usage figures. |
| `resetsAt` in the past on arrival | Rendered anyway, verbatim from Core, with no boundary timer armed. A past boundary means Core's own figures are what they are; the UI must not imply a reset the payload does not reflect. |
| `resetsAt` differs between top-level and per-deployment stats for the same period | Each is displayed against its own stat. The aggregate card shows the top-level value; the Model-limits period header shows the top-level value (it indicates the overall cost budget, per the existing `mapOverallCostLimitsToPeriodStatuses` contract). No reconciliation, no "most conservative wins". |
| `Intl` throws | Same as absent. |

The unifying rule: **a reset time is decoration on a usage figure, never a gate on it.** No
degradation path may hide, blank, or alter `used` / `total`.

### Decision 5 — Boundary re-fetch, not a countdown

`useUsageData` gains a `refreshToken` parameter (a number; changing it re-runs the existing effect,
which already has cancellation via the `cancelled` flag). It gains no timer of its own — the hook
stays a pure fetch-on-demand primitive and continues to take `getUserUsage` as a parameter rather
than constructing a client.

`UsageTab` owns the scheduling:

- Compute `earliestResetMs = min(resetsAtMs)` across the day/week/month aggregate cards.
- If it is in the future, `setTimeout` for `earliestResetMs - Date.now() + SETTLE_MS`, where
  `SETTLE_MS` is a small grace period so Core has rolled the window over before we ask.
- On fire, bump `refreshToken`. Clear the timer on unmount and whenever `usage` changes.
- Clamp the delay to `2 ** 31 - 1` (`setTimeout`'s 32-bit ceiling — a month boundary can exceed it;
  an unclamped delay fires *immediately*, producing a refetch storm). When clamped, the timer
  re-arms on wake rather than refetching.
- Re-check on `visibilitychange` → `visible`: a laptop asleep across midnight has a timer that fired
  late or not at all, and the elapsed-boundary check is cheap.

Usage figures are **only** ever replaced by a resolved `getUserUsage()` response. Nothing in this
change zeroes a `used`, restores a `total`, or synthesizes a post-reset state locally. If the
re-fetch fails, the existing `usageError` path applies and the previously rendered figures stay on
screen.

*Alternative considered.* A live countdown ("resets in 4h 12m"). Rejected: it needs a per-second
interval on a settings page, it is the single most common place to accidentally drift from
server truth, and it reads poorly to screen readers as an `aria-live` region.

### Decision 6 — Per-deployment cost becomes sentinel-detected

`buildCostMetricCell` currently ignores `stats.total` and always returns an `Unlimited` cell, on the
documented premise that per-deployment cost `total` "is always the unlimited sentinel". Core's role
model (see Context, fact 3) supports that premise today — there is no per-deployment cost limit to
configure. But the premise is an inference from a schema, the code hard-codes it, and requirement 7
asks for finite per-model cost support if the contract allows it.

The change: apply the same `total >= UNLIMITED_TOTAL_THRESHOLD` test the token path already uses. A
sentinel total keeps today's exact `'$X spent'` `Unlimited` cell; a finite total produces a `Finite`
cell with progress and a status, which `getRowStatus` then folds in like any other finite metric.
Because Core emits the sentinel for every real payload today, this is behaviour-preserving in
practice and removes a hard-coded assumption rather than acting on a new one.

### Decision 7 — Presentation

- **Aggregate cards** (`UsageLimitCard`): the reset line sits below the existing remaining/percent
  caption row, as a `<time dateTime={resetIsoValue}>` inside a muted `dial-tiny-text` line using
  `--uld-secondary-amount`. It is additive — existing rows do not move.
- **Model-limits period headers** (`PeriodHeader`): the reset text becomes a second line under the
  column label. `PeriodHeader` already truncates with `min-w-0 truncate`; the reset line follows the
  same rule. On the mobile layout the period label and its reset line stack in the existing
  per-period block, so no new breakpoint is introduced.
- **RTL:** every new element uses logical spacing (`mt-*` is direction-agnostic; `gap-*` for
  inline pairs). No new physical `ml-`/`pl-`/`left-` classes, no directional icons — the reset line
  is text only. The formatted date string itself is produced by `Intl`, which already orders parts
  per locale.
- **Responsive:** the reset line inherits the card's and header's existing containers. Its only
  constraint is that a long formatted date must not force horizontal overflow, so it wraps rather
  than truncating on mobile (`break-words`, no `whitespace-nowrap`).
- **A11y:** the visible label is terse; `<time>` carries the machine instant; the card's existing
  `progressAriaLabel` is not touched. The spoken form names the zone in full (`Central European
  Summer Time`) where the visible line carries the short offset (`GMT+2`) — that difference is the
  only reason the second string exists. It is **not** applied as `aria-label` on the `<time>`:
  `<time>` has no implicit ARIA role, so axe flags `aria-label` on it (`aria-prohibited-attr`) as
  not well supported. The spoken form therefore rides a visually-hidden sibling with the visible
  `<time>` marked `aria-hidden`, and a card with no spoken form leaves the visible line exposed as
  its own accessible name. The boundary re-fetch
  does not announce itself — it is a silent data refresh, and the loading spinner is not re-shown
  for it (that would flash the whole tab).
- **i18n:** new keys `usage.resetsAtLabel` (`"Resets {{dateTime}}"`) and
  `usage.resetsAtAriaLabel` (`"Usage resets {{dateTime}}"`). The three period-description values
  behind the existing keys are retranslated. No new key is added for the timezone — `Intl` emits it
  as part of `dateTime`.
- **Feature flags:** none. The Usage tab in `apps/chat/src/hooks/useSettingsTabConfig.tsx` is not
  gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`, and this change does not add a gate.
- **Authorization:** unchanged. Both routes keep `SessionGuard`; no new endpoint is introduced.
- **Memoisation:** `formatResetTime` must be `useCallback`-stable (it is passed into mappers that
  sit behind `useMemo` on `[usage, t, activeLocale]`); an unstable identity would recompute both
  mappers on every render. The `earliestResetMs` derivation is a `useMemo` over `cards`.

## Risks / Trade-offs

- **Core may not actually send `resetsAt`, or may send a different shape** → Every consumer treats
  it as optional and untrusted (Decision 4); with no `resetsAt` the tab renders exactly as it does
  today. The label and property-name corrections are independently correct and ship regardless. A
  documentation request to the Core team is an explicit task.
- **The period semantics may be wrong in the other direction** — if some deployments really are on
  rolling windows, calendar labels would be wrong for them → The sample timestamps are unambiguous
  UTC calendar starts, and Core's `Limit`/`CostLimit` schemas name `day`/`week`/`month` with no
  window-length field. Confirmation is part of the same documentation request; the migration is
  reversible via the i18n values alone.
- **`setTimeout` overflow silently inverts into an immediate fire** → explicitly clamped in
  Decision 5, with a re-arm, and covered by a test that fakes a >24-day month boundary.
- **A device asleep across a boundary wakes with stale figures and a fired-or-missed timer** →
  `visibilitychange` re-check.
- **Renaming a published package's props breaks external consumers** → accepted and flagged
  **BREAKING**; `libs/usage-dashboard/README.md` carries the old → new mapping, and the repo's own
  only consumer (`UsageTab`) is updated in the same change.
- **A timezone label pushes a card's caption onto a second line on narrow screens** → the reset line
  is its own row and wraps; verified on the mobile layout as part of the responsive check.
- **The BFF forwards a field its own SDK types do not know about** → already true of the existing
  cast; called out as a divergence with a follow-up rather than hidden.

## Migration Plan

1. Backend DTO + Swagger descriptions, then `npm run openapi` and `npm run openapi:check`; build and
   lint `chat-api-client`. At this point nothing renders differently.
2. App-edge formatter plus its tests — pure, no UI impact.
3. Lib prop models, mappers, and period rename, with the mapper tests moved to realistic payloads.
   `UsageTab` is updated in the same step because the rename is compile-breaking.
4. UI rendering of the reset line in `UsageLimitCard` and `PeriodHeader`.
5. `useUsageData` refresh token, then `UsageTab`'s boundary scheduling.
6. i18n values, READMEs, `docs/architecture.md`, `npm run validate:docs`.

**Rollback.** Steps 4–6 are independently revertible. Reverting only the i18n values restores the
old labels without touching types. Reverting step 5 leaves reset times displayed but static.
There is no data migration and no persisted state, so rollback is a code revert with no cleanup.

## Open Questions

**Answered by the captured payload** (see `fixtures/README.md`):

1. ~~**Does Core send `resetsAt` on per-deployment stats, or only on the top-level `*CostStats`?**~~
   **Answered: both.** All 13 deployments in the capture carry it on their day/week/month stats, and
   the values match the top-level ones for the same period. Because they *can* in principle diverge,
   Decision 4's rule stands: each is shown against its own stat and the period header uses the
   top-level value. Per-row reset times in the Model-limits table remain out of scope.
2. ~~**Is the week boundary always UTC Monday?**~~ **Answered for this environment:** `2026-09-21` is
   a Monday. Whether it is configurable per Core deployment is still unknown. It does not affect
   this change — the UI displays Core's instant rather than deriving one — but it affects any future
   copy that names the day.

**Still open, and not blocking:**

3. **Is `resetsAt` guaranteed present whenever a finite limit is configured?** The capture always
   sends it, so no omitting payload could be observed. If presence turns out to be guaranteed, an
   absent `resetsAt` alongside a finite `total` is a Core bug worth surfacing in logs rather than
   silently degrading. Until confirmed, silence is correct, and every consumer treats the field as
   optional.
4. **Will the SDK type `resetsAt`?** If yes, the `as unknown as` cast in
   `deployments-details.service.ts` can eventually narrow. Tracked, not blocking.
5. **Is the value formally the exclusive end of the period?** The capture is consistent with it but
   cannot prove it, and no Core-published spec in tree states it. The UI never relies on the
   distinction — it renders Core's instant and re-fetches after it, rather than computing a window
   from it.
