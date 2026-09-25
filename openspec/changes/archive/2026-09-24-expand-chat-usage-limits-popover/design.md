## Context

The usage affordance next to the conversation input is built from three pieces:

| Piece | File | Today |
| --- | --- | --- |
| Mapper | `libs/chat-hooks/src/catalog/map-deployment-limits-to-input.ts` | Reads `dto?.monthTokenStats` only; returns `MonthlyUsageLimit` |
| Hook | `apps/chat/src/hooks/useDeploymentUsageLimits.ts` | Fetch + monotonic request id + refresh |
| UI | `apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx` | Ring trigger + popover with one `ProgressBar` |

The catalog details panel solves a near-identical display problem and already has a renderer for it:
`LimitsTab` → `LimitGroupSection` → `LimitRow`, backed by
`libs/catalog/src/utils/usage-limits.ts` (`isCapped`, `getProgressValue`, `getProgressMax`,
`getProgressStatus` with 75%/100% thresholds). `LimitsTab` takes a single `CatalogItemLimits` prop,
parameterises every typography class, and applies `colors` through `buildCssVars`. It imports
nothing from the catalog's item model, panel, or fetch layer. It is simply absent from
`libs/catalog/src/index.ts`.

Reset times are also already solved, one surface over: `apps/chat/src/utils/usage-reset-time.ts`
exposes `formatUsageResetTime(resetsAt, activeLocale, t)` → `ResetTimeDisplay`, and
`libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts` declares the structural
`FormatResetTime` / `ResetTimeDisplay` types that let a library take reset strings without importing
an app type. `UsageTab` wires the two together
(`apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx:94-98`). `libs/usage-dashboard` receives
preformatted strings only; the `usage-period-reset-times` spec makes that a hard constraint.

**Constraints carried into this design:**

- `libs/catalog`'s **rendered output must not change**. Additive edits only; the catalog mapper
  (`libs/chat-hooks/src/catalog/map-deployment-limits-to-catalog.ts`) is not touched.
- No library may parse, format, or timezone-shift a `resetsAt`
  (`usage-period-reset-times` → "Reset-time normalization at the application edge").
- `apps/chat` consumes `@epam/ai-dial-catalog` through its `@epam/source` condition, so
  `Limits.module.scss` is compiled by the app's own Vite pipeline. No `styles.css` import is added.

## Goals / Non-Goals

**Goals:**

- Show day, week, and month token limits in the popover, each with its own progress bar and, when
  DIAL Core supplies one, its reset time.
- Reuse `LimitsTab` rather than growing a second renderer for the same data.
- Keep the trigger's error state meaningful across all periods, not just the month.
- Keep every reset-time interpretation inside `apps/chat`.

**Non-Goals:**

- Rendering `minuteTokenStats` (Decision 2).
- Changing anything the catalog details panel renders.
- Boundary-triggered re-fetch in the popover.
- Any backend, generated-client, or endpoint change.
- Fixing the catalog's `Last 24 hours` / `Last 7 days` / `Last 30 days` labels (Risk 4).

## Decisions

### Decision 1 — Export `LimitsTab` from `@epam/ai-dial-catalog` instead of duplicating it

`libs/catalog/src/index.ts` gains `LimitsTab`, `LimitsTabProps`, and `LimitsTabColors`
(`LimitsTabColors` is currently a non-exported interface in
`libs/catalog/src/models/limits-props.ts:5` and must be marked `export`). `LimitRow` and
`LimitGroupSection` stay internal — the popover needs the whole list, not a single row.

*Why:* the component is already presentation-only and fully parameterised. Exporting it changes no
rendered output anywhere; it only widens the barrel.

*Alternatives:* copy `LimitRow` + `usage-limits.ts` into `apps/chat` (~150 lines duplicated, two
copies of the 75%/100% thresholds that drift the first time either is tuned — rejected); move
`LimitsTab` to `libs/chat-shared` (breaking move inside `libs/catalog` for no behavioural gain —
rejected).

