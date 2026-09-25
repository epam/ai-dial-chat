# conversation-input-usage-limits Specification

## Purpose

The day, week, and month deployment-usage trigger and popover surfaced in the
conversation input.

## Requirements

### Requirement: Period deployment usage

`@epam/ai-dial-chat-hooks` SHALL export
`mapDeploymentLimitsToInput(dto: DeploymentLimitsResponseDto | undefined, labels:
ConversationInputLimitsLabels, formatResetTime?: FormatResetTime): CatalogItemLimits | undefined`.

The function SHALL emit up to two `UsageLimitGroup`s, in this order:

1. **Token limits**, labelled from `labels.tokenGroup`, mapping `dayTokenStats`, `weekTokenStats`,
   and `monthTokenStats` in that order. Figures SHALL be formatted with compact K/M notation.
2. **Cost limits**, labelled from `labels.costGroup`, mapping `dayCostStats`, `weekCostStats`, and
   `monthCostStats` in that order. Figures SHALL be formatted as currency through `formatCost`.

The cost stats on a deployment-limits response are the **caller's own budget and span every
deployment**, not the one that was queried — the same figures come back whichever deployment is
asked. They SHALL therefore be listed as their own group, whose label SHALL say so, and SHALL NOT be
rendered as a caption on a token row, which would read as that model's spend. `captionLabel` SHALL
NOT be set on any row, and `labels` SHALL carry no spend-caption formatter.

The function SHALL NOT map `minuteTokenStats`, `minuteCostStats`, `hourRequestStats`, or
`dayRequestStats`.

**Only limits at or past the running-low mark are listed.** A stat SHALL produce a row only when its
`total` and `used` are both finite, `total` is greater than `0`, and its used/total ratio is at or
above `0.75` — the same threshold `CatalogLimitStatus` already uses for running-low, so one number
decides both the bar's warning fill and whether the row exists.

This is deliberate: the control sits beside the message input and its job is to warn, not to report.
A deployment at `2%` of its token allowance listed beside an account budget at `90%` buries the one
figure worth acting on. The complete picture lives on the Usage page, which the popover links to.

A row whose `total` is at or above `Number.MAX_SAFE_INTEGER` has no cap and therefore no ratio, so
it can never reach the threshold and SHALL never be listed. The function SHALL NOT emit an
`isUnlimited` row, and `labels` SHALL carry no note or ARIA formatter for one.

`used` SHALL be clamped to a minimum of `0`. When no stat qualifies, or `dto` is `undefined`, the
function SHALL return `undefined` rather than a group with an empty `rows` array — which is what
removes the trigger entirely while every limit is comfortable.

Each row SHALL set `valueLabel` and `ariaLabel` through the injected formatter callbacks and SHALL
NOT build either string from its own template literal.

The result's `status` SHALL be the worst case across every listed row of **both** groups, so a cost
budget nearing its cap drives the trigger just as a token limit does. Every listed row being at or
past the running-low mark, the status SHALL never be absent when a result is produced —
`CatalogLimitStatus.LimitReached` when any capped row's used/total ratio is at or above `1`,
otherwise `CatalogLimitStatus.RunningLow` when any is at or above `0.75`, otherwise absent.

When `formatResetTime` is supplied, the function SHALL call it with each stat's raw `resetsAt` and,
on a defined result, set the row's `resetLabel`, `resetIsoValue`, and `resetAriaLabel` from it as a
present-or-all-absent trio. The function SHALL NOT construct a `Date`, call a date/time `Intl` API,
or import `react-i18next`, `i18next`'s `TFunction`, or any app translation-key enum.

`apps/chat/src/hooks/useDeploymentUsageLimits.ts` SHALL continue to own the fetch: an
`AbortController` plus a `cancelled` flag in the effect cleanup, and a monotonic request id so a
response for an earlier deployment never overwrites the current one. Refresh failures SHALL preserve
the last known limits and SHALL NOT affect message entry or sending.

#### Scenario: Three stretched periods produce three rows

- **WHEN** `dayTokenStats`, `weekTokenStats`, and `monthTokenStats` are each at or past `75%`
- **THEN** the result contains one group with three rows in day, week, month order

#### Scenario: Minute stats are never mapped

- **WHEN** `dto` carries a usable `minuteTokenStats` or `minuteCostStats`
- **THEN** no row is emitted for it, and its presence alone does not produce a result

