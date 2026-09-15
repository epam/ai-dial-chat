## MODIFIED Requirements

### Requirement: Period-to-field mapping

The adapter SHALL always map all three displayed **calendar** periods from
`DeploymentLimitsResponseDto` as follows and SHALL NOT substitute another period or metric when a
field is missing:

| Period column | Cost field | Tokens field |
|---|---|---|
| day (current UTC day) | `dayCostStats` | `dayTokenStats` |
| week (current UTC week) | `weekCostStats` | `weekTokenStats` |
| month (current UTC month) | `monthCostStats` | `monthTokenStats` |

The period cells SHALL be keyed `day`, `week`, and `month` on `ModelLimitRow`, matching the renamed
`@epam/ai-dial-usage-dashboard` public API. The adapter SHALL NOT describe or label these periods as
trailing or rolling windows of 24 hours, 7 days, or 30 days.

Minute, hour, and request fields SHALL NOT be mapped into the table.

#### Scenario: One row carries all three period pairs
- **WHEN** a deployment contains usable day, week, and month Cost and Tokens stats
- **THEN** the row's `day`, `week`, and `month` period cells contain the matching Cost and Tokens
  stats from the table above

#### Scenario: Missing period stat is not substituted
- **WHEN** `weekTokenStats` is absent but `dayTokenStats` and `monthTokenStats` are present
- **THEN** the week Tokens cell is `Unavailable`, while the day and month cells use their own
  fields; neither is substituted into week

#### Scenario: Requests and short windows are excluded
- **WHEN** minute/hour/request fields contain usage
- **THEN** they do not create a displayed cell, affect row inclusion, or affect row Status

---

### Requirement: Per-metric finite/unlimited/unavailable detection

For every displayed period, the adapter SHALL produce a normalized Cost cell and Tokens cell using
the **same** sentinel test for both metrics. A Cost or Tokens entry SHALL be `Finite` when its
`total` and `used` are finite and `total < 2 ** 53`, `Unlimited` when well-formed and
`total >= 2 ** 53`, and `Unavailable` when absent or non-finite. Missing data SHALL NOT be treated as
zero or unlimited.

An `Unlimited` Cost cell SHALL render formatted attributed spend with no limit text and no progress
bar, exactly as today. A `Finite` Cost cell SHALL produce progress data and a derived metric status,
which `getRowStatus` SHALL fold in alongside finite Tokens statuses. The adapter SHALL NOT hard-code
the assumption that a per-deployment Cost `total` is always the unlimited sentinel.

DIAL Core's role model configures cost limits only at the role level (`Role.costLimit`); per-
deployment `Role.limits` entries carry token and request windows with no cost field. Every payload
observed to date therefore reports the sentinel for per-deployment Cost, so this detection is
behaviour-preserving in practice — it removes an assumption rather than acting on a new one.

Finite `usedPercent` SHALL retain values above 100 for both metrics; only rendering may clamp the
progress fill. An unlimited Tokens entry SHALL receive `Follows cost limit` when the matching
top-level overall Cost stat is finite; it SHALL receive `No limit` only when that overall Cost stat
is also unlimited.

#### Scenario: Finite tokens produce progress data for their period
- **WHEN** `weekTokenStats` is `{ total: 10000, used: 4000 }`
- **THEN** the week Tokens cell is `Finite` with `usedPercent: 40` and its own derived metric status

#### Scenario: Sentinel period cost remains attributed spend without a cap
- **WHEN** `dayCostStats` is `{ total: 9223372036854775807, used: 4.2 }`
- **THEN** the day Cost cell is `Unlimited`, displays formatted `4.2` spend, and has no progress bar

#### Scenario: Finite period cost produces a capped cell
- **WHEN** `dayCostStats` is `{ total: 10, used: 8 }`
- **THEN** the day Cost cell is `Finite` with `usedPercent: 80`, a `RunningLow` metric status, and
  that status contributes to the row's overall Status

#### Scenario: Missing token stat stays unavailable
- **WHEN** `monthTokenStats` is missing
- **THEN** the month Tokens cell is `Unavailable`, not zero and not copied from another period

#### Scenario: Missing cost stat stays unavailable
- **WHEN** `weekCostStats` is missing
- **THEN** the week Cost cell is `Unavailable`, not zero and not unlimited

#### Scenario: Over-limit percentage remains uncapped in normalized data
- **WHEN** `dayTokenStats` is `{ total: 1000, used: 1500 }`
- **THEN** the day Tokens cell has `usedPercent: 150` and a `LimitReached` metric status

---

### Requirement: Aggregate period cost cards