*Isolation:* `LimitsTab` receives only preformatted strings and numeric progress values. It gets no
locale, no `t`, no timezone, no DTO, no endpoint knowledge. The app-level carrier is the
`CatalogItemLimits` object the popover builds.

### Decision 2 — The popover shows day / week / month, and deliberately omits the minute limit

`minuteTokenStats` is a rolling-minute counter. Two openings of the popover thirty seconds apart
show different numbers for reasons the user cannot attribute to their own actions, and the value is
stale the moment it renders. A row that cannot be acted on is noise in a four-row list.

Issue #8969's reproduction sets a per-minute limit in DIAL admin, so **this part of the report is
knowingly left uncovered**. If per-minute headroom turns out to matter, it wants a live-updating
treatment (a rate indicator that refreshes while open), not a static row — a separate change.

*Alternative:* show all four for literal issue parity — rejected above.

### Decision 3 — `mapDeploymentLimitsToInput` returns `CatalogItemLimits` and takes `formatResetTime`

New signature:

```ts
export const mapDeploymentLimitsToInput: (
  dto: DeploymentLimitsResponseDto | undefined,
  labels: ConversationInputLimitsLabels,
  formatResetTime?: FormatResetTime,
) => CatalogItemLimits | undefined;
```

It keeps the existing usability rules — a stat needs finite `total`/`used` and `total > 0` to
produce a row; a `total` at or above `Number.MAX_SAFE_INTEGER` is the unlimited sentinel and yields
the `isUnlimited` + `noteLabel` treatment instead of a progress bar; no qualifying stat yields
`undefined` rather than an empty group. It computes the group's `status` the same way
`mapDeploymentLimitsDtoToCatalogLimits` does (worst case across capped rows, `LimitReached`
outranking `RunningLow`).

`MonthlyUsageLimit` is deleted. `libs/chat-hooks` already imports `@epam/ai-dial-catalog`'s display
types for the sibling catalog mapper, so `CatalogItemLimits` introduces no new dependency edge.

*Why a callback rather than a raw `resetsAt` passthrough:* the library must not construct a `Date`
or touch `Intl`. `FormatResetTime` is the pattern `UsageTab` already uses, and the structural
`ResetTimeDisplay` in `libs/chat-hooks/src/usage/` means no app type crosses the boundary.

*Why not reuse `mapDeploymentLimitsDtoToCatalogLimits` directly:* it emits the catalog's row set and
label fields. Adding reset lines or changing the period wording through it would change the catalog,
which this change forbids. Two small mappers sharing a display type is the cheaper seam.

*Isolation:* period labels, the `$X spent` caption format, value/aria formatters, and reset
formatting all arrive from `apps/chat` as a labels object plus a callback. The library knows DIAL
Core's stat field names, which AGENTS.md §Library isolation permits `chat-hooks` under its second
and fourth exceptions — the same latitude the sibling catalog mapper already exercises.

### Decision 4 — The trigger's error state follows the worst capped row, not the month

`USAGE_LIMIT_THRESHOLD_PERCENT = 90` and `limit.usedPercent` are replaced by
`limits.status === CatalogLimitStatus.LimitReached`. The `CatalogLimitStatus` thresholds (75%
running-low, 100% reached) become the single source of truth, so the ring, the rows' progress-bar
colors, and the catalog all agree.

`RunningLow` gets the warning treatment and `LimitReached` the error treatment, matching
`LimitRow`'s own `ProgressStatus.Warning` / `ProgressStatus.Danger` fills. The ring's numeric
percentage comes from the **worst capped row**, and its accessible name names that row's period, so
`75%` never reads as ambiguous between three periods.

*Why:* a user who is fine for the month but out of tokens for today currently sees a calm ring and
then a failed request. That is the defect the issue reports, one layer up from the missing rows.

*Alternative:* keep the month as the ring's source and rely on the popover for the rest — rejected;
the ring is the only always-visible part.

### Decision 5 — `UsageLimitsControl` owns its own translations; the `labels` prop is removed