#### Scenario: The cost budget is its own group

- **WHEN** `dto` carries both token stats and day/week/month cost stats
- **THEN** the result has a token group followed by a cost group, and no row in either carries a
  `captionLabel`

#### Scenario: Cost figures are currency-formatted

- **WHEN** `dayCostStats` is `{ used: 90.5, total: 100 }`
- **THEN** the row's `usedLabel`/`totalLabel` are `"$90.5"`/`"$100"`

#### Scenario: A cost row can drive the status

- **WHEN** the day cost row is at `100%` and the token rows are at `80%`
- **THEN** `status` is `CatalogLimitStatus.LimitReached`

#### Scenario: A missing period is skipped without shifting the others

- **WHEN** `dto` omits `weekTokenStats` but carries stretched day and month stats
- **THEN** the result contains two rows, day before month, with no placeholder row

#### Scenario: A comfortable period is not listed

- **WHEN** the day stat is at `90%` and the week stat is at `5%`
- **THEN** only the day row is emitted

#### Scenario: The threshold is inclusive

- **WHEN** a stat is at exactly `75%`
- **THEN** its row is emitted, and a stat at `74%` produces none

#### Scenario: A stretched account budget outlives a barely-used model

- **WHEN** every token stat is at `2%` and `monthCostStats` is at `90%`
- **THEN** the result carries the cost group alone, with the month row, and no token group

#### Scenario: Comfortable everywhere removes the control

- **WHEN** no stat reaches `75%`
- **THEN** the function returns `undefined`, so no trigger is rendered at all

#### Scenario: An uncapped period is never listed

- **WHEN** `monthTokenStats.total` is `Number.MAX_SAFE_INTEGER`
- **THEN** no row is emitted for it, having no ratio that could reach the threshold

#### Scenario: No qualifying stat returns undefined

- **WHEN** every token stat is absent, non-finite, or has a non-positive total
- **THEN** the function returns `undefined`, not a group with an empty `rows` array

#### Scenario: Worst-case status wins

- **WHEN** the day row is at `100%` and the month row is at `80%`
- **THEN** `status` is `CatalogLimitStatus.LimitReached`

#### Scenario: Reset strings are passed straight through

- **WHEN** `dayTokenStats.resetsAt` is present and `formatResetTime` returns a display object
- **THEN** the day row carries `resetLabel`, `resetIsoValue`, and `resetAriaLabel` from that object,
  and the raw `resetsAt` string appears nowhere else in the row

#### Scenario: Reset formatting is declined

- **WHEN** `formatResetTime` is omitted, or returns `undefined` for a stat
- **THEN** that row carries none of the three reset fields and is otherwise unchanged

#### Scenario: Architecture guard — no i18n, date, or translation-key import

- **WHEN** `libs/chat-hooks`'s conversation-input limits mapper is linted and type-checked
- **THEN** its source contains no `i18next`/`react-i18next` import, no app translation-key enum
  import, no `new Date(...)`, and no date/time `Intl` constructor

#### Scenario: Deployment changes during a request

- **WHEN** an earlier deployment's request resolves after the selected deployment has changed
- **THEN** its result is ignored

---

### Requirement: Isolated Conversation Input integration

`@epam/ai-dial-conversation-input` SHALL expose an optional
`usageLimitsSlot?: ReactNode` and render it in the action row near the model
selector. Omitting the slot SHALL preserve the existing layout.

Both `NewConversationComposer` and `ConversationView` SHALL compose the
app-owned usage control into this slot. The library SHALL NOT own deployment
APIs, DTOs, selection state, translations, or usage policy.

#### Scenario: Slot is provided

- **WHEN** a composer supplies the usage control
- **THEN** it appears in the Conversation Input action row

#### Scenario: Slot is omitted

- **WHEN** a consumer does not supply the slot
- **THEN** Conversation Input behaves as before

---

### Requirement: Period usage trigger

The trigger SHALL be rendered only when at least one limit is at or past the running-low mark. While
every limit is comfortable no trigger appears at all, so its presence is itself the signal that
something needs attention. It SHALL reveal a percentage on hover and keyboard focus and keep that
value visible while the popover is open.

The percentage SHALL be the used/total ratio of the **worst capped row** — the row that determined
the group's `CatalogLimitStatus` — not the month's. The trigger's accessible name SHALL name that
row's period, so the number is never ambiguous across three periods.

