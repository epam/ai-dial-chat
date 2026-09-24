## ADDED Requirements

### Requirement: The stored theme preference is restored on load

`ThemeProvider` (`apps/chat/src/context/ThemeContext.tsx`) SHALL own the theme preference state and
SHALL restore it from `localStorage` under `StorageKey.Theme` once the theme configuration from
`GET /api/themes` has resolved.

Resolution order for the initially selected theme id:

1. the stored value, when it names a theme present in `config.themes`, or when it is `system` **and
   the configuration contains both `light` and `dark`**;
2. otherwise `ThemeId.Light`.

`ThemeId.Light` is the default for a user who has never chosen, regardless of the order the themes
host lists its themes in. Configuration order is not a statement about which theme a first-time
visitor should get, and making it one would silently flip every such user on a deployment whose
`config.json` happens to list `dark` first. A deployment that serves no `light` theme therefore
renders in the built-in Tailwind light palette until the user picks something — unchanged from
today's behaviour.

The stored value SHALL NOT be used merely as a presence gate. A stored id that the configuration no
longer contains SHALL be discarded silently and SHALL NOT be written back over the user's stored
value, so that a theme temporarily missing from the configuration does not permanently erase the
preference.

This replaces the behaviour at `ThemeContext.tsx:93-107`, where the stored value gates an
assignment of `config.themes[0].id` or `ThemeId.Light` and is otherwise ignored.

**State ownership**: `ThemeContext` — no new context is introduced.
**Memoisation**: the context value stays wrapped in `useMemo`; `setTheme` stays wrapped in
`useCallback`.
**i18n**: none (no new strings).
**RTL**: none (no UI).

#### Scenario: A stored non-default theme survives a reload

- **WHEN** a user has previously selected the theme `dark`, the configuration contains `light` and
  `dark`, and the user reloads the page
- **THEN** `selectedTheme` is `dark`, the `dark` colors are applied to `<html>`, and the
  Preferences picker shows `Dark`

#### Scenario: A stored custom theme id is restored

- **WHEN** the stored value is `contoso-night`, and `config.themes` contains a theme with
  `id: 'contoso-night'`
- **THEN** that theme's colors are applied and `selectedTheme` is `contoso-night`

#### Scenario: A stored id the configuration no longer contains

- **WHEN** the stored value is `contoso-night` and `config.themes` contains only `light` and `dark`
- **THEN** the `light` theme is applied, and the value stored under `StorageKey.Theme` is left as
  `contoso-night`

#### Scenario: Nothing stored yet, on a configuration that lists dark first

- **WHEN** no value is stored and `config.themes` is `[dark, light]`
- **THEN** the `light` theme is applied, not the first entry

#### Scenario: `system` is restored and tracks the OS

- **WHEN** the stored value is `system`, both `light` and `dark` are configured, and the OS
  preference is dark
- **THEN** the `dark` colors are applied, `selectedTheme` is `system`, `currentTheme` is `dark`, and
  a later change of the OS preference to light re-resolves to the `light` colors without a reload

#### Scenario: `system` is stored but the configuration cannot honour it

- **WHEN** the stored value is `system`, the configuration contains `light` and a custom theme but
  no `dark`, and the OS preference is dark
- **THEN** the `light` theme is applied rather than an id the configuration does not contain, and
  the provider does not subscribe to OS colour-scheme changes

#### Scenario: No theme configuration is available

- **WHEN** `GET /api/themes` fails or returns no themes
- **THEN** no custom properties are written, the built-in Tailwind light palette remains in effect,
  and the application renders without an error

---

### Requirement: Applying a theme clears the previously applied custom properties

`applyThemeColors` (`apps/chat/src/utils/apply-theme-colors.ts`) SHALL remove every CSS custom
property it previously set on the target element before writing the next theme's properties, using
`element.style.removeProperty`. The set of previously written property names SHALL be tracked per
target element.

Calling `applyThemeColors` with no theme SHALL clear the previously applied properties and write
nothing, returning the element to the stylesheet's own values.

#### Scenario: Keys from the previous theme do not leak

- **WHEN** theme A declaring `{ "bg-layer-base": "#fff", "text-accent-primary": "#00f" }` is applied
  and then theme B declaring only `{ "bg-layer-base": "#000" }` is applied to the same element
- **THEN** `--bg-layer-base` is `#000` and `--text-accent-primary` is no longer set on the element

