## ADDED Requirements

### Requirement: ModelLimitsSection public API

The library SHALL export from `src/index.ts`, in addition to its existing `UsageLimitCardGroup`/
`UsageLimitCard` surface: the component `ModelLimitsSection`; the string enums `ModelLimitStatus`
(`WithinLimits = 'within-limits'`, `RunningLow = 'running-low'`, `LimitReached = 'limit-reached'`,
`NoLimit = 'no-limit'`, `Unavailable = 'unavailable'`), `ModelLimitsPeriod`
(`LastMinute = 'last-minute'`, `LastHour = 'last-hour'`, `Last24Hours = 'last-24-hours'`,
`Last7Days = 'last-7-days'`, `Last30Days = 'last-30-days'`), and
`ModelLimitMetricKind` (`Finite = 'finite'`, `Unlimited = 'unlimited'`, `Unavailable = 'unavailable'`);
and the types `ModelLimitMetricCell`, `ModelLimitRow`, `ModelLimitsLabels`, `ModelLimitsColors`,
`ModelLimitsTypography`, `ModelLimitsStyles`, `ModelLimitsSectionProps`.

`ModelLimitMetricCell` SHALL carry a `kind: ModelLimitMetricKind` discriminant
plus already-formatted, normalized fields: `usedLabel?: string` (finite/unlimited), `totalLabel?:
string` (finite only), `usedPercent?: number` (finite only, not pre-clamped), `status?:
ModelLimitStatus` (finite only — `WithinLimits`/`RunningLow`/`LimitReached`), and `ariaLabel: string`
(always present, describing the cell's full accessible text regardless of kind). The library SHALL
treat `usedPercent` as opaque, used only to drive the progress bar's `value`/`aria-valuetext`, and
SHALL NOT recompute it, detect the unlimited sentinel, or derive `status` itself.

`ModelLimitRow` SHALL carry: `id: string`, `name: string`, `version?: string`, `avatarSrc?: string`,
`cost: ModelLimitMetricCell`, `tokens: ModelLimitMetricCell`, `requests: ModelLimitMetricCell`, and
`status: ModelLimitStatus` (the host-derived overall row status, including `NoLimit`/`Unavailable`).

`ModelLimitsSectionProps` SHALL accept: `rows: ModelLimitRow[]` (in display order), `period:
ModelLimitsPeriod`, `onPeriodChange: (period: ModelLimitsPeriod) => void`, `labels:
ModelLimitsLabels`, and an optional `styles?: ModelLimitsStyles`.

#### Scenario: Section exports are available
- **WHEN** a consumer imports from `@epam/ai-dial-usage-dashboard`
- **THEN** `ModelLimitsSection`, `ModelLimitStatus`, `ModelLimitsPeriod`, `ModelLimitMetricKind`,
  `ModelLimitMetricCell`, `ModelLimitRow`, `ModelLimitsLabels`, `ModelLimitsColors`,
  `ModelLimitsTypography`, `ModelLimitsStyles`, and `ModelLimitsSectionProps` are all importable

#### Scenario: Multiple rows rendered in order
- **WHEN** `ModelLimitsSection` is rendered with a `rows` array of two or more entries
- **THEN** it renders one row per entry, in array order, each showing its own avatar, name,
  version, and Cost/Tokens/Requests/Status cells

#### Scenario: Empty rows renders the section shell without a table body
- **WHEN** `ModelLimitsSection` is rendered with an empty `rows` array
- **THEN** it still renders the heading (with a count of `0`) and the period selector, but renders
  no data rows

---

### Requirement: Model limits heading reflects the rendered row count

The library SHALL render `labels.headingLabel` as the section title and `rows.length` as a separate,
visually secondary count in the same semantic heading, so the number of models shown is always
visible next to the "Model limits" title.

#### Scenario: Heading reflects row count
- **WHEN** `ModelLimitsSection` is rendered with 5 rows
- **THEN** the heading contains `labels.headingLabel` followed by a separately styled count `5`

---

### Requirement: Controlled period selector

`ModelLimitsSection` SHALL render a period selector reflecting the `period` prop and call
`onPeriodChange` with the newly selected `ModelLimitsPeriod` when the user picks a different option;
it SHALL NOT manage period selection as internal state. The library SHALL NOT infer, cache, or
persist the period itself.

#### Scenario: Selecting a period calls the callback
- **WHEN** the user activates the "Last 7 days" option in the period selector
- **THEN** `onPeriodChange` is called with `ModelLimitsPeriod.Last7Days`, and the library does not
  change its own rendered `period` until the host re-renders with the new value

#### Scenario: Selected period is visually and programmatically indicated
- **WHEN** `period` is `ModelLimitsPeriod.Last24Hours`
- **THEN** the corresponding option is visually emphasized and exposes its selected state via the
  selector's ARIA selection attribute (not color alone)

---

### Requirement: Per-metric cell rendering by kind

For a `finite` cell, the library SHALL render `usedLabel` and `totalLabel` inline in the visible
`usedLabel / totalLabel` form, followed by an accessible progress bar whose visual fill and label percentage
are clamped to `[0, 100]` while `ariaLabel` conveys the real, uncapped value — following the same
clamp-visual/preserve-accessible-value pattern as `UsageLimitCard`. For an `unlimited` cell, the
library SHALL render `usedLabel` followed by `labels.noLimitLabel`, with no progress bar. For an
`unavailable` cell, the library SHALL render `labels.unavailableLabel` with no progress bar and
SHALL visually and semantically distinguish it from the `unlimited` rendering (different text,
different `aria-label`).

Each `finite` cell's progress fill color SHALL reflect its own `status`
(`WithinLimits`→default/blue, `RunningLow`→warning/amber, `LimitReached`→error/red), independent of
the other cells in the same row.

#### Scenario: Finite metric renders used/total with a progress bar
- **WHEN** a cell has `kind: ModelLimitMetricKind.Finite`, `usedLabel: '12,345'`, `totalLabel: '50,000'`,
  `usedPercent: 24.69`
- **THEN** the cell renders `'12,345 / 50,000'` and a progress bar with `aria-valuetext` equal to
  the cell's `ariaLabel`

#### Scenario: Unlimited metric renders used value and "No limit", no progress bar
- **WHEN** a cell has `kind: ModelLimitMetricKind.Unlimited`, `usedLabel: '$3.20'`
- **THEN** the cell renders `'$3.20'` followed by `labels.noLimitLabel`, and renders no progress bar

#### Scenario: Unavailable metric is visually distinct from unlimited
- **WHEN** a cell has `kind: ModelLimitMetricKind.Unavailable`
- **THEN** the cell renders `labels.unavailableLabel` text that differs from `labels.noLimitLabel`,
  and renders no progress bar

#### Scenario: Over-100% finite value clamps visually but not accessibly
- **WHEN** a `finite` cell's `usedPercent` is `137`
- **THEN** the progress bar's visual fill and any visible percent readout are clamped to 100, while
  `aria-valuetext` (from the cell's `ariaLabel`) still reflects the real value

---

### Requirement: Overall row status

The library SHALL render a status treatment reflecting `row.status`: `WithinLimits`,
`RunningLow`, and `LimitReached` render the corresponding labeled badge (reusing the same
badge/accent visual treatment as `UsageLimitCard`'s existing status badges); `NoLimit` and
`Unavailable` render their localized labels as plain secondary text without a badge background.
Color SHALL NOT be the only indicator — status text is always present.

#### Scenario: No-limit row renders distinct plain text, not a copy of "within limits"
- **WHEN** a row's `status` is `ModelLimitStatus.NoLimit`
- **THEN** the row renders `labels.noLimitBadgeLabel` as plain secondary text without a badge
  background, not `labels.withinLimitsBadgeLabel`

#### Scenario: Most severe status renders its matching badge
- **WHEN** a row's `status` is `ModelLimitStatus.LimitReached`
- **THEN** the row renders a badge with `labels.limitReachedBadgeLabel` text and the error accent

---

### Requirement: Model identity rendering reuses `DeploymentIcon`

Each row SHALL render its model avatar via the `chat-shared` `DeploymentIcon` component (`src:
row.avatarSrc`, `initialsName: row.name`) at 40×40px with a 12px radius. The identity text SHALL
render `labels.modelTypeLabel` above a single line containing the model name and, when present,
`row.version`. The library SHALL NOT import any `libs/catalog` component or any new heavy peer
dependency to render model identity.

#### Scenario: Row without an avatar URL falls back to initials
- **WHEN** a row's `avatarSrc` is `undefined`
- **THEN** `DeploymentIcon` renders its initials-based fallback derived from `row.name`

#### Scenario: Long names remain accessible when visually truncated
- **WHEN** a row's `name` is long enough to be visually truncated in the identity cell
- **THEN** the full `name` text remains available to assistive technology (e.g. via the element's
  accessible name or a tooltip), not only the visually truncated text

---

### Requirement: Model limits table responsive and RTL layout

`ModelLimitsSection` SHALL use only the repository's `mobile:`/`desktop:` Tailwind breakpoints, CSS
logical properties for all directional spacing/alignment/borders, and no physical-direction
utilities for directional layout. On `desktop:`, the table SHALL render as a 5-column grid (Item,
Cost, Tokens, Requests, Status) with a header row, row dividers, and no vertical column borders,
inside a rounded raised container. On the mobile-first base styles, each row SHALL reflow into a
single-column stacked layout that repeats each column's label inline next to its value, preserving
all five pieces of information with no horizontal page overflow at a 360px viewport width. The
library SHALL NOT mount two separate component subtrees for the two layouts.

#### Scenario: No horizontal overflow on mobile
- **WHEN** `ModelLimitsSection` is rendered in a 360px-wide viewport with multiple rows present
- **THEN** the container and its children do not cause horizontal page scroll, and every column's
  value remains visible with its label

#### Scenario: Desktop renders a 5-column grid with no vertical column borders
- **WHEN** `ModelLimitsSection` is rendered at the desktop breakpoint
- **THEN** Item, Cost, Tokens, and Requests render as four equal flexible columns, Status renders
  as a fixed 160px column, rows use 12px vertical / 24px horizontal padding with a 64px minimum
  height, and the raised 12px-radius table has `shadow-md`, horizontal row dividers, and no vertical
  borders between columns

---

### Requirement: Model limits accessibility

The section SHALL expose a programmatically named region for "Model limits" including the row
count (e.g. via `aria-label` built from the same count used in the heading). The underlying markup
SHALL expose semantic table roles (`role="table"`/`"rowgroup"`/`"row"`/`"columnheader"`/`"cell"`) on
desktop and mobile alike. Every progress bar SHALL expose a meaningful `aria-valuetext` per the
cell-rendering requirement above. Decorative avatar images and redundant icons SHALL be
`aria-hidden`. The period selector SHALL support keyboard navigation (arrow keys / Home / End,
matching `DialSegmentedControl`'s existing keyboard support) and expose the selected option via the
selector's own selection ARIA attribute.

#### Scenario: Section is a named, countable region
- **WHEN** the "Model limits" section is rendered with 7 rows
- **THEN** it exposes an accessible name/label that includes the count `7`

#### Scenario: Keyboard users can change the selected period
- **WHEN** a keyboard user focuses the period selector and presses the arrow key toward another
  option
- **THEN** focus and selection move to that option and `onPeriodChange` fires, with no mouse
  interaction required