The trigger SHALL render that percentage as a dial: a circular face with a needle pivoting at its
centre, aimed by a sweep that rests at the 7-o'clock mark for `0%`, passes straight up at `50%`, and
stops at the 5-o'clock mark for `100%`. The needle angle SHALL be derived from the worst capped
row's percentage alone.

The sweep SHALL stay anchored to the absolute `0–100%` range even though, with the threshold rule
above, the needle only ever occupies its final quarter. An angle that means the percentage it
reports is worth more than a larger visible swing: re-mapping `75–100%` across the full sweep would
draw `75%` as an empty dial.

#### Scenario: No trigger while every limit is comfortable

- **WHEN** no limit reaches `75%`
- **THEN** no trigger is rendered

The trigger's visual state SHALL be driven by the group's `status`:
`CatalogLimitStatus.LimitReached` SHALL use the theme error state,
`CatalogLimitStatus.RunningLow` SHALL use the theme warning state, and an absent status SHALL use
the default secondary state, each tinting both the needle and the dial face through the matching
text and background tokens. `USAGE_LIMIT_THRESHOLD_PERCENT` SHALL NOT be reintroduced; the 75%/100%
thresholds already encoded in `CatalogLimitStatus` are the single source of truth, so the dial, the
rows' progress fills, and the catalog agree.

Meaning SHALL NOT depend on color or hover alone: the percentage and the period SHALL both be
present in the accessible name. The dial SHALL be marked `aria-hidden`, being a second rendering of
the value the accessible name already carries.

The layout SHALL support LTR and RTL. The dial is the one exception to using logical properties: it
is rotationally symmetric and its needle encodes a magnitude, so mirroring it would read `80%` as
`20%`. It SHALL therefore be centred with the direction-agnostic `50%` technique and SHALL NOT
mirror under `dir="rtl"`.

#### Scenario: Daily limit reached while the month is comfortable

- **WHEN** the day row is at `100%` and the month row is at `10%`
- **THEN** the trigger uses the error state and reports the day figure, not the month's

#### Scenario: Running low

- **WHEN** the worst capped row is at `80%`
- **THEN** the trigger uses the warning state and displays `80%`

#### Scenario: The needle tracks the worst capped row

- **WHEN** the worst capped row is at `0%`, `50%`, and `100%` in turn
- **THEN** the needle rests at the 7-o'clock mark, points straight up, and stops at the 5-o'clock
  mark respectively

#### Scenario: Direction guard — the dial is centred, not mirrored

- **WHEN** the trigger's stylesheet is inspected
- **THEN** the needle is placed with the direction-agnostic `50%` centring technique and carries no
  logical inset that would mirror it under `dir="rtl"`, with a comment stating why this is the
  exception to the logical-property rule

#### Scenario: No usable limit

- **WHEN** `mapDeploymentLimitsToInput` returns `undefined` — including when every allowance is the
  unlimited sentinel
- **THEN** no usage control is rendered at all

#### Scenario: Popover remains open

- **WHEN** focus moves from the trigger into the open popover
- **THEN** the trigger value remains visible

#### Scenario: Accessible name states the period

- **WHEN** a screen reader reads the trigger and the worst capped row is the day row
- **THEN** the announced name contains both the percentage and the day period label

---

### Requirement: Period usage popover

Activating the trigger by pointer or keyboard SHALL open a popover titled with the selected
deployment's display name, resolved for the active locale and falling back to the deployment id.
When the selection is not present in the deployments list the title SHALL fall back to
`conversationInput.usageLimits.popoverTitle`. The title SHALL remain the dialog's accessible name
through `aria-labelledby`.

Its body SHALL be rendered by `LimitsTab` imported from `@epam/ai-dial-catalog`, passed the
`CatalogItemLimits` value the mapper produced and `LimitRowLayout.Stacked`. The app SHALL NOT
hand-roll a second row renderer, and SHALL NOT import `LimitRow` or `LimitGroupSection`.

In that layout each row puts its label and value on one line, with a full-width progress bar and the
reset caption beneath, so the popover SHALL be wide enough for a label and its value side by side
and SHALL retain a viewport-relative maximum width so mobile layout does not overflow horizontally.

