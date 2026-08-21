## ADDED Requirements

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