`ConversationView.tsx:637-649` and `NewConversationComposer.tsx:394-406` build byte-identical
`usageLimitsLabels` memos today. The labels object roughly triples in size with this change (period
labels, caption/value/aria formatters, reset labels), so the duplication gets worse and the two
copies can silently diverge.

`UsageLimitsControl` lives in `apps/chat`, not a library, so it may call `useTranslation` and
`useLanguage` itself. Both `usageLimitsSlot` call sites collapse to `deploymentId` +
`isGenerationInProgress`, and the two `useMemo` blocks are deleted.

*Why this is not scope creep:* it is the direct consequence of the prop's payload growing. The
component's isolation requirement (`conversation-input-usage-limits` → "Isolated Conversation Input
integration") is about `@epam/ai-dial-conversation-input` not owning usage policy; that library still
sees only an opaque `ReactNode`.

*Alternative:* extract a shared `useUsageLimitsLabels` hook and keep the prop — one more indirection
for a component with exactly two call sites, both inside `apps/chat`. Rejected.

### Decision 6 — Reset lines are three optional row fields, rendered as `<time>` with a hidden spoken sibling

`UsageLimitProgressRow` gains `resetLabel?`, `resetIsoValue?`, `resetAriaLabel?` — the same trio as
`UsageLimitCardData` in `libs/usage-dashboard`, present-or-all-absent. `LimitRow` renders them under
the row's label (beside `captionLabel`), only when `resetLabel` is set.

Markup follows the pattern `usage-period-reset-times` already mandates for `UsageLimitCard`:
`<time dateTime={resetIsoValue} aria-hidden>` carries the visible text and the machine-readable
instant, and the spoken form renders on a visually-hidden sibling. `<time>` has no implicit ARIA
role, so `aria-label` on it is `aria-prohibited-attr`. When `resetAriaLabel` is absent the visible
line remains its own accessible name.

Because the catalog mapper is untouched, catalog rows never carry these fields and the details
panel's DOM is unchanged — the additive fields are inert there.

*Alternative:* a single preformatted `resetLabel` string with no `<time>` element — loses the
machine-readable instant and diverges from the established card pattern. Rejected.

### Decision 7 — New i18n keys with calendar wording, not the catalog's trailing-window labels

New keys under `conversationInput.usageLimits.*`:

| Key | English |
| --- | --- |
| `tokenGroup` | `Token limits` |
| `tokensPerDay` | `Today` |
| `tokensPerWeek` | `This week` |
| `tokensPerMonth` | `This month` |
| `spentLabel` | `{{amount}} spent` |
| `value` | `{{used}} / {{total}}` |
| `followsCostLimit` | `Follows cost limit` |
| `followsCostLimitAriaLabel` | `{{label}}: {{used}} used. Follows cost limit.` |
| `progressAriaLabel` | `{{label}}: {{used}} of {{total}} used` |

`usage.resetsAtLabel` and `usage.resetsAtAriaLabel` are reused verbatim.
`conversationInput.usageLimits.triggerAriaLabel` is re-worded away from `Monthly token usage` to
name the period it reports. `conversationInput.usageLimits.tokensRemaining` and
`conversationInput.usageLimits.progressAriaLabel` (the monthly-only strings) are removed along with
the single-bar rendering; `popoverTitle` and `error` survive unchanged.

*Why not reuse `catalog.details.limits.tokensPerDay/Week/Month`:* their English values are
`Last 24 hours`, `Last 7 days`, `Last 30 days`. `usage-period-reset-times` states these stats are
**calendar periods anchored to UTC boundaries** and that documentation and UI "SHALL NOT describe
them as trailing, rolling, or 'last N days' windows". Reusing those keys would copy a known spec
violation into a new surface. See Risk 4.

All keys go in `apps/chat/src/i18n/locales/en.json` and
`apps/chat/src/constants/translation-keys.ts` under the existing `ConversationInputI18nKeys` enum.

### Decision 8 — Loading, empty, and error states

