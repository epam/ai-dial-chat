## ADDED Requirements

### Requirement: ConversationPanel renders two distinct empty states via PanelEmptyState
`ConversationPanel` SHALL use `PanelEmptyState` (from `@epam/ai-dial-sidebar`) for both empty conditions. Each state renders a centred icon above a translated label. The internal `EmptyState` component SHALL be deleted; `PanelEmptyState` is used directly in the panel body.

#### Scenario: No-conversations state uses IconMessageCircle
- **WHEN** the `conversations` prop is an empty array
- **THEN** `PanelEmptyState` SHALL be rendered with `IconMessageCircle` (size 48, stroke 1) as the icon and `emptyLabel` as the label

#### Scenario: No-results state uses IconSearchOff
- **WHEN** `conversations` is non-empty but all items are filtered out by the active search query or tab
- **THEN** `PanelEmptyState` SHALL be rendered with `IconSearchOff` (size 45, stroke 1) as the icon and `noResultsLabel` as the label

#### Scenario: PanelEmptyState is not shown when items exist
- **WHEN** at least one conversation item passes the active search + tab filter
- **THEN** no `PanelEmptyState` SHALL be rendered; the conversation groups SHALL be shown

---

### Requirement: ConversationPanelProps exposes a required noResultsLabel prop
`ConversationPanelProps` SHALL include `noResultsLabel: string` — a required prop that provides the "no results" message when filtered items is empty but the conversations array is not. The lib SHALL NOT supply a default value; the consuming app provides a translated string.

#### Scenario: noResultsLabel is passed through to the no-results empty state
- **WHEN** `noResultsLabel="No results found"` is passed and a search query matches nothing
- **THEN** the text `"No results found"` is rendered inside `PanelEmptyState`
