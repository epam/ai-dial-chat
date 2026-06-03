## ADDED Requirements

### Requirement: Settings modal with theme selector
The system SHALL render a `DialConfirmationPopup` modal titled with the `settings.title` i18n key, with `confirmLabel` from `settings.apply`. The modal body SHALL contain a `DialFormItem` (label from `settings.theme`) wrapping a `DialSelect` for theme selection. The body content SHALL be wrapped in a `p-4` padding container. The `DialSelect` options SHALL be populated from `useTheme().themes` (loaded from `GET /api/v1/themes` via the existing `ThemeContext`).

The `DialSelect` SHALL be controlled by local `pendingTheme` state (initialised to `useTheme().currentTheme` when the modal opens). Selecting an option updates `pendingTheme` only — it does NOT call `setTheme`. `setTheme` SHALL be called only when the user clicks the Confirm button. Cancelling or closing the modal discards `pendingTheme` without applying any change.

State ownership: `SettingsModal` owns `pendingTheme` local state. `useTheme()` from `ThemeContext` owns the applied theme. `SettingsModal` receives `open` and `onClose` props.

i18n keys: `settings.title`, `settings.theme`, `settings.apply`

The `DialSelect` SHALL be `disabled` when `useTheme().isLoading` is `true`.

Memoisation: `options` array derived from `themes` SHALL be wrapped in `useMemo`.

#### Scenario: Modal opens with current theme pre-selected
- **WHEN** the Settings modal opens
- **THEN** the theme `DialSelect` shows the currently active theme as the pending selection

#### Scenario: Theme selection is staged, not applied immediately
- **WHEN** the user selects a different theme in the `DialSelect`
- **THEN** `pendingTheme` updates to the selected value
- **AND** `setTheme` is NOT called yet
- **AND** the application theme does not change

#### Scenario: Theme applies on confirm
- **WHEN** the user clicks the Confirm button
- **THEN** `setTheme(pendingTheme)` is called
- **AND** the application theme updates
- **AND** the modal closes

#### Scenario: Cancel discards pending selection
- **WHEN** the user clicks Cancel or the close button or presses Escape
- **THEN** the modal closes without calling `setTheme`
- **AND** the application theme remains unchanged

#### Scenario: Select is disabled while themes are loading
- **WHEN** `useTheme().isLoading` is `true`
- **THEN** the `DialSelect` is rendered in the disabled state
