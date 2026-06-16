## ADDED Requirements

### Requirement: Language selection persists across sessions

Selecting a language SHALL call `i18n.changeLanguage(code)`, which persists the selection to `localStorage` via the existing `i18next-browser-languagedetector` cache. On the next page load the detector SHALL restore the saved language automatically. The display name for each language option SHALL be rendered in that language's own native script using a constant map, not a translation key.

#### Scenario: Language persists on reload
- **WHEN** the user selects a language
- **AND** reloads the page
- **THEN** the UI renders in the selected language and the Language submenu shows it as the active option

#### Scenario: Language changes immediately without page reload
- **WHEN** the user selects a language from the Language submenu
- **THEN** all translated strings in the current view update to that language without a full page reload

---

### Requirement: Active language is visually indicated

The currently active language option in the submenu SHALL be visually distinguished (e.g., checkmark) matching the pattern used by the Theme and Keyboard Shortcuts submenus. The indicator SHALL reflect `i18n.language` (the base language code, e.g. `en` not `en-US`).

#### Scenario: Active language checkmark shown
- **WHEN** the user opens the Language submenu
- **THEN** the currently active language option has a checkmark or equivalent active indicator

#### Scenario: Only one language is marked active
- **WHEN** the Language submenu is open
- **THEN** exactly one language option carries the active indicator

---

### Requirement: RTL language selection switches document direction

When the user selects an RTL language, the existing `applyDocumentDirection` hook SHALL set `document.documentElement.dir = 'rtl'` and update `document.documentElement.lang` via the `i18n.on('languageChanged', ...)` listener already registered in `config.ts`. Switching back to an LTR language SHALL restore `dir="ltr"`. No additional direction-switching logic is required in the language selector itself.

#### Scenario: RTL language triggers RTL layout
- **WHEN** the user selects an RTL language
- **THEN** `document.documentElement.dir` becomes `"rtl"` and the UI layout mirrors accordingly

#### Scenario: Switching to LTR language restores LTR layout
- **WHEN** the user is on an RTL language and selects an LTR language
- **THEN** `document.documentElement.dir` becomes `"ltr"` and the layout reverts to left-to-right
