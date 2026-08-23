# usage-dashboard-lib Specification

## Purpose

Defines the host-agnostic `@epam/ai-dial-usage-dashboard` library: the presentational
`UsageLimitCardGroup`/`UsageLimitCard` components that render the Usage settings page's
aggregate cost-limit cards, and the `ModelLimitsSection` component that renders the per-model
limits table below them — their public prop/label/color contracts, status-driven visual
treatment, accessibility, and responsive/RTL behavior. The library never interprets raw DTOs,
formats currency, computes percentages, or derives status — that stays in `apps/chat` (see the
`usage-data-hook` and `usage-model-limits` capabilities).

## Requirements

### Requirement: Host-agnostic usage-dashboard library

The system SHALL provide a buildable React library `libs/usage-dashboard`
(package `@epam/ai-dial-usage-dashboard`, Nx tag `type:ui`), scaffolded via an Nx generator and
matching the inferred-target structure used by `libs/settings-panel` (no hand-written
`project.json`; `package.json` carries `"nx": { "tags": ["type:ui"] }`; build/test come from the
`@nx/vite` and `@nx/vitest` inferred plugins via `vite.config.mts`). The library SHALL import only
`react`, `react-dom`, `@epam/ai-dial-ui-kit`, and `@epam/ai-dial-chat-shared` as peer/runtime
dependencies. It SHALL NOT import `@epam/ai-dial-chat-api-client`, any `server-api/*` wrapper, any
app context/hook/feature-flag/env/routing/storage/analytics module, or `react-i18next`.

#### Scenario: Module boundary lint passes
- **WHEN** `npm exec nx lint usage-dashboard` runs
- **THEN** `@nx/enforce-module-boundaries` reports no violations, confirming the library depends
  only on `chat-shared`-tier and UI-kit packages

#### Scenario: No generated-client or i18n imports
- **WHEN** the library's source is inspected
- **THEN** no file imports `@epam/ai-dial-chat-api-client`, `apps/chat/src/server-api/*`, or
  `react-i18next`/`i18next`

---

### Requirement: UsageLimitCardGroup and UsageLimitCard public API

The library SHALL export from `src/index.ts`: the components `UsageLimitCardGroup` and
`UsageLimitCard`, the string enum `UsageLimitStatus` (`Default = 'default'`,
`RunningLow = 'runningLow'`, `LimitReached = 'limitReached'`), and the types
`UsageLimitCardData`, `UsageLimitCardGroupLabels`, `UsageLimitCardGroupColors`,
`UsageLimitCardGroupTypography`, `UsageLimitCardGroupProps`, `UsageLimitCardProps`.

`UsageLimitCardData` SHALL carry only normalized, already-formatted data: `title`,
`periodDescription`, `used: number`, `total: number`, `usedLabel: string`, `totalLabel?: string`,
`remainingLabel?: string`, `isUnlimited?: boolean`, `usedPercent?: number` (not pre-clamped — may
exceed 100), `status: UsageLimitStatus`, and `progressAriaLabel: string`. The library SHALL treat
`used`/`total` as opaque numeric values used only to drive the `ProgressBar`'s
`value`/`max`/`aria-valuenow` and SHALL NOT recompute percentages, currency formatting, or the
unlimited-sentinel check from them.

`UsageLimitCardGroupProps` SHALL accept a required `cards: UsageLimitCardData[]` (in display
order), a required `labels: UsageLimitCardGroupLabels`, and an optional
`styles?: { colors?: UsageLimitCardGroupColors; typography?: UsageLimitCardGroupTypography }`.
`UsageLimitCard` SHALL accept `data: UsageLimitCardData`, `labels: UsageLimitCardGroupLabels`, and
the same optional `styles`.

#### Scenario: Multiple cards rendered
- **WHEN** `UsageLimitCardGroup` is rendered with a `cards` array of two or more entries
- **THEN** it renders one independent, equally-sized box per entry, in array order, each showing
  its own title, badge, used amount, progress bar, and captions — with no shared container or
  divider between boxes

#### Scenario: Single card provided
- **WHEN** `UsageLimitCardGroup` is rendered with a `cards` array containing exactly one entry
- **THEN** it renders a single full-width `UsageLimitCard` box for that entry

#### Scenario: No cards provided
- **WHEN** `UsageLimitCardGroup` is rendered with an empty `cards` array
- **THEN** it renders nothing (returns `null`)

#### Scenario: Standalone UsageLimitCard
- **WHEN** `UsageLimitCard` is rendered directly with a `UsageLimitCardData` value
- **THEN** it renders the same title/badge/amount/progress/caption content as one card inside
  `UsageLimitCardGroup`

---

### Requirement: Status-driven visual treatment

The library SHALL render a status badge for every card, regardless of status:
`UsageLimitStatus.Default` with the default (blue) accent and a badge reading
`labels.defaultBadgeLabel`; `UsageLimitStatus.RunningLow` with the warning (amber) accent, a badge
reading `labels.runningLowBadgeLabel`, and a warning-colored progress fill;
`UsageLimitStatus.LimitReached` with the error (red) accent, a badge reading
`labels.limitReachedBadgeLabel`, and an error-colored progress fill. Color SHALL NOT be the only
indicator of status: the badge text and the used-percent caption are always present regardless of
color perception.

