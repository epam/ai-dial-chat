# Language Selector

## Purpose

Language selection: persistence across sessions, immediate application without reload, and document-direction switching for RTL locales.

## Overview

The language selector allows users to switch the application UI language at runtime. It is surfaced as a submenu within the User Menu dropdown. Language selection persists across sessions via `localStorage` and takes effect immediately without a page reload.

---

## Requirements

### Requirement: The selector exists only when more than one locale is registered

`useNavigationMenuGroups` SHALL build the Language group **only when `SUPPORTED_LANGUAGES.length > 1`** (and `OverlayFeature.HideUserSettings` is off). With a single registered locale there is no Language item in the User Menu and no submenu to open — see `user-menu`.

`SUPPORTED_LANGUAGES` (`apps/chat/src/hooks/language/useLanguage.ts`) currently holds exactly one entry, `{ code: 'en', nativeName: 'English' }`. **Every requirement below therefore describes behaviour that no shipping build can currently exercise through the UI.** They are not stale — the persistence, indication and direction-switching machinery all exist and are wired — but they become reachable only once a second locale is registered per the "Adding a new locale" steps in `AGENTS.md`.

An automated check that opens the User Menu and looks for a Language entry SHALL be treated as blocked on that registration, not as a product defect.

#### Scenario: No Language surface ships with a single locale
- **GIVEN** `SUPPORTED_LANGUAGES` holds a single entry
- **WHEN** the user opens the User Menu
- **THEN** no Language item is rendered and the submenu below cannot be reached

#### Scenario: The selector appears once a second locale is registered
- **GIVEN** a second locale has been added to `SUPPORTED_LANGUAGES` and its locale file registered
- **WHEN** the user opens the User Menu
- **THEN** a Language item is rendered, offering one option per registered locale

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

The currently active language option in the submenu SHALL be visually distinguished, matching the pattern used by the Keyboard Shortcuts submenu — both are `NavigationMenuGroup` options rendered through `MenuItemLabel`'s `isActive`. The indicator SHALL reflect `i18n.language` matched by base language code, so `en-US` marks the `en` option active.

#### Scenario: Active language checkmark shown
- **GIVEN** two or more locales are registered
- **WHEN** the user opens the Language submenu
- **THEN** the currently active language option carries the active indicator

#### Scenario: Only one language is marked active
- **GIVEN** two or more locales are registered
- **WHEN** the Language submenu is open
- **THEN** exactly one language option carries the active indicator

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
