# usage-period-reset-times Specification

## Purpose

Defines DIAL Core's `resetsAt` contract end to end: the optional ISO-8601 UTC instant on every
day/week/month cost and token stat, the calendar-period (not rolling-window) semantics its presence
establishes, its normalization and localized formatting at the `apps/chat` edge, the rules for
degrading silently when it is absent, unparseable, already past, or inconsistent, and the
boundary-triggered re-fetch that keeps post-reset figures coming from DIAL Core rather than from
local arithmetic. All `Date`/`Intl` work lives in `apps/chat`; `libs/usage-dashboard` receives
preformatted strings only (see the `usage-dashboard-lib`, `usage-model-limits`, `usage-data-hook`,
and `user-usage-limits-api` capabilities).

## Requirements

### Requirement: `resetsAt` contract and calendar-period semantics

Every day, week, and month cost or token stat SHALL be typed as
`LimitStatsDto { total: number; used: number; resetsAt?: string }`, on both
`GET /api/v1/user/usage` and `GET /api/v1/user/limits`.

`resetsAt` SHALL be documented and treated as:

- an **ISO-8601 instant with an explicit UTC designator**, e.g. `2026-09-16T00:00:00Z`
- **optional** — DIAL Core MAY omit it on any stat, and its absence SHALL NOT be an error
- the **exclusive end** of the stat's current accumulation period: at that instant the period rolls
  over and Core begins reporting against a fresh window
- evidence that the day, week, and month periods are **calendar periods anchored to UTC
  boundaries** — UTC midnight, UTC week start, and UTC month start — and NOT trailing/rolling
  windows of 24 hours, 7 days, or 30 days

The BFF SHALL forward `resetsAt` exactly as DIAL Core sends it. It SHALL NOT parse, reformat,
normalize to another timezone, clamp, drop, or synthesize the value, and SHALL NOT compute a reset
boundary when Core omits one.

Documented period semantics in DTO `@ApiProperty` descriptions, `@ApiOperation` descriptions,
library JSDoc, READMEs, and `docs/architecture.md` SHALL describe these fields in calendar terms
("the current UTC day", "the current UTC week", "the current UTC month") and SHALL NOT describe them
as trailing, rolling, or "last N days" windows.

**Example `GET /api/v1/user/usage` response (200):**

```json
{
  "deployments": {
    "gpt-4o": {
      "dayTokenStats": { "total": 10000, "used": 4000, "resetsAt": "2026-09-16T00:00:00Z" },
      "weekTokenStats": { "total": 50000, "used": 20000, "resetsAt": "2026-09-21T00:00:00Z" },
      "monthTokenStats": { "total": 200000, "used": 80000, "resetsAt": "2026-10-01T00:00:00Z" },
      "dayCostStats": { "total": 9223372036854775807, "used": 0.42, "resetsAt": "2026-09-16T00:00:00Z" },
      "weekCostStats": { "total": 9223372036854775807, "used": 1.9 },
      "monthCostStats": { "total": 9223372036854775807, "used": 7.5 }
    }
  },
  "minuteCostStats": { "total": 0.069, "used": 0.001 },
  "dayCostStats": { "total": 100, "used": 10, "resetsAt": "2026-09-16T00:00:00Z" },
  "weekCostStats": { "total": 500, "used": 100, "resetsAt": "2026-09-21T00:00:00Z" },
  "monthCostStats": { "total": 20000, "used": 1000, "resetsAt": "2026-10-01T00:00:00Z" }
}
```

#### Scenario: Core sends a reset timestamp
- **WHEN** DIAL Core returns `dayCostStats` as `{ "total": 100, "used": 10, "resetsAt": "2026-09-16T00:00:00Z" }`
- **THEN** the BFF's `200` response body contains that exact `resetsAt` string, byte for byte, with
  no reformatting or timezone conversion

