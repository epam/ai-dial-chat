## MODIFIED Requirements

### Requirement: Model identity rendering reuses `DeploymentIcon`

Each row SHALL render its model avatar via the `chat-shared` `DeploymentIcon` component (`src:
row.avatarSrc`, `initialsName: row.name`) at 40×40px with a 12px radius. The identity text SHALL
render the row's type caption above a single line containing the model name and, when present,
`row.version`. The type caption SHALL be `row.typeLabel` when the row supplies a non-empty one, and
`labels.modelTypeLabel` otherwise. The library SHALL NOT import any `libs/catalog` component or any
new heavy peer dependency to render model identity.

`ModelLimitRow` SHALL expose `typeLabel?: string` as an optional, host-preformatted string. The
library SHALL NOT interpret it, derive it from `row.id`, or know which deployment kinds exist; it is a
display string only. Adding the field is non-breaking: every existing row shape remains valid, and a
host that never sets it renders exactly as before.

The caption SHALL keep the existing `modelType` style slot and typography, SHALL be plain text (no
new ARIA role), and SHALL inherit direction from the document — no physical-direction classes are
introduced, and no icon is added that would need RTL mirroring.

#### Scenario: Row without an avatar URL falls back to initials
- **WHEN** a row's `avatarSrc` is `undefined`
- **THEN** `DeploymentIcon` renders its initials-based fallback derived from `row.name`

#### Scenario: Long names remain accessible when visually truncated
- **WHEN** a row's `name` is long enough to be visually truncated in the identity cell
- **THEN** the full `name` text remains available to assistive technology (e.g. via the element's
  accessible name or a tooltip), not only the visually truncated text

#### Scenario: Row-supplied type caption overrides the section label
- **WHEN** `labels.modelTypeLabel` is `Model` and one row carries `typeLabel: 'Agent'`
- **THEN** that row's caption reads `Agent` and every other row's caption reads `Model`

#### Scenario: Missing or empty type caption falls back
- **WHEN** a row's `typeLabel` is `undefined` or `''`
- **THEN** its caption renders `labels.modelTypeLabel`

#### Scenario: Library stays unaware of deployment kinds
- **WHEN** `libs/usage-dashboard` source is inspected
- **THEN** it contains no `'application'` / `'model'` type comparison and no `applications/` id
  parsing to choose a caption

## ADDED Requirements

### Requirement: Cost value renders an optional supporting label

The period cell's Cost value SHALL render `cell.cost.supportingLabel`, when it is a non-empty
string and the cost cell is not `Unavailable`, as a second line beneath the spent value, using the
same `secondaryValue` style slot and secondary-value typography class. When `supportingLabel` is
absent, the Cost value SHALL render exactly as before (a single spent line), so every existing host
is unaffected.

The supporting line SHALL be ordinary text inside the same cell, after the visually hidden
`labels.costLabel` prefix and the spent value, so assistive technology reads
"Cost: Spent $1.50 Includes cost of models it called" in document order; no `aria-label` override,
no new ARIA role, and no live region are introduced. The line SHALL wrap (`break-words`) rather than
truncate at mobile width, and SHALL use no physical-direction classes. The library SHALL NOT decide
when a supporting label applies — it renders whatever the host supplied.

#### Scenario: Supporting label renders beneath spend
- **WHEN** a row's day `cost` cell is `{ kind: Unlimited, usedLabel: 'Spent $1.50', supportingLabel:
  'Includes cost of models it called', ariaLabel: 'Spent $1.50' }`
- **THEN** the day Cost value shows `Spent $1.50` with `Includes cost of models it called` on the
  line below

#### Scenario: No supporting label keeps the single line
- **WHEN** a cost cell has no `supportingLabel`
- **THEN** the Cost value renders only the spent line, with markup identical to before this change

#### Scenario: Unavailable cost ignores a supporting label
- **WHEN** a cost cell is `Unavailable` and carries a `supportingLabel`
- **THEN** only `labels.unavailableLabel` is rendered

#### Scenario: Supporting label is read in order
- **WHEN** a screen reader traverses the Cost value with a supporting label
- **THEN** it reads the Cost context, the spent value, then the supporting text
