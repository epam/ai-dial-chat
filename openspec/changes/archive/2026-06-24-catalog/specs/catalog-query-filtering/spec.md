## ADDED Requirements

### Requirement: ToolbarProps filter state and label fields

`libs/catalog/src/models/toolbar-props.ts` SHALL add the following optional fields to `ToolbarProps`:

**Filter state:**
- `filters?: Set<string>` — selected topic strings; empty = no topic filter.
- `onFiltersChange?: (filters: Set<string>) => void` — topic selection callback.
- `filterValues?: Set<string>` — all available topic strings for the dropdown checkboxes.
- `isMyAppsActive?: boolean` — My Apps toggle state.
- `onMyAppsChange?: (isActive: boolean) => void` — My Apps toggle callback.

**Labels (forwarded to `Filter` via `FilterRow`):**
- `filterFromLabel?: string` — button label when idle; default `'From'`.
- `filterMyAppsLabel?: string` — My Apps checkbox label; default `'My Apps'`.
- `filterTopicsLabel?: string` — Topics section heading; default `'Topics'`.

`Toolbar.tsx` SHALL destructure all new fields and forward them to `FilterRow`. `FilterRow` maps them to `<Filter checked={filters} onChange={onFiltersChange} values={filterValues} isMyAppsActive={isMyAppsActive} onMyAppsChange={onMyAppsChange} defaultLabel={filterFromLabel} myAppsLabel={filterMyAppsLabel} topicsLabel={filterTopicsLabel} />`.

All fields are optional; existing consumers that omit them are unaffected.

i18n: none (labels are passed as props). RTL: none. Feature gate: none.

#### Scenario: ToolbarProps accepts all filter fields without TypeScript error

- **WHEN** `<Toolbar filters={new Set(['Vision'])} onFiltersChange={fn} filterValues={new Set(['Vision', 'Code'])} isMyAppsActive={true} onMyAppsChange={fn} ... />` is rendered
- **THEN** no TypeScript errors and the props are forwarded to `Filter`

#### Scenario: Backwards compatible when filter fields are omitted

- **WHEN** an existing consumer renders `<Toolbar>` without any of the new fields
- **THEN** the component renders without error and `FilterRow` shows the Filter button in its default idle state
