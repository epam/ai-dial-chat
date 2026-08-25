## MODIFIED Requirements

### Requirement: Extensible tab container
`SettingsPage` SHALL render its sub-pages through a `SettingsTabs` enum, an associated tab-config
hook (`useSettingsTabConfig`), and the presentational `SettingsPanel` component from
`@epam/ai-dial-settings-panel` (a vertical icon + label list, replacing the earlier horizontal
`Tabs` (2.0) placeholder). Each tab entry declares an id, an i18n label key, an icon, and the
component to render. The enum SHALL contain exactly one member, `Usage`, unchanged from before
this change — `General` and `Preferences` were evaluated as placeholder rows during this change
but were removed entirely (no enum member, no config entry, no i18n keys) before shipping, since
only `Usage` is available. Adding a future tab SHALL require only a new enum member and a new
config entry, with no changes to `SettingsPage`'s rendering logic or to the `/settings` route
registration. The `SettingsPanel` component itself supports per-item `disabled` rows as a general
capability (see `settings-panel-lib`), even though no current tab entry uses it.

#### Scenario: Only the Usage tab is visible today
- **WHEN** `SettingsPage` renders
- **THEN** the panel shows exactly one row, `Usage`, labeled via an i18n key, and it is selected by
  default

#### Scenario: Panel is keyboard- and screen-reader-navigable
- **WHEN** the tab container renders
- **THEN** it delegates to `SettingsPanel`'s vertical ARIA tablist behavior (`role="tablist"`,
  `aria-orientation="vertical"`, `role="tab"` + `aria-selected` per row)