#### Scenario: Core omits the reset timestamp
- **WHEN** DIAL Core returns a stat with only `total` and `used`
- **THEN** the BFF's response omits `resetsAt` for that stat, returns `200`, and SHALL NOT compute
  or insert a substitute boundary

#### Scenario: Reset timestamp appears on a per-deployment stat
- **WHEN** a `deployments.<name>.dayTokenStats` entry carries `resetsAt`
- **THEN** it is forwarded unchanged, exactly as a top-level stat's `resetsAt` is

---

### Requirement: Reset-time normalization at the application edge

All interpretation of `resetsAt` SHALL happen in `apps/chat`, never in a hand-authored library.
`apps/chat/src/utils/usage-reset-time.ts` SHALL expose a formatter with this contract:

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
`resetsAt` value. `UsageTab` SHALL supply the formatter to `mapUsageDataToDashboard` and
`mapOverallCostLimitsToPeriodStatuses` as a `formatResetTime` callback, following the existing
`resolveIconUrl` / `resolveDisplayName` callback pattern, and SHALL wrap it in `useCallback` so the
mappers' `useMemo` dependencies stay stable. `mapUserUsageToModelLimits` does not take the callback:
reset times are rendered per period header, not per row.

#### Scenario: UTC boundary is rendered in the viewer's timezone
- **WHEN** `resetsAt` is `2026-09-16T00:00:00Z` and the viewer's resolved zone is `Europe/Warsaw`
  (UTC+2)
- **THEN** `label` names 16 September at 02:00 and includes the offset (`GMT+2`), and `resetsAtMs`
  equals `Date.parse('2026-09-16T00:00:00Z')`

#### Scenario: Timezone is always stated
- **WHEN** any `resetsAt` is formatted
- **THEN** the visible `label` contains a timezone designator, so a UTC boundary shown in local time
  is never ambiguous

#### Scenario: Library never interprets a timestamp
- **WHEN** `libs/usage-dashboard`'s sources are inspected
- **THEN** no file parses, formats, or timezone-shifts a `resetsAt` value, constructs a `Date`, or
  calls a date/time `Intl` API; the mappers pass each raw `resetsAt` straight to the host's
  `formatResetTime` callback and store only the strings it returns, and the module-boundary lint
  passes

> The library's pre-existing `Intl.NumberFormat` instances for Tokens formatting are unaffected —
> the constraint is on date/time interpretation, not on `Intl` as a namespace.

---

### Requirement: Reset times are displayed for aggregate budgets and period headers

Settings → Usage SHALL display the reset time for each of the three aggregate cost cards
(`dayCostStats`, `weekCostStats`, `monthCostStats`) and for each of the three Model-limits period
headers.

- On a `UsageLimitCard`, the reset line SHALL render below the existing remaining/percent caption
  row as a `<time dateTime={resetIsoValue}>` element, so existing content does not move.
- On a Model-limits `PeriodHeader`, the reset line SHALL render as a second line beneath the column
  label, sourced from the same top-level `*CostStats` stat that drives that header's status.
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

#### Scenario: Period header shows its reset time
- **WHEN** the Model-limits table renders and the top-level `monthCostStats` carries a `resetsAt`
- **THEN** the month period header shows the column label and, beneath it, the formatted reset time

#### Scenario: Mobile layout does not overflow
- **WHEN** the Usage tab renders at mobile width with a long formatted reset label
- **THEN** the label wraps within its container and the page does not scroll horizontally

---

### Requirement: Degradation for absent, invalid, past, or inconsistent reset times

A reset time SHALL be treated as decoration on a usage figure and never as a gate on it. No
degradation path SHALL hide, blank, or alter `used`, `total`, a progress bar, a status, or a badge.