| State | Behaviour |
| --- | --- |
| No `deploymentId`, or mapper returns `undefined` | Control renders `null` — unchanged |
| First fetch in flight | Control renders `null` (no skeleton) — unchanged; the affordance appears when data arrives |
| Refresh in flight with the popover open | Previous rows stay rendered, no loader — unchanged |
| Refresh rejects | `hasError` line stays above the rows with `aria-live="polite"`; rows keep their last values |
| Every stat unusable or unlimited-sentinel | `undefined` → no control at all |
| Row has no `resetsAt`, or it is unparseable | Row renders with no reset line; no error, no console output |

The hook's existing `cancelled` flag + `AbortController` + monotonic `fetchIdRef` structure is
unchanged.

### Decision 9 — Popover width

`LimitRow` reserves `w-32` for its value column. The current popover is `w-64` (256px), which leaves
~96px for a label plus a `$X spent` caption plus a reset line. The popover widens to `w-80` (320px),
keeping `max-w-[calc(100vw-2rem)]` so mobile is unaffected.

## Risks / Trade-offs

1. **[`libs/catalog`'s public surface grows, and a public export is harder to change later]** →
   Only `LimitsTab` and its props are exported; `LimitRow` and `LimitGroupSection` stay internal, so
   the row-level markup remains free to change. `libs/catalog/README.md` documents the new export
   and the new row fields, and `npm run validate:docs` fails the build if the README and
   `src/index.ts` disagree.

2. **[A regression in `LimitRow` would hit the catalog as well as the chat]** → The reset block is
   guarded on `resetLabel != null`, and the catalog mapper never sets it, so catalog rows take the
   identical code path they take today. `libs/catalog/src/components/Details/TabsContent/tests/Limits.spec.tsx`
   gains a case asserting a row without reset fields renders exactly as before, alongside the new
   positive cases.

3. **[Three progress bars in a 320px popover is visually heavier than one]** → `LimitsTab` is the
   same density the catalog details panel already ships, which is the comparison users named in the
   issue. Verified at mobile width and under `dir="rtl"` as part of the change.

4. **[The catalog keeps mislabelling calendar periods as trailing windows]** → Pre-existing drift
   between `catalog.details.limits.tokensPerDay/Week/Month` (`Last 24 hours` / `Last 7 days` /
   `Last 30 days`) and the `usage-period-reset-times` spec. This change does not propagate it: the
   popover gets its own calendar-worded keys. Fixing the catalog labels is a separate change,
   deliberately out of scope because the user scoped the catalog out. Flagged here so it is not
   rediscovered as a new defect.

5. **[Removing `MonthlyUsageLimit` from `@epam/ai-dial-chat-hooks` breaks an external consumer]** →
   Breaking for anyone importing that name outside this repo. `apps/chat` is the only in-repo
   consumer. Called out in the proposal's rollback note; the package is at `0.x`, where a removal in
   a minor is acceptable.

6. **[The ring's single percentage is now ambiguous across three periods]** → Mitigated in
   Decision 4: the number comes from the worst capped row and the accessible name states which
   period it reports.

7. **[`resetAriaLabel` markup pattern is subtle and easy to get wrong]** → It is copied verbatim
   from the `UsageLimitCard` implementation that `usage-period-reset-times` already specifies
   (`aria-hidden` on the visible `<time>`, spoken text on a visually-hidden sibling), and covered by
   an axe assertion in `Limits.spec.tsx`.

## Migration Plan

No data migration, no stored state, no API contract change. Deploy is a single frontend build.

Rollback is `git revert` of the change: the popover returns to the monthly bar, `libs/catalog`'s
additive exports and row fields disappear with it, and nothing in DIAL Core, the BFF, or persisted
conversation data is involved.

## Open Questions

None blocking. Two recorded for follow-up, both explicitly out of scope here:

- Should per-minute headroom get a live-updating treatment in the composer (Decision 2)?
- When do the catalog's period labels get corrected to calendar wording (Risk 4)?
