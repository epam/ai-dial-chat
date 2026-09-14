## ADDED Requirements

### Requirement: Preferences tab is registered through the shell's extension point

The system SHALL add a `Preferences` member to the `SettingsTabs` enum
(`apps/chat/src/types/settings-tabs.ts`, value `'preferences'`) and exactly one corresponding entry
to the `entries` array in `apps/chat/src/hooks/useSettingsTabConfig.tsx`. The entry SHALL declare:

- `item.id`: `SettingsTabs.Preferences`
- `item.label`: `t(SettingsI18nKeys.Preferences)`
- `item.icon`: `<IconAdjustmentsHorizontal size={DIAL_ICON_SIZE.MD} aria-hidden stroke={DIAL_KIT_ICON_STROKE} />`
- `Component`: `PreferencesTab` (`apps/chat/src/pages/SettingsPage/PreferencesTab/PreferencesTab.tsx`)

The entry SHALL be placed **before** the existing `Usage` entry, and `SettingsPage`'s initial state
SHALL be `useState<SettingsTabs>(SettingsTabs.Preferences)` to match, so `Preferences` is both the
top row and the row selected on mount.

No change SHALL be made to `SettingsPage.tsx`'s rendering logic beyond that initial value, to the
`/settings` route registration in `apps/chat/src/app/app.tsx`, or to `libs/settings-panel`.

The tab is behind no feature flag, because the Settings page itself is behind none — the
`settingsPageEnabled` flag was removed along with its `SETTINGS_PAGE_ENABLED` environment variable
and config-registry entry (see `settings-page-shell`). No new flag is introduced.

**Memoisation:** the entry is added inside the existing `useMemo(..., [t])`; no new dependency.

**i18n keys:** `settings.preferences` (tab label), `settings.preferencesDescription` (tab subtitle).

**RTL impact:** none for the rail (owned by `SettingsPanel`); the tab body's own contract is below.

#### Scenario: Settings rail shows two rows

- **WHEN** a signed-in user opens `/settings`
- **THEN** the `SettingsPanel` rail renders exactly two rows, `Preferences` then `Usage`, each
  labeled through an i18n key
- **AND** `Preferences` is the selected row, and its pane is rendered

#### Scenario: Returning to Preferences swaps the pane back

- **WHEN** the user has opened `Usage` and then clicks or keyboard-activates the `Preferences` row
- **THEN** the right-hand pane renders `PreferencesTab` and the `Preferences` row reports
  `aria-selected="true"`

#### Scenario: Active row highlight becomes visible with two tabs

- **WHEN** the rail renders two items
- **THEN** `SettingsPanel`'s `isVisuallyActive = isActive && items.length > 1` guard resolves `true`
  for the active row and that row is visually highlighted — a state no shipping build rendered while
  only one tab existed

#### Scenario: Preferences is reachable in every deployment

- **WHEN** any signed-in user navigates directly to `/settings` and selects the `Preferences` row
- **THEN** `PreferencesTab` mounts — no configuration can make the tab unreachable

---

### Requirement: The theme selector is parked, not shipped

`PreferencesTab` SHALL NOT render a theme row. The implementation is retained **commented out**,
under four blocks marked `THEME SELECTOR` in
`apps/chat/src/pages/SettingsPage/PreferencesTab/PreferencesTab.tsx` (the header note and imports,
the `THEME_LABEL_KEYS` map, the hook call plus `isThemeRowShown` and `themeOptions`, and the JSX
row), parked for an upcoming theming feature rather than deleted.

This is a deliberate exception to the repository's general preference against commented-out code:
the row is finished and correct but has nothing to show, because only the light theme ships. Keeping
it in one piece means re-enabling it is uncommenting, not rewriting.

Consequences that SHALL hold while it is parked:

- `useThemeOptions` (`apps/chat/src/hooks/theme/useThemeOptions.ts`) returns to **zero call sites**.
  It SHALL NOT be deleted — it is the parked row's entry point.
- The `settings.theme`, `settings.themeLight`, `settings.themeDark` and `settings.themeSystem` i18n
  keys SHALL remain in `en.json` and `SettingsI18nKeys`, unused, for the same reason.
- `PreferencesTab` SHALL NOT import `useThemeOptions` or `ThemeId`, so no unused-import lint error is
  introduced.
- The tab's empty state SHALL be driven by the three live rows only (language, keyboard shortcut,
  "Default agent for new chats").

