## MODIFIED Requirements

### Requirement: Preferences tab renders a seasonal-celebrations switch

`PreferencesFields` SHALL render a `Switch` from `@epam/ai-dial-ui-kit` labeled
`t(SettingsI18nKeys.Celebrations)`
(`settings.celebrations`, "Seasonal celebrations") with the caption
`t(SettingsI18nKeys.CelebrationsDescription)` (`settings.celebrationsDescription`, "Show holiday
decorations and animations on the start page."). `PreferencesTab` binds it to
`useCelebrationPreference()` so a change applies at once; the Settings dialog
(`apps/chat/src/components/SettingsModal/SettingsModal.tsx`) binds it to its draft and calls
`setIsEnabled` on Save only when the value changed. The row lives in
`apps/chat/src/components/Settings/PreferencesFields/PreferencesFields.tsx`.

The state is owned by `useCelebrationPreference()`
(`apps/chat/src/hooks/celebration/useCelebrationPreference.ts`), stored under
`StorageKey.CelebrationsEnabled` (`'celebrationsEnabled'`) in `localStorage`. A stored `'true'`
reads as on and a stored `'false'` reads as off. When nothing else is stored (missing or any other
value), the hook SHALL fall back to the operator default `config.celebrationsEnabledByDefault` from
`useAppConfig()` (`UI_EVENT_ENABLED_BY_DEFAULT`, `true` unless the operator sets it off). The
fallback is read live, so a changed operator default reaches every user who never saved a choice,
and the hook SHALL NOT write the default to storage. Only `setIsEnabled` writes, and it always
writes an explicit `'true'` or `'false'`. Every mounted `useCelebrationPreference()` reflects a
write on the same render cycle through a window `CustomEvent`.

The row SHALL render **only when** the client config names an event (`config.activeEventId != null`)
and `OverlayFeature.HideUserSettings` is off. Without a configured event the switch would control
nothing. The row is not gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

**Accessibility:** the switch's accessible name comes from `labelProps.label`, the caption describes
it, it exposes `role="switch"` with its checked state, and it is operable by keyboard. Its `id`
comes from `useId()`.

**RTL:** none beyond the kit `Switch`, which follows the inherited `dir`; the row adds no
directional spacing or icons.

**Memoisation:** `setIsEnabled` is a stable `useCallback`; the row has no option array to memoise.

#### Scenario: The operator default applies when nothing is stored

- **GIVEN** nothing is stored under `StorageKey.CelebrationsEnabled`
- **WHEN** the Preferences tab renders with `config.activeEventId = 'halloween'` and
  `config.celebrationsEnabledByDefault = true`
- **THEN** the switch is on
- **WHEN** `config.celebrationsEnabledByDefault` is `false` instead
- **THEN** the switch is off

#### Scenario: A stored choice overrides the operator default

- **GIVEN** `'false'` is stored and `config.celebrationsEnabledByDefault` is `true`
- **WHEN** the Preferences tab renders with an event configured
- **THEN** the switch is off
- **GIVEN** `'true'` is stored and `config.celebrationsEnabledByDefault` is `false`
- **THEN** the switch is on

#### Scenario: Turning the switch on persists it

- **WHEN** the user turns the switch on in the Preferences tab
- **THEN** `localStorage` under `StorageKey.CelebrationsEnabled` holds `'true'`, and a mounted
  `CelebrationHost` passes the event on the same render cycle

#### Scenario: Turning the switch off persists it against an on default

- **GIVEN** `config.celebrationsEnabledByDefault` is `true` and nothing is stored
- **WHEN** the user turns the switch off
- **THEN** `'false'` is stored and a mounted `CelebrationHost` passes `null`

#### Scenario: The dialog applies the switch only on Save

- **WHEN** the user toggles the switch in the Settings dialog and presses Cancel
- **THEN** nothing is stored
- **WHEN** the user toggles it and presses Save
- **THEN** the new explicit value is stored

#### Scenario: Saving the dialog unchanged keeps following the operator default

- **GIVEN** nothing is stored
- **WHEN** the user opens the Settings dialog and presses Save without touching the switch
- **THEN** nothing is stored under `StorageKey.CelebrationsEnabled`

#### Scenario: No configured event hides the row

- **GIVEN** `config.activeEventId` is `null`
- **WHEN** the Preferences tab renders
- **THEN** no celebrations switch is present
