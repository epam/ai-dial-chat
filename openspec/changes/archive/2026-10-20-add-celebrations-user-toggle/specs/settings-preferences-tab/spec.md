## ADDED Requirements

### Requirement: Preferences tab renders a seasonal-celebrations switch

`PreferencesFields` SHALL render a `Switch` from `@epam/ai-dial-ui-kit` labeled
`t(SettingsI18nKeys.Celebrations)` with the caption `t(SettingsI18nKeys.CelebrationsDescription)`.
`PreferencesTab` binds it to `useCelebrationPreference()` so a change applies at once; the
Settings dialog binds it to its draft and calls `setIsEnabled` on Save only when the value
changed.

The preference is stored under `StorageKey.CelebrationsEnabled` in `localStorage`. Only the stored
string `'true'` reads as on; a missing or any other value reads as off, so the default is off.
Every mounted `useCelebrationPreference()` reflects a write on the same render cycle.

The row SHALL render **only when** the client config names an event (`config.activeEventId != null`)
and `OverlayFeature.HideUserSettings` is off. Without a configured event the switch would control
nothing.

#### Scenario: Celebrations are off by default

- **GIVEN** nothing is stored under `StorageKey.CelebrationsEnabled`
- **WHEN** the Preferences tab renders with `config.activeEventId = 'halloween'`
- **THEN** the switch is off

#### Scenario: Turning the switch on persists it

- **WHEN** the user turns the switch on in the Preferences tab
- **THEN** `localStorage` under `StorageKey.CelebrationsEnabled` holds `'true'`, and a mounted
  `CelebrationHost` passes the event on the same render cycle

#### Scenario: The dialog applies the switch only on Save

- **WHEN** the user turns the switch on in the Settings dialog and presses Cancel
- **THEN** nothing is stored
- **WHEN** the user turns it on and presses Save
- **THEN** `'true'` is stored

#### Scenario: No configured event hides the row

- **GIVEN** `config.activeEventId` is `null`
- **WHEN** the Preferences tab renders
- **THEN** no celebrations switch is present