| Condition | Required behaviour |
| --- | --- |
| `resetsAt` absent | No reset affordance is rendered. The card or header renders exactly as it did before this change. |
| `resetsAt` unparseable (`Date.parse` → `NaN`) | Identical to absent. No error is surfaced, no notification is raised, no console error is emitted. |
| `resetsAt` already in the past on arrival | The value is rendered verbatim from Core, and no boundary timer is armed for it. |
| Top-level and per-deployment `resetsAt` differ for the same period | Each is displayed against its own stat; the aggregate card and the period header both use the top-level value. No reconciliation and no "most conservative wins" rule is applied. |
| `Intl` unavailable or throwing | Identical to absent. |

#### Scenario: Malformed timestamp does not cost the user their figures
- **WHEN** `dayCostStats` is `{ "total": 100, "used": 10, "resetsAt": "not-a-date" }`
- **THEN** the card renders `used`, `total`, the progress bar, and the status badge exactly as it
  would without `resetsAt`, no reset line appears, and no error notification is shown

#### Scenario: Missing timestamp renders the pre-change card
- **WHEN** a stat carries no `resetsAt`
- **THEN** the card is visually identical to the pre-change rendering for that stat

#### Scenario: Past boundary is shown without arming a timer
- **WHEN** a stat's `resetsAt` is earlier than the current time when the response arrives
- **THEN** the reset line renders that value and no re-fetch is scheduled for it

#### Scenario: Divergent timestamps are each shown in place
- **WHEN** the top-level `dayCostStats.resetsAt` differs from a deployment's
  `dayCostStats.resetsAt`
- **THEN** the aggregate card and period header show the top-level value, and neither value is
  adjusted to match the other

---

### Requirement: Usage refreshes from DIAL Core when a reset boundary passes

The Usage tab SHALL request fresh data by re-invoking `getUserUsage()` when the earliest future
reset boundary among the displayed aggregate cards elapses while the tab is mounted.

The system SHALL NOT locally zero a `used` value, restore a `total`, recompute a status, or
synthesize any post-reset state. Usage figures SHALL only ever be replaced by a resolved
`getUserUsage()` response.

Scheduling rules:

- The delay SHALL be computed as `earliestResetMs - Date.now()` plus a small settle margin, so Core
  has rolled the window over before the request is sent.
- The delay SHALL be clamped to `2 ** 31 - 1` ms. A delay exceeding `setTimeout`'s 32-bit ceiling
  overflows and fires immediately, which would cause a re-fetch storm; when clamped, the timer SHALL
  re-arm on wake instead of re-fetching.
- The timer SHALL be cleared on unmount and re-derived whenever `usage` changes.
- On `visibilitychange` to `visible`, the tab SHALL re-check whether the boundary has elapsed, since
  a suspended device may have fired the timer late or not at all.
- The re-fetch SHALL be silent: the full-tab loading spinner SHALL NOT be re-shown, and no
  announcement is made.
- If the re-fetch rejects, the existing `usageError` notification path applies and the previously
  rendered figures remain on screen.

#### Scenario: Boundary elapses and fresh data replaces the figures
- **WHEN** the day card's `resetsAt` elapses while the Usage tab is open
- **THEN** `getUserUsage()` is called again and the rendered figures come from that new response

#### Scenario: Usage is never locally reset
- **WHEN** a boundary elapses but the re-fetch has not yet resolved
- **THEN** the previously fetched `used`/`total` values remain rendered unchanged; nothing is
  zeroed or restored locally

#### Scenario: A far-future boundary does not fire immediately
- **WHEN** the earliest boundary is more than `2 ** 31 - 1` ms away (a month boundary can be)
- **THEN** the timer is clamped, no immediate re-fetch occurs, and the timer re-arms on wake

#### Scenario: Waking after a missed boundary refreshes
- **WHEN** the tab becomes `visible` again and the earliest boundary has already passed
- **THEN** `getUserUsage()` is called

#### Scenario: Refresh failure preserves what is on screen
- **WHEN** the boundary-triggered re-fetch rejects
- **THEN** the existing error notification path fires and the last successful figures stay rendered

#### Scenario: No boundary means no timer
- **WHEN** no displayed card carries a future `resetsAt`
- **THEN** no timer is armed and no extra request is made
