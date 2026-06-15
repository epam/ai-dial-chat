## Context

The application's i18n layer (`apps/chat/src/i18n/config.ts`) uses `i18next` with `i18next-browser-languagedetector`. The detector is already configured to read/write a `localStorage` key and fall back to browser `navigator` language. RTL direction switching is already wired: `applyDocumentDirection` runs on every `languageChanged` event, setting `document.documentElement.dir` automatically. Currently only `en` is registered; the user has no in-product way to change language.

The User Menu (`apps/chat/src/components/Navigation/UserMenu.tsx`) already contains two submenu items — Theme and Keyboard Shortcuts — both following the same pattern: a top-level `DropdownItem` with a `children` array rendered as a flyout submenu.

## Goals / Non-Goals

**Goals:**
- Add a Language submenu item to the User Menu, reusing the existing flyout submenu pattern.
- Register the initial set of locales (`fr`, `ar`, `es`, `it`) and their translation files.
- Persist the selected language via the existing `i18next` localStorage cache — zero new storage keys.
- Render each language option in its native script so users can identify it regardless of the current UI language.
- Display a checkmark on the currently active language.
- RTL activation for Arabic falls through automatically via the existing `applyDocumentDirection` hook.

**Non-Goals:**
- Machine-translating `en.json` into target languages (placeholder files with English keys are acceptable for now; translations are a separate effort).
- Supporting more than the five initial languages in this change.
- Adding a language indicator outside the User Menu (e.g., flag in the header, URL path prefixes).
- Lazy-loading locale bundles (all locales are bundled; lazy splitting is a future optimization).

## Decisions

### 1. Reuse the existing submenu pattern (not a modal or settings page)

The Theme and Keyboard Shortcuts items both use `DropdownItem.children` to produce an inline flyout. Language fits the same shape: a short list of mutually exclusive options with a checkmark on the active one. Reusing this pattern keeps the interaction model consistent and requires no new UI primitives.

**Alternatives considered:**
- *Settings modal*: heavier UI, more navigation cost for a simple single-choice preference.
- *Separate settings page*: disproportionate to the feature scope.

### 2. Persist via `i18next.changeLanguage()` only

`i18next-browser-languagedetector` with `caches: ['localStorage']` already persists the active language on every `i18n.changeLanguage()` call. No manual `localStorage.setItem` is needed; no new storage key is introduced.

**Alternatives considered:**
- *Storing in user config API*: would require backend round-trips and is out of scope for a client-only preference.
- *URL-based locale*: changes routing and URL shape; disproportionate to the change.

### 3. Native script display names as constants (not i18n keys)

Language names are displayed in their own script (e.g., *اللغة العربية*, *Español*) so they are readable regardless of the current UI language. These strings are stable and locale-invariant, so they are best expressed as a typed constant map rather than translation keys.

A single i18n key `settings.language` is still needed for the menu item label (translated with the current UI language), but the option labels inside the submenu use the constant map.

**Alternatives considered:**
- *All language names as i18n keys*: would require every locale file to carry names for every other locale, creating N² translation work and potential inconsistency.

### 4. `useLanguage` hook encapsulates `i18n.language` and `i18n.changeLanguage`

A thin `useLanguage` hook at `apps/chat/src/hooks/language/useLanguage.ts` wraps `useTranslation` (for the `i18n` instance) and exposes `{ language, changeLanguage }`. This isolates the `i18n` imperative API from the component and makes the hook testable.

### 5. Language item inserted between the identity header divider and Theme item

The design mockup places Language immediately below the first divider (after the identity header), above Theme. This ordering groups all preference-style submenus together (Language, Theme, Keyboard Shortcuts) before the logout divider.

## Risks / Trade-offs

- **Incomplete translations** → locale JSON files will initially be copies of `en.json` with English values as placeholders. The UI will fall back to English for untranslated strings anyway. Risk is low; migration: replace strings incrementally as translations become available.
- **RTL layout regressions** → switching to Arabic flips `dir="rtl"` on `<html>`. Any physical-direction Tailwind classes in the existing UI will break. Mitigation: the codebase rules already require logical properties; a post-integration RTL smoke test should be included in the task list.
- **Bundle size** → four extra JSON locale files are bundled. Each is a copy of `en.json` (~a few KB). Acceptable for now; lazy loading can be added later if the file grows significantly.
