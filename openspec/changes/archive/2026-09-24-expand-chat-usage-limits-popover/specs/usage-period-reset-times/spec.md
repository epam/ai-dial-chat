## ADDED Requirements

### Requirement: Reset times are displayed in the conversation-input usage popover

The usage popover rendered beside the conversation input SHALL display the reset time for each
token-limit row whose stat carries a `resetsAt` that formats successfully.

- The reset line SHALL render beneath the row's label, alongside the existing `$X spent` caption, so
  the row's value column and progress bar do not move.
- The line SHALL be rendered by `LimitRow` in `libs/catalog` from the preformatted `resetLabel`,
  `resetIsoValue`, and `resetAriaLabel` fields on `UsageLimitProgressRow` — never from a raw
  `resetsAt`.
- The markup SHALL follow the pattern already required for `UsageLimitCard`: a
  `<time dateTime={resetIsoValue}>` element carrying the visible text and the machine-readable
  instant, marked `aria-hidden`, with the spoken expansion on a visually-hidden sibling. `<time>` has
  no implicit ARIA role, so `aria-label` on it is `aria-prohibited-attr`. When `resetAriaLabel` is
  absent the visible line SHALL remain its own accessible name.
- The line SHALL render on an unlimited ("follows cost limit") row as well as on a capped one — an
  unconfigured limit still accumulates against a period that rolls over.

No new i18n keys are introduced: `usage.resetsAtLabel` and `usage.resetsAtAriaLabel` are reused
unchanged.

**RTL:** the reset line is text only, with no directional icon and no physical-direction spacing
class; it uses logical utilities and inherits `dir` through the cascade, and `Intl` already orders
date parts per locale. **Responsive:** the line lives inside the row's existing label container and
SHALL wrap rather than force horizontal overflow at mobile width. **Memoisation:** the popover's
`formatResetTime` callback SHALL be `useCallback`-stable on the active locale and `t`, since it feeds
a `useMemo`-ed mapper call.

#### Scenario: A configured period shows its reset time

- **WHEN** `dayTokenStats` carries a `resetsAt` and the popover opens
- **THEN** the day row shows a reset line containing the formatted local date-time with its
  timezone, and a `<time>` element whose `dateTime` is the original UTC string

#### Scenario: An unlimited row still shows its reset time

- **WHEN** a token stat's `total` is at or above `Number.MAX_SAFE_INTEGER` and the stat carries a
  `resetsAt`
- **THEN** the row renders the follows-cost-limit treatment **and** the reset line

#### Scenario: Mobile layout does not overflow

- **WHEN** the popover opens at mobile width with a long formatted reset label
- **THEN** the label wraps within the popover's viewport-relative maximum width and the page does
  not scroll horizontally

#### Scenario: The spoken form names the timezone in full

- **WHEN** a screen reader reads a row's reset affordance
- **THEN** it announces the `resetAriaLabel` text from the visually-hidden sibling, not the visible
  short-offset line

---

### Requirement: `libs/catalog` never interprets a reset timestamp

`libs/catalog` SHALL be held to the same constraint already placed on `libs/usage-dashboard`: it
SHALL NOT parse, format, or timezone-shift a `resetsAt` value, construct a `Date`, call a date/time
`Intl` API, or receive a locale, a timezone, a `TFunction`, or a raw `resetsAt` at all. Its props
carry only the preformatted `resetLabel` / `resetIsoValue` / `resetAriaLabel` strings.

All interpretation SHALL remain at the application edge in
`apps/chat/src/utils/usage-reset-time.ts`, supplied to the mapper as a `formatResetTime` callback
typed against the structural `FormatResetTime` / `ResetTimeDisplay` declared in
`libs/chat-hooks/src/usage/`. `libs/chat-hooks` SHALL NOT import the app's own `ResetTimeDisplay`
type, and the two shapes SHALL stay field-for-field identical so the app's
`formatUsageResetTime` return value satisfies the library's type with no cast at the call site.

`@epam/ai-dial-catalog` SHALL NOT export a `FormatResetTime`, a `ResetTimeDisplay`, or any
reset-time mapper of its own.

#### Scenario: Library never interprets a timestamp

- **WHEN** `libs/catalog`'s sources are inspected
- **THEN** no file parses, formats, or timezone-shifts a `resetsAt` value, constructs a `Date`, or
  calls a date/time `Intl` API, and no file receives a raw `resetsAt`; the module-boundary lint
  passes

#### Scenario: The app edge does the formatting

- **WHEN** the conversation-input popover builds its `CatalogItemLimits` value
- **THEN** it passes `formatUsageResetTime` bound to the active locale and `t` into
  `mapDeploymentLimitsToInput`, and only the strings that callback returned reach `libs/catalog`

---

### Requirement: Popover reset degradation matches the Usage tab's

A reset time in the conversation-input popover SHALL be decoration on a usage figure and never a
gate on it. No degradation path SHALL hide, blank, or alter a row's `used`, `total`, progress bar,
spent caption, or the group's status, and none SHALL prevent the popover from opening.

| Condition | Required behaviour |
| --- | --- |
| `resetsAt` absent | No reset line on that row. The row renders exactly as it would have. |
| `resetsAt` unparseable (`Date.parse` → `NaN`) | Identical to absent. No error surfaced, no notification raised, no console error emitted. |
| `resetsAt` already in the past on arrival | Rendered verbatim from Core. No boundary timer is armed. |
| `Intl` unavailable or throwing | Identical to absent. |

The popover SHALL NOT arm a boundary-triggered re-fetch. The Usage tab's boundary-timer requirement
is scoped to that tab; the popover already refreshes on open and once after an active generation
ends, and it is a transient surface that is closed most of the time.

#### Scenario: Malformed timestamp does not cost the user their figures

- **WHEN** a token stat is `{ "total": 100, "used": 10, "resetsAt": "not-a-date" }`
- **THEN** the row renders `used`, `total`, the progress bar, and the spent caption exactly as it
  would without `resetsAt`, no reset line appears, and no error notification is shown

#### Scenario: Missing timestamp renders the pre-change row

- **WHEN** a stat carries no `resetsAt`
- **THEN** the row is visually identical to what the same stat would have rendered before reset
  lines existed

#### Scenario: Past boundary is shown without arming a timer

- **WHEN** a stat's `resetsAt` is earlier than the current time when the response arrives
- **THEN** the reset line renders that value and no re-fetch is scheduled

#### Scenario: No timer is ever armed by the popover

- **WHEN** the popover renders rows carrying future reset boundaries
- **THEN** no `setTimeout` is armed for those boundaries and no extra request is issued beyond the
  existing open and post-generation refreshes
