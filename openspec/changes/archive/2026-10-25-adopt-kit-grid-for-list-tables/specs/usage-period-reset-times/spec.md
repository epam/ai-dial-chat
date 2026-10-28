## MODIFIED Requirements

### Requirement: Reset-time normalization at the application edge

All interpretation of `resetsAt` SHALL happen in `apps/chat`, never in a hand-authored library.
`libs/chat-hooks/src/usage/usage-reset-time.ts` SHALL expose a formatter with this contract:

```ts
export interface ResetTimeDisplay {
  resetsAtMs: number;
  isoValue: string;
  label: string;
  ariaLabel: string;
}

export const formatUsageResetTime: (
  resetsAt: string | undefined,
  activeLocale: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) => ResetTimeDisplay | undefined;
```

The formatter:

- SHALL parse with `Date.parse` and return `undefined` when the result is `NaN`
- SHALL return `undefined` when `resetsAt` is `undefined` or an empty string
- SHALL format the visible `label` via `Intl.DateTimeFormat(activeLocale, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'shortOffset' })`, and the spoken `ariaLabel` with the same components but `timeZoneName: 'long'`.
- SHALL state every reset time at the viewer zone's UTC offset as it is at formatting time, and name that same zone (`GMT+2`, `Central European Summer Time`) on every label. A boundary that falls after a daylight-saving switch is therefore shown in the current offset (the week boundary `2026-10-26T00:00:00Z` reads `2:00 AM GMT+2` when formatted on 25 October in `Europe/Warsaw`), so the day, week and month headers never mix two offsets. The current offset is the only use of the current time, and it never moves a boundary.
  The components are named individually rather than through `dateStyle`/`timeStyle` because
  ECMA-402 forbids combining either style shorthand with `timeZoneName` — that combination throws a
  `TypeError` at construction, which under the rules below would make the formatter return
  `undefined` on every platform and render the reset affordance permanently dead. These options
  reproduce a medium date and a short time while still carrying the offset.
- SHALL resolve the viewer's zone through `Intl.DateTimeFormat().resolvedOptions().timeZone` inside a
  `try`/`catch`, matching the defensive pattern in `libs/chat-hooks/src/shared/browser-timezone.ts`,
  and SHALL return `undefined` if any `Intl` call throws
- SHALL set `isoValue` to the original `resetsAt` string, for a `<time dateTime>` attribute
- SHALL NOT derive a reset boundary from the browser's own calendar — no local midnight, no
  "start of week", no date arithmetic on `new Date()`

The result SHALL be passed into `libs/usage-dashboard` as preformatted strings only.
`libs/usage-dashboard` SHALL NOT import `Intl`, receive a locale or timezone, or receive a raw
`resetsAt` value. The presentational library holds no reset-time mapper at all: the adapters that
consume `formatResetTime` (`mapUsageDataToDashboard`, `mapOverallCostLimitsToPeriodStatuses`) live in
`libs/chat-hooks/src/usage/` — the narrow, explicitly justified location recorded in AGENTS.md
§Library isolation, not `libs/usage-dashboard`.

`UsageTab` SHALL supply the formatter to `mapUsageDataToDashboard` and
`mapOverallCostLimitsToPeriodStatuses` (both imported from `@epam/ai-dial-chat-hooks`) as a
`formatResetTime` callback, following the existing `resolveIconUrl` / `resolveDisplayName` callback
pattern, and SHALL wrap it in `useCallback` so the adapters' `useMemo` dependencies stay stable.
`mapUserUsageToModelLimits` does not take the callback: reset times are rendered per period header,
not per row.

Because `libs/chat-hooks` must not import the app's own `ResetTimeDisplay` type (a library importing
an app type is exactly the coupling AGENTS.md §Library isolation forbids in the other direction),
`libs/chat-hooks/src/usage/` SHALL declare its own structural `ResetTimeDisplay`-shaped type and
type `formatResetTime` against it. The two shapes SHALL be field-for-field identical
(`resetsAtMs: number`, `isoValue: string`, `label: string`, `ariaLabel: string`), so `UsageTab`'s
`formatUsageResetTime` return value satisfies the library's type with no adapter or cast at the call
site. `@epam/ai-dial-usage-dashboard` SHALL continue to export neither `ResetTimeDisplayLike` nor
`FormatResetTime` — that removal, made when the adapters first left the presentational library, is
unaffected by which non-presentational location they live in now.

#### Scenario: UTC boundary is rendered in the viewer's timezone
- **WHEN** `resetsAt` is `2026-09-16T00:00:00Z` and the viewer's resolved zone is `Europe/Warsaw`
  (UTC+2)
- **THEN** `label` names 16 September at 02:00 and includes the offset (`GMT+2`), and `resetsAtMs`
  equals `Date.parse('2026-09-16T00:00:00Z')`

#### Scenario: One offset across a daylight-saving switch
- **WHEN** the viewer's zone is `Europe/Warsaw`, the current time is `2026-10-24T22:30:00Z` (CEST), and
  the day and week boundaries are `2026-10-25T00:00:00Z` and `2026-10-26T00:00:00Z`
- **THEN** both labels state `GMT+2` — `Oct 25, 2026, 2:00 AM GMT+2` and `Oct 26, 2026, 2:00 AM GMT+2`
  — and each `resetsAtMs` still equals its boundary

