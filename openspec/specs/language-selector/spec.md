# Language Selector

## Purpose

Language selection: persistence across sessions, immediate application without reload, and document-direction switching for RTL locales.

## Overview

The language selector allows users to switch the application UI language at runtime. It is surfaced as a submenu within the User Menu dropdown. Language selection persists across sessions via `localStorage` and takes effect immediately without a page reload.

---

## Requirements

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

### Requirement: Language selection persists across sessions

Selecting a language SHALL call `i18n.changeLanguage(code)`, which persists the selection to `localStorage` via the existing `i18next-browser-languagedetector` cache. On the next page load the detector SHALL restore the saved language automatically. The display name for each language option SHALL be rendered in that language's own native script using a constant map (`SUPPORTED_LANGUAGES[].nativeName`), not a translation key.

#### Scenario: Language persists on reload
- **GIVEN** two or more locales are registered
- **WHEN** the user selects a language
- **AND** reloads the page
- **THEN** the UI renders in the selected language and the Language submenu shows it as the active option

#### Scenario: Language changes immediately without page reload
- **GIVEN** two or more locales are registered
- **WHEN** the user selects a language from the Language submenu
- **THEN** all translated strings in the current view update to that language without a full page reload

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

---

### Requirement: RTL language selection switches document direction

When the user selects an RTL language, the existing `applyDocumentDirection` hook SHALL set `document.documentElement.dir = 'rtl'` and update `document.documentElement.lang` via the `i18n.on('languageChanged', ...)` listener already registered in `config.ts`. Switching back to an LTR language SHALL restore `dir="ltr"`. No additional direction-switching logic is required in the language selector itself.

This listener is registered regardless of how many locales are offered in the UI, so a language changed programmatically (or restored from the detector cache) still switches direction.

#### Scenario: RTL language triggers RTL layout
- **WHEN** the active language changes to an RTL language
- **THEN** `document.documentElement.dir` becomes `"rtl"` and the UI layout mirrors accordingly

#### Scenario: Switching to LTR language restores LTR layout
- **WHEN** the active language is RTL and changes to an LTR language
- **THEN** `document.documentElement.dir` becomes `"ltr"` and the layout reverts to left-to-right