The prominent figure on every card SHALL be `data.usedLabel`. When `data.isUnlimited` is not
`true` and `data.totalLabel` is present, the library SHALL render a caption next to the prominent
figure built from `labels.usedOfTotalLabel({ total: data.totalLabel })`. When `data.isUnlimited` is
`true`, the library SHALL render `data.usedLabel` without a progress bar, without the
used-of-total/remaining captions, and without a used-percent label — but SHALL still render the
status badge (an unlimited budget is always treated as `UsageLimitStatus.Default`, i.e.
"within limits").

When `data.usedPercent` is `>= 100` (finite, capped case), the library SHALL clamp both the
rendered progress-bar fill width and the visible used-percent label at 100 — a percentage over 100
is not shown to the user. Only `progressAriaLabel` (surfaced as the progress bar's
`aria-valuetext`) SHALL still reflect the actual, uncapped percentage supplied by the caller, so a
screen-reader user is not misled about the real figure.

#### Scenario: Default status renders the "within limits" badge
- **WHEN** a card's `data.status` is `UsageLimitStatus.Default`
- **THEN** the card renders a badge with `labels.defaultBadgeLabel` text and the default accent

#### Scenario: Running-low badge and accent
- **WHEN** a card's `data.status` is `UsageLimitStatus.RunningLow`
- **THEN** the card renders a badge with `labels.runningLowBadgeLabel` text and applies the warning
  color token to the progress fill and the prominent amount text

#### Scenario: Limit-reached badge and accent
- **WHEN** a card's `data.status` is `UsageLimitStatus.LimitReached`
- **THEN** the card renders a badge with `labels.limitReachedBadgeLabel` text and applies the error
  color token to the progress fill and the prominent amount text

#### Scenario: Unlimited card shows no ratio but still shows a badge
- **WHEN** a card's `data.isUnlimited` is `true`
- **THEN** the card shows `data.usedLabel`, the `labels.defaultBadgeLabel` badge, and no progress
  bar, used-of-total caption, remaining caption, or used-percent label

#### Scenario: Over-100% visual and label clamp preserves the real value only in the accessible text
- **WHEN** a card's `data.usedPercent` is `137`
- **THEN** the rendered progress-bar fill visually stops at 100% width, the visible used-percent
  label reads `100%`, and only the accessible `aria-valuetext` reads the real, uncapped `137%`

---

### Requirement: Accessibility

Each card's progress element SHALL be exposed with an accessible name (from `data.title`) and
`aria-valuetext` set to `data.progressAriaLabel`. Each status badge SHALL expose its status as
readable text (not an icon-only or color-only indicator). The library SHALL NOT introduce its own
`aria-live` region — loading and error feedback are the host's responsibility (see
`usage-data-hook` capability); the library only renders the data it is given.

Contrast: any `#hex` fallback used in the three-tier CSS-variable chain for the prominent amount
text SHALL resolve to at least 7:1 against its paired background fallback (WCAG AAA), per
`.claude/rules/a11y.md`.

#### Scenario: Progress bar has an accessible name and value text
- **WHEN** a capped (non-unlimited) card is rendered
- **THEN** its progress element exposes `role="progressbar"`, an accessible name derived from
  `data.title`, and `aria-valuetext` equal to `data.progressAriaLabel`

#### Scenario: Badge text is readable, not color-only
- **WHEN** a card renders any status badge
- **THEN** the badge's accessible text content equals the corresponding `labels.*BadgeLabel` string

---

### Requirement: Responsive and RTL layout

`UsageLimitCardGroup` SHALL use only the repository's `mobile:`/`desktop:` Tailwind breakpoints. On
mobile, cards SHALL stack vertically at full width with no horizontal overflow at a 360px viewport
width. On desktop, cards SHALL render side by side, one column per entry in `cards`, via a
card-count-driven CSS grid (a `--uld-card-count` custom property set from `cards.length`) so the
layout generalizes to any number of cards without a hard-coded column count. There is no shared
container or divider between cards, so no directional border/divider logic applies at the group
level; any internal RTL-sensitive positioning within a single card (e.g. the badge's placement
relative to the title) SHALL use logical Tailwind/CSS properties. The library takes no `dir` prop
unless a lib consumer explicitly needs a direction override, and SHALL NOT import i18n or read
language state to determine direction — direction is inherited from the ancestor `dir` attribute.

#### Scenario: No horizontal overflow on mobile
- **WHEN** `UsageLimitCardGroup` is rendered in a 360px-wide viewport with multiple cards present
- **THEN** the container and its children do not cause horizontal page scroll

#### Scenario: Desktop column count tracks the number of cards
- **WHEN** `UsageLimitCardGroup` is rendered at the desktop breakpoint with three cards
- **THEN** the three cards render in three equal-width columns side by side

---

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