The popover SHALL refresh limits on open without displaying a loading indicator, and the control
SHALL refresh once when an active generation ends so the trigger reflects the latest usage without
being opened. It SHALL support Escape, outside activation, trigger reactivation, and predictable
focus return to the trigger. A failed refresh SHALL be announced through an `aria-live="polite"`
region using `conversationInput.usageLimits.error` while the previously rendered rows remain visible.

All visible and accessible text SHALL come from app-owned i18n. `UsageLimitsControl` SHALL resolve
its own strings through `useTranslation` and its own locale through the app's language hook, and
SHALL NOT accept a `labels` prop — it is an `apps/chat` component, and two call sites building
byte-identical label objects is the duplication this removes. Its remaining props SHALL be
`deploymentId` and `isGenerationInProgress`.

i18n keys under `conversationInput.usageLimits.*`: `tokenGroup`, `costGroup`, `periodDay`,
`periodWeek`, `periodMonth`, `value`, `progressAriaLabel`, plus the pre-existing `popoverTitle`,
`error`, and `triggerAriaLabel`. The
three period labels SHALL be shared by both groups rather than duplicated per group, since they name
a calendar period and not what is being metered. `triggerAriaLabel` SHALL name the reported period
without naming tokens, the worst capped row now being a cost row as readily as a token one.
`usage.resetsAtLabel` and `usage.resetsAtAriaLabel` are reused unchanged. Period labels SHALL use
calendar wording (`Today`, `This week`, `This month`) and SHALL NOT describe the periods as trailing
or rolling windows.

No feature gate, new endpoint, cache, polling, telemetry, or boundary-triggered re-fetch SHALL be
introduced. The control is not gated behind `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`; it is
shown whenever the selected deployment has a usable limit.

**RTL:** the popover uses logical properties only (`start-*`/`end-*`, `ms-*`/`me-*`,
`ps-*`/`pe-*`) and contains no directional icon, so nothing is mirrored. **Memoisation:** the
`CatalogItemLimits` value SHALL be produced inside a `useMemo`, and the `formatResetTime` callback
SHALL be `useCallback`-stable on the active locale and `t`, so the memo does not recompute every
render. **A11y:** the trigger keeps `aria-expanded` and `aria-haspopup="dialog"`, the panel keeps
`role="dialog"` with `aria-labelledby` pointing at its title, and every progress bar carries an
`aria-valuetext` from its row's `ariaLabel`.

#### Scenario: Three periods render as three rows

- **WHEN** the user opens the popover for a deployment with day, week, and month limits
- **THEN** the popover shows the title and three rows, each with its own progress bar, used/total
  figures, and spent caption

#### Scenario: The popover is titled with the deployment

- **WHEN** the selected deployment resolves to a display name
- **THEN** that name is the popover's title and the dialog's accessible name

#### Scenario: Unknown deployment keeps a generic title

- **WHEN** the selected deployment is absent from the deployments list
- **THEN** the popover falls back to `conversationInput.usageLimits.popoverTitle`

#### Scenario: Reset line appears per row

- **WHEN** a row's stat carried a `resetsAt` that formatted successfully
- **THEN** that row shows its reset line, and a row whose stat carried none shows no reset line and
  raises no error

#### Scenario: Silent refresh

- **WHEN** limits refresh while the popover is open
- **THEN** the current rows remain visible and no loader appears

#### Scenario: Generation completes

- **WHEN** an active generation ends
- **THEN** the control refreshes the selected deployment's limits once and updates the trigger
  without the popover being opened

#### Scenario: Refresh fails

- **WHEN** the refresh request rejects
- **THEN** the error is announced politely, the last successful rows stay rendered, and the composer
  remains usable

#### Scenario: Keyboard dismissal returns focus

- **WHEN** the user presses Escape with the popover open
- **THEN** the popover closes and focus returns to the trigger

#### Scenario: Call sites pass no labels

- **WHEN** `ConversationView` and `NewConversationComposer` render the control into
  `usageLimitsSlot`
- **THEN** each passes only `deploymentId` and `isGenerationInProgress`, and neither builds a
  `usageLimitsLabels` object

#### Scenario: Mobile width does not overflow

- **WHEN** the popover opens at mobile width with long period labels and reset lines
- **THEN** its content wraps within the viewport-relative maximum width and the page does not scroll
  horizontally

#### Scenario: RTL layout mirrors through the cascade

- **WHEN** the popover renders under `dir="rtl"`
- **THEN** the panel anchors to the opposite edge through logical properties, with no physical
  `left`/`right` class and no mirrored icon
