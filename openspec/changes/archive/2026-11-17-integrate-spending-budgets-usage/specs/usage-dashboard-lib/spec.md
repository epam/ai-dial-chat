# Spec Delta

## ADDED Requirements

### Requirement: SpendingBudgetsSection exports

The library SHALL export `SpendingBudgetsSection` and the types `SpendingBudgetData`,
`SpendingBudgetsSectionLabels`, `SpendingBudgetsSectionColors`, `SpendingBudgetsSectionTypography`,
`SpendingBudgetsSectionStyles` and `SpendingBudgetsSectionProps` from `src/index.ts`.

#### Scenario: Host names every prop type

- **WHEN** a host imports the component and builds its `labels` and `styles`
- **THEN** every type reachable through the props is importable from `@epam/ai-dial-usage-dashboard`

### Requirement: SpendingBudgetsSection props

The props SHALL be `budgets: SpendingBudgetData[]` (each `id`, `title`, optional `coverageLabel`,
`cards: UsageLimitCardData[]`), `labels` (`headingLabel`, optional `descriptionLabel`,
`noticeLabel`, `emptyStateLabel`), `cardLabels: UsageLimitCardGroupLabels`, and optional `styles`
with the section's colors, typography and a `cards` field forwarded to `UsageLimitCard`.

#### Scenario: Budgets rendered in order

- **WHEN** `budgets` has two entries
- **THEN** the section renders the heading, the description when given, the notice when given, and then one group per budget in array order, each with its title, its coverage line when given, and its cards laid out like `UsageLimitCardGroup`

#### Scenario: Empty list with an empty-state label

- **WHEN** `budgets` is empty and `labels.emptyStateLabel` is set
- **THEN** the section renders its heading and the empty-state text, and no group

#### Scenario: Empty list without an empty-state label

- **WHEN** `budgets` is empty and `labels.emptyStateLabel` is not set
- **THEN** the component renders nothing

### Requirement: SpendingBudgetsSection is host-agnostic and themeable

The component SHALL render only what it is given. It SHALL NOT know about spending-limit modes, cost
objects, policies or DIAL Core, SHALL NOT format amounts or dates, and SHALL NOT import i18n, the
generated client or app code. Colors come from `SpendingBudgetsSectionColors` as CSS variables set
with `buildCssVars`, and typography from `*ClassName` fields defaulting to kit `dial-*-text` classes.
It exposes the public classes `dial-usage-dashboard-budgets` and `dial-usage-dashboard-budget`.

#### Scenario: Host overrides colors and typography

- **WHEN** the host passes `styles.colors.titleColor` and `styles.typography.titleClassName`
- **THEN** each budget title uses that color through its CSS variable and carries that class in place of the default

#### Scenario: Card styles are forwarded

- **WHEN** the host passes `styles.cards.colors.cardBackground`
- **THEN** every `UsageLimitCard` inside the section uses that background

### Requirement: SpendingBudgetsSection accessibility and layout

The section SHALL be a `section` labelled by its `h2` heading. Each budget SHALL be a `role="group"`
named by its title, with an `h3` title. The notice SHALL be static text rendered through the kit's
informational notification, not a live region. The layout SHALL be mobile-first: cards stack on
phones and sit side by side from the `desktop` breakpoint. It SHALL use logical properties only.

#### Scenario: Screen reader structure

- **WHEN** a screen reader lists the page's landmarks and headings
- **THEN** it finds the section named by `headingLabel`, and an `h3` per budget inside a group of the same name

#### Scenario: Phone width

- **WHEN** the viewport is below the `desktop` breakpoint
- **THEN** each budget's cards stack vertically with no horizontal scroll

#### Scenario: Right-to-left

- **WHEN** the document direction is `rtl`
- **THEN** titles, coverage lines and cards align to the inline start with no physical-direction styles
