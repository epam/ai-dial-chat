## ADDED Requirements

### Requirement: ToolbarProps fromChecked and onFromChange fields

`libs/catalog/src/models/toolbar-props.ts` SHALL add two optional fields to `ToolbarProps`:

- `fromChecked?: Set<string>` — the set of currently active source-filter IDs; defaults to `new Set()`.
- `onFromChange?: (checked: Set<string>) => void` — called when the From filter selection changes.

These fields are optional (the `Toolbar` renders correctly with no From filter state) and do not affect existing consumers.

i18n keys: none. RTL: none. Feature gate: none.

#### Scenario: ToolbarProps accepts fromChecked and onFromChange without error

- **WHEN** `<Toolbar fromChecked={new Set(['folderA'])} onFromChange={handler} ... />` is rendered
- **THEN** the component accepts the props without TypeScript errors and passes them to `FilterRow`

#### Scenario: ToolbarProps is backwards compatible when fields are omitted

- **WHEN** an existing consumer renders `<Toolbar>` without the new fields
- **THEN** the component renders without runtime error and `isAnyFilterActive` behaves as before