When the row is re-enabled it SHALL behave as originally specified: a `Select` labeled
`t(SettingsI18nKeys.Theme)`, `value` = `selectedTheme`, `onChange` calling `setTheme`, one option per
entry of `themes` labeled from the `ThemeId`-keyed i18n keys with a `displayName` fallback for an
unrecognised id, rendered only when `themes` holds two or more entries and
`OverlayFeature.HideUserSettings` is off.

#### Scenario: No theme row is rendered

- **WHEN** `PreferencesTab` renders, with any number of themes served
- **THEN** no control labeled `settings.theme` is present

#### Scenario: The parked code does not break the build

- **WHEN** `apps/chat` is typechecked and linted
- **THEN** no unused import, unused variable, or unreachable-code diagnostic arises from the parked
  blocks

#### Scenario: useThemeOptions survives with no callers

- **WHEN** the repository is searched for `useThemeOptions` call sites
- **THEN** none are found outside the parked blocks, and the hook is still exported

---

### Requirement: Preferences tab renders a language selector over SUPPORTED_LANGUAGES

`PreferencesTab` SHALL render a language row as a `Select` labeled `t(SettingsI18nKeys.Language)`,
reading and writing `useLanguage()` (`apps/chat/src/hooks/language/useLanguage.ts`).

- `value` SHALL be the entry of `SUPPORTED_LANGUAGES` whose `code` matches `language` by base
  language code, so `en-US` selects the `en` option.
- `onChange` SHALL call `changeLanguage(code)`.
- One option per entry of `SUPPORTED_LANGUAGES`, labeled with that entry's `nativeName` — rendered
  in the language's own script, **not** through a translation key.

The row SHALL render **only when** `SUPPORTED_LANGUAGES.length > 1` **and**
`OverlayFeature.HideUserSettings` is off, preserving the rule
`useNavigationMenuGroups` applies today. With the single `en` entry that ships, the row is absent.

#### Scenario: Language row is absent while one locale ships

- **GIVEN** `SUPPORTED_LANGUAGES` holds a single entry
- **WHEN** `PreferencesTab` renders
- **THEN** no language row is present

#### Scenario: Language row appears once a second locale is registered

- **GIVEN** `SUPPORTED_LANGUAGES` holds `en` and `ar`
- **WHEN** `PreferencesTab` renders
- **THEN** a select labeled `settings.language` is present with two options bearing each entry's
  `nativeName`

#### Scenario: Selecting a language applies it immediately

- **GIVEN** two or more locales are registered
- **WHEN** the user selects a different language
- **THEN** `changeLanguage(code)` is called and the rendered strings update without a page reload

#### Scenario: Regional language code matches its base option

- **GIVEN** `i18n.language` is `en-US` and `SUPPORTED_LANGUAGES` holds `en` and `ar`
- **WHEN** the language row renders
- **THEN** the `en` option is the select's value

---

### Requirement: Preferences tab renders a keyboard-shortcut selector

`PreferencesTab` SHALL render a keyboard row as a `Select` labeled
`t(SettingsI18nKeys.KeyboardShortcuts)`, reading and writing `useKeyboardShortcutPreference()`.

Two options, in this order:

1. `t(SettingsI18nKeys.ShortcutEnter)` → `SendOnEnter.Enter`
2. `t(SettingsI18nKeys.ShortcutMetaEnter, { modifier: metaKey })` → `SendOnEnter.MetaEnter`, where
   `metaKey` is the existing platform-aware export (`⌘` on macOS, `Ctrl` elsewhere)

`value` SHALL be `preference`; `onChange` SHALL call `setPreference(value)`.

The row SHALL render **only when** `OverlayFeature.HideUserSettings` and
`OverlayFeature.HideKeyboardShortcuts` are both off — the same two suppressions
`useNavigationMenuGroups` applies to the keyboard group today.

This requirement changes **only the surface**. The storage key, value grammar, default,
cross-instance-sync guarantee and chat-input behaviour specified by
`keyboard-shortcut-preference` are unaffected.

#### Scenario: Selecting a shortcut option persists it and reaches the chat input

- **WHEN** the user selects the `⌘/Ctrl+Enter` option in the Preferences tab
- **THEN** `setPreference(SendOnEnter.MetaEnter)` is called, `localStorage` under
  `StorageKey.KeyboardShortcut` holds `'meta-enter'`, and a mounted chat input reflects the new
  shortcut on the same render cycle — no reload or navigation