#### Scenario: Clearing restores the stylesheet defaults

- **WHEN** a theme has been applied and `applyThemeColors` is then called with no theme
- **THEN** every property that theme wrote is removed from the element's inline style

#### Scenario: A theme with an unrecognised key still applies

- **WHEN** a theme declares `{ "bg-layer-base": "#000", "not-a-real-token": "#123" }`
- **THEN** both are written as custom properties, `--not-a-real-token` has no visual effect, and no
  error is raised — matching the documented behaviour in `docs/theme-customization.md`

---

### Requirement: The theme picker offers every configured theme

`useThemeOptions` (`apps/chat/src/hooks/theme/useThemeOptions.ts`) SHALL return
`{ options, selectedTheme, setTheme }`, where `options` is an ordered list of
`{ value: string; label: string }`:

- one entry per theme in `config.themes`, in configuration order;
- followed by a synthetic `{ value: 'system' }` entry **only when** the configuration contains both
  `light` and `dark`.

Labels SHALL resolve as: `settings.themeLight` for id `light`, `settings.themeDark` for id `dark`,
`settings.themeSystem` for the synthetic `system` entry, and the theme's own `displayName` for any
other id. A theme with no `displayName` SHALL fall back to its `id`.

`options` SHALL be memoised on `config.themes` and the translation function.

#### Scenario: Only light and dark are configured

- **WHEN** the configuration contains themes `light` and `dark`
- **THEN** `options` is `[Light, Dark, System]` in that order

#### Scenario: Custom themes are offered under their display names

- **WHEN** the configuration contains `light`, `dark`, and `contoso-night` with
  `displayName: "Contoso Night"`
- **THEN** `options` is `[Light, Dark, Contoso Night, System]`, where only the first two labels and
  `System` come from i18n

#### Scenario: System is withheld when only one of light/dark exists

- **WHEN** the configuration contains `light` and `contoso-night` but no `dark`
- **THEN** `options` is `[Light, Contoso Night]` with no `System` entry

#### Scenario: Selecting an option persists and applies it

- **WHEN** `setTheme('contoso-night')` is called
- **THEN** `contoso-night` is written to `StorageKey.Theme`, its colors are applied to `<html>`, and
  `selectedTheme` becomes `contoso-night`

---

### Requirement: The Preferences tab renders the theme picker

`apps/chat/src/pages/SettingsPage/PreferencesTab/PreferencesTab.tsx` SHALL render a ui-kit `Select`
for the theme as the first row of the Preferences tab, replacing the commented-out block at
`:92-107` and the note at `:26-47`.

The row SHALL be rendered when `!isUserSettingsHidden` (the existing
`OverlayFeature.HideUserSettings` rule) **and** `options.length > 1`, and SHALL be hidden otherwise.
It SHALL participate in the tab's existing `isResolvingRows` gate and in `hasAnyRow`, so a
deployment whose only visible row is the theme row does not show the empty state.

**i18n keys** (all already present in `apps/chat/src/i18n/locales/en.json:606-609`, currently
unused): `settings.theme`, `settings.themeLight`, `settings.themeDark`, `settings.themeSystem`.

**Accessibility**: the `Select` is labelled through `labelProps.label` with `t(SettingsI18nKeys.Theme)`,
matching the Language and Keyboard rows; it is reachable and operable by keyboard through the ui-kit
component's own semantics. No `aria-label` is added on top of the visible label.

**RTL**: none specific — the row uses the tab's existing flex column and the ui-kit `Select`, which
inherits direction from the document. No physical-direction classes are introduced.

#### Scenario: Two or more themes are configured

- **WHEN** a user opens Settings → Preferences on a deployment whose configuration has `light` and
  `dark`
- **THEN** a `Theme` select is the first row, showing the currently selected theme

#### Scenario: A single theme is configured

- **WHEN** the configuration contains only `light`
- **THEN** no theme row is rendered, and the tab renders its other rows unchanged

#### Scenario: Changing the theme repaints immediately

- **WHEN** the user picks `Dark` in the theme select
- **THEN** the page repaints in the dark palette without a reload, and the choice survives a reload

#### Scenario: User settings are hidden by the overlay host

- **WHEN** `OverlayFeature.HideUserSettings` is active
- **THEN** the theme row is not rendered regardless of how many themes are configured
