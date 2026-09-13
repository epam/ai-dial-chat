## MODIFIED Requirements

### Requirement: The selector exists only when more than one locale is registered

The system SHALL offer language selection on **two** surfaces, both live at once:

- the **Settings page's Preferences tab** (`settings-preferences-tab`) — its home alongside theme,
  keyboard shortcut and "Default agent for new chats". The Settings page is behind no feature flag, so this
  surface is always reachable on desktop;
- the **desktop `UserMenu` submenu** built by `useNavigationMenuGroups` (see `user-menu`) — retained
  as a quick picker.

Both write through the same `useLanguage().changeLanguage`, so they cannot disagree: a change made
on either is reflected on the other without a reload.

Each surface SHALL be built **only when `SUPPORTED_LANGUAGES.length > 1`** and
`OverlayFeature.HideUserSettings` is off. With a single registered locale there is no language
control anywhere in the application.

`SUPPORTED_LANGUAGES` (`apps/chat/src/hooks/language/useLanguage.ts`) currently holds exactly one
entry, `{ code: 'en', nativeName: 'English' }`. **Every requirement below therefore describes
behaviour that no shipping build can currently exercise through the UI.** They are not stale — the
persistence, indication and direction-switching machinery all exist and are wired — but they become
reachable only once a second locale is registered per the "Adding a new locale" steps in `AGENTS.md`.

An automated check that looks for a language control SHALL be treated as blocked on that
registration, not as a product defect.

#### Scenario: No language surface ships with a single locale
- **GIVEN** `SUPPORTED_LANGUAGES` holds a single entry
- **WHEN** the user opens the User Menu, and separately opens Settings → Preferences
- **THEN** neither surface offers a language control

#### Scenario: The Preferences row appears once a second locale is registered
- **GIVEN** a second locale has been added to `SUPPORTED_LANGUAGES` and its locale file registered
- **WHEN** the user opens Settings → Preferences
- **THEN** a language select is rendered, offering one option per registered locale

#### Scenario: The user menu also offers a language item
- **GIVEN** two or more locales are registered
- **WHEN** the user opens the User Menu
- **THEN** a Language item is rendered there too, with one option per registered locale

#### Scenario: The two surfaces agree
- **GIVEN** two or more locales are registered
- **WHEN** the user changes the language from the User Menu submenu and then opens
  Settings → Preferences
- **THEN** the language select shows the newly chosen locale as its value

---

### Requirement: Active language is visually indicated

The currently active language option SHALL be visually distinguished on both surfaces: in the
Preferences tab's language `Select`, by the control's own selected-option treatment; and in the
`UserMenu` submenu, through `MenuItemLabel`'s `isActive`.

In the **Preferences tab**, the selected value SHALL be resolved by comparing **base** language
codes — both `i18n.language` and each option's `code` reduced to the segment before any `-` — so
`en-US` selects the `en` option. Comparing bases rather than prefix-matching keeps this correct if a
regional code is ever registered alongside its base, where a list-order-dependent prefix match would
let `en` shadow `en-GB`.

The **`UserMenu` submenu** still uses the pre-existing `language.startsWith(code)` prefix match,
carried over unchanged when the group was restored. The two agree for every locale set that can
ship today (a single base code per language), and diverge only in the `en` / `en-GB` case above.
Converging the submenu on base-code comparison is a follow-up, not a behaviour this change alters.

#### Scenario: Active language is marked in the Preferences tab
- **GIVEN** two or more locales are registered
- **WHEN** the user opens the language select
- **THEN** the currently active language option is the selected one

#### Scenario: Only one language is marked active
- **GIVEN** two or more locales are registered
- **WHEN** the language select is open
- **THEN** exactly one language option is marked active

#### Scenario: Regional code matches its base option
- **GIVEN** `i18n.language` is `en-US` and both `en` and `ar` are registered
- **WHEN** the language row renders
- **THEN** the `en` option is the select's value
