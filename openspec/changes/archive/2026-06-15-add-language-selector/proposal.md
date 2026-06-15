## Why

The application ships with a single English locale and no in-product way for users to switch languages. Supporting multi-language UIs — including Arabic RTL — requires both the locale files and a user-facing selector; without the selector, even adding translations is invisible to users.

## What Changes

- Add a **Language** submenu item to the User Menu (between the avatar header and the Theme item), matching the design shown with a right-arrow sub-panel pattern already used by Theme and Keyboard Shortcuts.
- Register additional locale resources (`fr`, `ar`, `es`, `it`) in `apps/chat/src/i18n/config.ts` and create the corresponding `locales/<lang>.json` files.
- Persist the selected language to `localStorage` via the existing `i18next-browser-languagedetector` `localStorage` cache — no new storage key is required.
- Display each language option in its own native script (e.g. *اللغة العربية* for Arabic, *Español* for Spanish) so users can identify their language regardless of the current UI language.
- Mark the currently active language with a checkmark in the submenu.
- **Hide the Language item entirely when only one language is registered** — the menu item is only useful if there is a choice to make.
- Switching to `ar` triggers the existing `applyDocumentDirection` logic, flipping the document to `dir="rtl"` automatically.

## Capabilities

### New Capabilities

- `language-selector`: In-app language switching via a submenu in the User Menu. Covers language option rendering, active-language indication, persistence, and RTL activation on Arabic selection.

### Modified Capabilities

- `user-menu`: A Language submenu item is added above the Theme item. The divider structure and submenu pattern are unchanged; only the item list grows.

## Impact

- **`apps/chat/src/i18n/config.ts`** — new locale registrations and language list constant.
- **`apps/chat/src/i18n/locales/`** — new `fr.json`, `ar.json`, `es.json`, `it.json` (full key coverage from `en.json`).
- **`apps/chat/src/components/UserMenu/`** — new `LanguageSubmenu` component and integration into the `UserMenu` dropdown.
- **i18n key additions** — `settings.language` and one display-name key per locale (or use native names as constants).
- No API changes; no backend changes; no breaking changes.