The `mapUsageDataToDashboard` utility (in `libs/usage-dashboard`, see the `usage-dashboard-lib` capability) SHALL map the top-level
`dayCostStats`, `weekCostStats`, and `monthCostStats` fields from `UserLimitStatsResponseDto` into
`UsageLimitCardData[]` for `UsageLimitCardGroup`. A period whose stats are absent or non-finite
SHALL be omitted from the array entirely. Card `title` and `periodDescription` SHALL use calendar
wording (`Today`, `This week`, `This month`) and SHALL NOT use trailing-window wording
(`Last 24 hours`, `Last 7 days`, `Last 30 days`).

The utility SHALL accept a host-supplied `formatResetTime: (resetsAt: string | undefined) => ResetTimeDisplay | undefined`
callback and SHALL populate each card's `resetLabel`, `resetIsoValue`, and `resetAriaLabel` from its
result. When the callback returns `undefined` — because `resetsAt` was absent, unparseable, or
`Intl` was unavailable — the card SHALL carry no reset fields and SHALL otherwise be identical to
its pre-change output. The utility SHALL NOT parse or format a timestamp itself.

When a period's `total >= 2 ** 53` (the unlimited sentinel — Long.MAX_VALUE from the backend,
meaning no cost limit is configured for that period), the adapter SHALL produce a card with
`isUnlimited: true`. The library then renders only `usedLabel` (the spend so far), the
`Default` status badge, and the reset line when one is present — no progress bar, no used-of-total
caption, no remaining caption, and no used-percent label. This is the expected behavior when an
administrator has not configured a cost limit for the period; the absence of limit information is
intentional and SHALL NOT be treated as a display error.

#### Scenario: Unconfigured weekly limit shows spend only

- **WHEN** `weekCostStats.total >= 2 ** 53` (no weekly cost limit configured)
- **THEN** the week aggregate card renders only the used spend label and the
  `Default` (`Within limits`) badge — no progress bar, no `used of $total`, no remaining
  amount, and no percentage

#### Scenario: Configured daily limit shows full card

- **WHEN** `dayCostStats.total < 2 ** 53` (a finite daily cost limit is set)
- **THEN** the day aggregate card renders `usedLabel`, `used of $totalLabel`, a
  progress bar, `remainingLabel`, and the used-percent label alongside the status badge

#### Scenario: Period with absent stats is omitted

- **WHEN** a period's stats field is absent or its `total`/`used` are non-finite
- **THEN** no card is produced for that period and the remaining periods are unaffected

#### Scenario: Reset time flows through to the card

- **WHEN** `monthCostStats` carries `resetsAt: "2026-10-01T00:00:00Z"` and `formatResetTime`
  returns a display value for it
- **THEN** the month card carries `resetLabel`, `resetIsoValue: "2026-10-01T00:00:00Z"`, and
  `resetAriaLabel`

#### Scenario: Unformattable reset time yields a card with no reset fields

- **WHEN** `formatResetTime` returns `undefined` for a period's `resetsAt`
- **THEN** that card carries no `resetLabel`/`resetIsoValue`/`resetAriaLabel` and its other fields
  are unchanged

---

### Requirement: Overall Cost period header indicators

`mapOverallCostLimitsToPeriodStatuses` SHALL normalize the top-level stats into period headers.
The utility (in `libs/usage-dashboard`, see the
`usage-dashboard-lib` capability) SHALL normalize the top-level `dayCostStats`, `weekCostStats`, and
`monthCostStats` into a `ModelLimitPeriodStatuses` value keyed `day`, `week`, and `month`. Each
entry SHALL carry the status and tooltip derived exactly as today, plus the preformatted reset trio
produced by the same host-supplied `formatResetTime` callback used for the aggregate cards, read
from the same top-level stat that drives the entry's status.

The utility SHALL NOT read a per-deployment `resetsAt` for a period header, and SHALL NOT reconcile
a top-level `resetsAt` against a differing per-deployment one.

#### Scenario: Header indicator uses the same overall Cost budget as its card

- **WHEN** the top-level `dayCostStats` is finite and at or above the running-low threshold
- **THEN** the day period header shows the running-low indicator with its tooltip, matching the day
  aggregate card's status

#### Scenario: Header reset time matches its card

- **WHEN** the top-level `weekCostStats` carries a `resetsAt`
- **THEN** the week period header's `resetLabel` is the same formatted value the week aggregate card
  carries

#### Scenario: Divergent per-deployment reset time is ignored for the header

- **WHEN** a deployment's `dayCostStats.resetsAt` differs from the top-level `dayCostStats.resetsAt`
- **THEN** the day period header shows the top-level value and neither value is adjusted