#### Scenario: Timezone is always stated
- **WHEN** any `resetsAt` is formatted
- **THEN** the visible `label` contains a timezone designator, so a UTC boundary shown in local time
  is never ambiguous

#### Scenario: Library never interprets a timestamp
- **WHEN** `libs/usage-dashboard`'s sources are inspected
- **THEN** no file parses, formats, or timezone-shifts a `resetsAt` value, constructs a `Date`, or
  calls a date/time `Intl` API, and no file receives a raw `resetsAt` at all — the library's props
  carry only the preformatted `resetLabel` / `resetIsoValue` / `resetAriaLabel` strings; the
  module-boundary lint passes

#### Scenario: The adapters pass reset strings straight through
- **WHEN** the `mapUsageDataToDashboard` and `mapOverallCostLimitsToPeriodStatuses` adapters run
- **THEN** each passes its raw `resetsAt` straight to `formatUsageResetTime` and stores only the
  strings returned, present-or-all-absent as a trio, exactly as before either relocation

#### Scenario: The library's own type never crosses into the app

- **WHEN** `libs/chat-hooks/src/usage/`'s source is inspected
- **THEN** it declares its own `ResetTimeDisplay`-shaped type rather than importing
  `libs/chat-hooks/src/usage/usage-reset-time.ts`'s `ResetTimeDisplay`, and `UsageTab`'s
  `formatUsageResetTime` return value is accepted with no cast at the call site

> The library's pre-existing `Intl.NumberFormat` instances for Tokens formatting are unaffected —
> the constraint is on date/time interpretation, not on `Intl` as a namespace. Those instances live
> with the adapters in `libs/chat-hooks`; the presentational library's remaining components format
> nothing.


### Requirement: Reset times are displayed for aggregate budgets and period headers

Usage page SHALL display the reset time for each of the three aggregate cost cards
(`dayCostStats`, `weekCostStats`, `monthCostStats`) and for each of the three Model-limits period
headers.

- On a `UsageLimitCard`, the reset line SHALL render below the existing remaining/percent caption
  row as a `<time dateTime={resetIsoValue}>` element, so existing content does not move.
- On a Model-limits `PeriodHeader`, the reset time SHALL NOT render as a header line. It SHALL render
  as a focusable info icon (`IconInfoCircle`) beside the column label, whose tooltip holds the
  `<time dateTime={resetIsoValue}>` with `resetLabel` and whose accessible name is `resetAriaLabel`
  (or `resetLabel` when no spoken form is supplied), with at least a 44×44 CSS-pixel touch target on
  mobile. It is sourced from the same top-level `*CostStats` stat that drives that header's status.
  `ModelLimitsTypography` SHALL NOT carry a `resetLabelClassName`.
- The reset line SHALL render for a card regardless of whether the card is `isUnlimited` — an
  unconfigured limit still accumulates spend against a period that rolls over.

New i18n keys: `usage.resetsAtLabel` (`"Resets {{dateTime}}"`) and `usage.resetsAtAriaLabel`
(`"Usage resets {{dateTime}}"`). No separate timezone key is added — `Intl` emits the zone as part
of `dateTime`.

**RTL:** the reset line is text only, with no directional icon and no physical-direction spacing
classes; it uses logical/direction-agnostic utilities and inherits `dir` through the cascade, and
`Intl` already orders date parts per locale. **Responsive:** the line lives inside the card's and
header's existing containers and SHALL wrap rather than force horizontal overflow on mobile.
**A11y:** the `<time>` element carries the machine-readable instant. `ariaLabel` SHALL name the
timezone in full (`Central European Summer Time`) rather than as the visible short offset
(`GMT+2`) — naming the zone is the only thing it adds over the visible line. It SHALL NOT be applied
as `aria-label` on the `<time>` itself: `<time>` has no implicit ARIA role, so `aria-label` on it is
not reliably supported (axe reports `aria-prohibited-attr` as needing review). Instead the spoken
form SHALL render on a visually-hidden sibling with the visible `<time>` marked `aria-hidden`; when
no `ariaLabel` is supplied the visible line SHALL remain its own accessible name. The card's
existing `progressAriaLabel` SHALL NOT be altered.

#### Scenario: Aggregate card shows its reset time
- **WHEN** `dayCostStats` carries a `resetsAt` and the card renders
- **THEN** a reset line appears below the card's caption row, containing the formatted local
  date-time with its timezone, and a `<time>` element whose `dateTime` is the original UTC string

#### Scenario: Unlimited card still shows its reset time
- **WHEN** `weekCostStats.total >= 2 ** 53` and the stat carries a `resetsAt`
- **THEN** the card renders the unlimited treatment (spend only, no ratio) **and** the reset line

#### Scenario: Period header shows its reset time in an info tooltip
- **WHEN** the Model-limits table renders and the top-level `monthCostStats` carries a `resetsAt`
- **THEN** the month period header shows the column label and a focusable info icon named by the
  spoken reset form, and no visible reset line
- **AND** hovering or focusing the icon shows the formatted reset time in a `<time>` tooltip

#### Scenario: Mobile layout does not overflow
- **WHEN** the Usage page renders at mobile width with a long formatted reset label
- **THEN** the label wraps within its container and the page does not scroll horizontally