#### Scenario: Platform-aware modifier label

- **WHEN** the user is on macOS
- **THEN** the second option's label interpolates `⌘` as its modifier
- **WHEN** the user is on Windows or Linux
- **THEN** it interpolates `Ctrl`

#### Scenario: Keyboard row is suppressed by its overlay flag

- **GIVEN** `OverlayFeature.HideKeyboardShortcuts` is enabled
- **WHEN** `PreferencesTab` renders
- **THEN** no keyboard row is present and every other row's visibility is unaffected

---

### Requirement: Preferences tab renders the Default agent for new chats selector

`PreferencesTab` SHALL render a `DefaultAgentSelect`
(`apps/chat/src/components/Settings/DefaultAgentSelect/DefaultAgentSelect.tsx`) labeled
`t(SettingsI18nKeys.DefaultAgent)`, bound to `useDefaultAgentPreference()` — whose storage and
resolution semantics are specified by `default-agent-preference`.

The control SHALL be a `DeploymentSelectorFieldTrigger`
(`apps/chat/src/components/DeploymentSelector/DeploymentSelectorFieldTrigger.tsx`) — the same picker
the chat input opens, specified by `deployment-selector-form-trigger` — under a host-rendered
`Label` from `@epam/ai-dial-ui-kit` whose `id` is passed back as `labelledById`. It SHALL NOT be a
flat `Select` enumerating the catalog: the panel owns search, the Current Selected row, Favorites
with star toggles, and the Browse-catalog footer, so the preference is picked the way an agent is
picked everywhere else, and the control never materialises one option node per deployment.

`selectedId` SHALL be the stored `preference` and `onSelect` SHALL be `setPreference` directly, so
both a deployment id and a mode sentinel round-trip through the same prop pair.

The two modes carried over from chat 1.0 SHALL be supplied through the trigger's `extraOptions`
prop, in this order:

1. `{ id: DefaultAgentMode.DefaultAgent, label: t(SettingsI18nKeys.DefaultAgentOptionDefault) }`
2. `{ id: DefaultAgentMode.LastUsedAgent, label: t(SettingsI18nKeys.DefaultAgentOptionLastUsed) }`

They render as icon-less rows pinned above every catalog section, so they read as modes rather than
as agents, and the panel's own search filters them alongside the deployment rows. The row chrome,
selection marking, and search-filtering of `extraOptions` are specified by
`deployment-selector-form-trigger`; this requirement owns only which options are supplied and what
they persist.

Search behaviour is the panel's, not this control's: it holds no `searchQuery` state, passes no
`searchable`/`searchPlaceholder`, and renders no `Highlight` itself.

The row SHALL render only when **all three** hold:

1. `useFeatureFlag('defaultDeploymentPinned')` is `true` — the operator has pinned a specific agent
   via `DEFAULT_DEPLOYMENT_PINNED`;
2. `OverlayFeature.HideUserSettings` is off;
3. `useDeployments().items` is non-empty.

The pin gate is the substantive one. The row's first option is `Default agent`, which resolves to the
operator's configured deployment — without a pin there is no operator choice for the user to keep,
override, or fall back to, so the row would offer a meaningless option. Pinning therefore **unlocks**
the user's override rather than forbidding it: when the row is shown, an explicitly named agent still
outranks the pin (see `default-agent-preference`). That is a deliberate reading of
`DEFAULT_DEPLOYMENT_PINNED`, whose own description says the pin "takes priority over the
user-persisted model preference" — the pin does beat the *implicit* last-used preference, but not an
*explicit* choice the user made in this control.

`defaultDeploymentPinned` defaults to `false`, so no default deployment renders this row.

The control SHALL tolerate a `preference` that resolves to neither a mode nor a loaded deployment —
a preference naming a deployment since removed from the catalog — without throwing or clearing the
stored preference. The trigger's own label-resolution order applies (`extraOptions` match, then the
resolved deployment name, then the raw id), so such a preference stays visible as its raw id rather
than rendering blank.

#### Scenario: Mode rows precede the panel's catalog sections

- **WHEN** the user opens the Default agent for new chats field
- **THEN** the panel renders `Default agent` and `Last used agent` as the first two rows, icon-less
  and with no favourite toggle, above the Current Selected / Favorites sections

