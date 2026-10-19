# Delta: settings-panel-lib

## MODIFIED Requirements

### Requirement: Presentational settings panel component
The system SHALL provide a new library `libs/settings-panel` (npm package
`@epam/ai-dial-settings-panel`) exporting the presentational component `SettingsPanel`
(alongside its prop types and the `SETTINGS_PANEL_CLASS` public class-name map) and, since the
Extensions extraction, the presentational `ExtensionsSection` services table with its prop types
(see the extensions requirement below), that renders a
vertical list of icon + label rows under an optional section header, with the active row visually
highlighted. The component SHALL accept only props — no `react-i18next`, no
`apps/chat/src/server-api/*` import, no routing, no host-specific icon choices baked in.

```ts
interface SettingsPanelItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}
interface SettingsPanelProps {
  items: SettingsPanelItem[];
  activeId: string;
  onSelect: (id: string) => void;
  sectionLabel?: string;
  styles?: SettingsPanelStyles; // { typography?: SettingsPanelTypography }
  className?: string;
}
```

Row colors (inactive, hover, active, focus ring) come from the UI kit's vertical `Tabs` and are
not overridable through `SettingsPanel` props. The section header typography defaults to
`dial-h1-text`, overridable via `styles.typography.sectionLabelClassName`.

#### Scenario: Rendering the item list
- **WHEN** the panel is given `items` with one active id and one or more disabled items
- **THEN** it renders one row per item, highlights the row matching `activeId`, and renders
  disabled items in a visually dimmed, unclickable state

#### Scenario: Selecting an enabled row
- **WHEN** a user clicks or activates (Enter/Space) an enabled row that is not the active one
- **THEN** `onSelect` is called once with that row's `id`

#### Scenario: Disabled rows do not fire onSelect
- **WHEN** a user clicks a `disabled: true` row
- **THEN** `onSelect` is not called and the active row does not change

---

## ADDED Requirements

### Requirement: Presentational extensions services table component
The lib SHALL export `ExtensionsSection` — the Extensions services table shell: the
`role="table"` container, the header row (Name / Description column headers in
`dial-caption-lead-semi-text` plus the visually empty Actions column header whose
`sr-only` localized label keeps it announced), the shared desktop grid template
(`EXTENSIONS_GRID_COLUMNS`, bounded action track so the header and rows stay column-aligned),
and one row per `ExtensionServiceItem` (square `InitialsAvatar` with an optional corner warning
badge carrying its localized tooltip and `role="img"` accessible name, the display name, the
description, and a host-supplied trailing `action` node). All user-visible strings, the warning
flag, and the action SHALL arrive via props — `labels` for the table shell, per-row fields for
everything row-specific; the lib holds no i18n, no service state, and no login/logout knowledge.
Colors and typography SHALL be overridable through `styles` (CSS custom properties and class
overrides) following the `ModelLimitsSection` pattern in `libs/usage-dashboard`.

The lib SHALL declare `@tabler/icons-react` as a `dependency` (the warning badge glyph);
`peerDependencies` stay limited to `react`, `@epam/ai-dial-chat-shared`, and
`@epam/ai-dial-ui-kit`.

```ts
interface ExtensionServiceItem {
  id: string;
  displayName: string;
  description: string;
  isWarningVisible: boolean;
  authorizeLabel: string;
  action: ReactNode;
}
interface ExtensionsLabels {
  tableAriaLabel: string;
  nameColumnLabel: string;
  descriptionColumnLabel: string;
  actionsColumnLabel: string;
}
interface ExtensionsSectionProps {
  rows: ExtensionServiceItem[];
  labels: ExtensionsLabels;
  styles?: ExtensionsStyles; // { colors?, typography? }
}
```

#### Scenario: Table shell renders from props
- **WHEN** `ExtensionsSection` is given `rows` and `labels`
- **THEN** it renders the ARIA table with its accessible name, the Name and Description column
  headers, the `sr-only` Actions column header, and one row per item in display order

#### Scenario: Warning badge and action stay host-driven
- **WHEN** a row renders with `isWarningVisible: false` and a host-supplied `action`
- **THEN** the avatar carries no warning badge, the action renders in the trailing cell, and an
  `isWarningVisible: true` row renders the badge with the row's `authorizeLabel` as its tooltip
  and accessible name

#### Scenario: The consuming tab stays the host of state and strings
- **WHEN** `apps/chat` renders the Extensions tab
- **THEN** the tab (`apps/chat/src/pages/SettingsPage/ExtensionsTab/ExtensionsTab.tsx`) resolves
  every label via `useTranslation`, derives the row, the warning flag, and the action from the
  offline-credentials gate/auth state, and passes them to `ExtensionsSection` as props — the lib
  imports no i18n, no server-API wrapper, and no gate hook
