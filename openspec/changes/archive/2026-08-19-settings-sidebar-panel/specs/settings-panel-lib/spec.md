## ADDED Requirements

### Requirement: Presentational settings panel component
The system SHALL provide a new library `libs/settings-panel` (npm package
`@epam/ai-dial-settings-panel`) exporting a single presentational component that renders a
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
  styles?: SettingsPanelStyles; // { typography?: SettingsPanelTypography; colors?: SettingsPanelColors }
  className?: string;
}
```

Color overrides (`SettingsPanelColors`) are applied as CSS custom properties following the
`PillTabs` pattern (`buildCssVars` + a `.module.scss`), not hardcoded Tailwind color utilities.
The active row's default background token is `--bg-control-accent-alpha` (not
`--bg-accent-primary-alpha`, which is deprecated in `tailwind.config.js`'s `bgColorsToRemove`).

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

### Requirement: Vertical ARIA tablist keyboard behavior
The panel SHALL expose `role="tablist"` with `aria-orientation="vertical"` on the list container and
`role="tab"` with `aria-selected` on each row, following the automatic-activation ARIA tabs pattern:
only the active row is in the tab order, `ArrowUp`/`ArrowDown` move both focus and selection between
enabled rows (wrapping at the ends), `Home`/`End` jump to the first/last enabled row, and disabled
rows are `aria-disabled` and skipped entirely by arrow navigation.

#### Scenario: Arrow key navigation skips disabled rows
- **WHEN** a user focuses an enabled row and the adjacent row in the arrow-key direction is disabled
- **THEN** focus and selection move to the next enabled row in that direction, skipping the disabled
  one

#### Scenario: Only the active row is tab-reachable
- **WHEN** the panel renders with one active row
- **THEN** only that row has `tabIndex={0}`; every other row (enabled or disabled) has `tabIndex={-1}`

### Requirement: Library isolation and scaffolding
The lib SHALL be tagged `"type:ui"` in its `package.json` (matching `libs/share`,
`libs/prompts`, `libs/prompt-editor`) and declare `peerDependencies` limited to `react`,
`@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`, and `@tabler/icons-react` — no dependency on
any other hand-authored lib or on `apps/*`. It SHALL include the required `package.json` fields
(`license: "Apache-2.0"`, a plain-English `description`) and a `README.md` documenting the
component's props and a usage example, per `.claude/rules/libs.md`. A `tsconfig.base.json` path
alias (`@epam/ai-dial-settings-panel/*`) SHALL resolve to `./libs/settings-panel/*`.

#### Scenario: No forbidden imports
- **WHEN** the lib's source is scanned
- **THEN** it contains no import of `react-i18next`, `apps/chat/src/server-api/*`, generated API
  client types, or any other hand-authored `libs/*` package

#### Scenario: Consuming app resolves labels and icons
- **WHEN** `apps/chat`'s `SettingsPage` builds the panel's `items` prop
- **THEN** each `label` is already translated via `useTranslation` and each `icon` is a
  `@tabler/icons-react` element resolved in `apps/chat`, not inside the lib