#### Scenario: The panel's search filters the mode rows too

- **WHEN** the user types a query into the opened panel's search field
- **THEN** the mode rows are filtered by case-insensitive substring on their label alongside the
  deployment rows, and surviving rows render their matched text through `Highlight`

#### Scenario: Selecting a specific agent persists its id

- **WHEN** the user picks a deployment row whose id is `gpt-4o`
- **THEN** `setPreference('gpt-4o')` is called and `localStorage` under `StorageKey.DefaultAgent`
  holds `'gpt-4o'`

#### Scenario: Selecting Default agent persists the sentinel

- **WHEN** the user picks the `Default agent` row
- **THEN** `setPreference(DefaultAgentMode.DefaultAgent)` is called and `localStorage` holds
  `'default-agent'`

#### Scenario: Stored preference names a deployment no longer in the catalog

- **GIVEN** `localStorage` holds `'retired-model'` and no catalog entry has that id
- **WHEN** the Default agent row renders
- **THEN** the trigger renders without error, displays `retired-model` as its own value, no panel
  row is marked selected, and the stored value is left in place

#### Scenario: Row is absent before deployments load

- **GIVEN** `useDeployments().items` is empty
- **WHEN** `PreferencesTab` renders
- **THEN** no Default agent row is present

#### Scenario: Row is absent when no agent is pinned

- **GIVEN** `defaultDeploymentPinned` resolves to `false` — its default — and the catalog is populated
- **WHEN** `PreferencesTab` renders
- **THEN** no Default agent row is present, and the other rows are unaffected

#### Scenario: Row appears once an agent is pinned

- **GIVEN** `defaultDeploymentPinned` resolves to `true` and the catalog is populated
- **WHEN** `PreferencesTab` renders
- **THEN** the Default agent row is present, and opening it offers `Default agent`, `Last used
  agent`, the Favorites sections, and the Browse-catalog action

#### Scenario: Hiding user settings still wins over a pin

- **GIVEN** `defaultDeploymentPinned` is `true` and `OverlayFeature.HideUserSettings` is enabled
- **WHEN** `PreferencesTab` renders
- **THEN** no Default agent row is present

---

### Requirement: Preferences tab layout, heading, empty state, and RTL contract

`PreferencesTab` SHALL follow `UsageTab`'s structure: an `<h2 class="dial-h1-text">` carrying
`t(SettingsI18nKeys.Preferences)` and a `<p class="dial-small-text">` carrying
`t(SettingsI18nKeys.PreferencesDescription)`, above a vertically stacked, scrollable body holding
the rows. The `<h2>` sits under the shell's existing `sr-only` `<h1>`, so heading order is
`h1 → h2`.

When **every** row is suppressed — reachable for an overlay host with
`OverlayFeature.HideUserSettings` enabled — the body SHALL render the shared empty state rather than
an empty pane.

All spacing SHALL use direction-agnostic or logical Tailwind utilities (`gap-*`, `px-*`, and
`ps-*`/`pe-*` for any one-sided spacing); physical `pl-*`/`pr-*`/`ml-*`/`mr-*`/`text-left`/`text-right`
SHALL NOT be used. The tab renders no directional icons, so no icon mirroring is required.

**Memoisation:** each live row's `options` array SHALL be built inside a `useMemo` keyed on its own
inputs (`t`, plus `SUPPORTED_LANGUAGES` / `preference` / `items` and `searchQuery` respectively), so
a keystroke in the search field does not rebuild the other rows' options.

#### Scenario: Heading structure

- **WHEN** `PreferencesTab` renders inside the Settings shell
- **THEN** the accessible heading order is the shell's `sr-only` `<h1>` "Settings" followed by the
  tab's `<h2>` "Preferences"

#### Scenario: Every row suppressed

- **GIVEN** `OverlayFeature.HideUserSettings` is enabled
- **WHEN** `PreferencesTab` renders
- **THEN** no preference rows are present and the shared empty state is rendered

#### Scenario: Rendering under an RTL locale

- **WHEN** the active language is Arabic (`dir="rtl"` on `<html>`)
- **THEN** the tab's heading, description and rows lay out mirrored with no visual breakage, driven
  only by logical-property styles

#### Scenario: Each select is programmatically labeled

- **WHEN** the tab renders any row
- **THEN** that row's `Select` exposes an accessible name from its `labelProps.label`, and the
  control is reachable and operable by keyboard alone
