## 1. i18n Config & Locale Files

- [ ] 1.1 Add `fr.json`, `ar.json`, `es.json`, `it.json` to `apps/chat/src/i18n/locales/` — copy all keys from `en.json` (English values as placeholders)
- [ ] 1.2 Register all four new locales in `apps/chat/src/i18n/config.ts` under `resources`
- [ ] 1.3 Add `settings.language` key to `en.json` (value: `"Language"`) and to each new locale file

## 2. Translation Keys Constant

- [ ] 2.1 Add `Language = 'settings.language'` to the `SettingsI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`

## 3. `useLanguage` Hook

- [ ] 3.1 Create `apps/chat/src/hooks/language/useLanguage.ts` — expose `{ language: string, changeLanguage: (code: string) => void }` wrapping `i18n.language` and `i18n.changeLanguage` from `useTranslation`
- [ ] 3.2 Create a `SUPPORTED_LANGUAGES` constant (array of `{ code, nativeName }`) in the same file for the five supported locales with their native-script display names

## 4. Language Submenu in UserMenu

- [ ] 4.1 Import `useLanguage` hook and `IconLanguage` from `@tabler/icons-react` in `UserMenu.tsx`
- [ ] 4.2 Build `languageChildren` array from `SUPPORTED_LANGUAGES`, using `MenuItemLabel` with `isActive={language.startsWith(code)}` for the active indicator
- [ ] 4.3 Insert the Language menu item into `menuItems` immediately after the `divider-1` item (before `theme`) — only when `SUPPORTED_LANGUAGES.length > 1`

## 5. Verification

- [ ] 5.1 Run `npm exec nx lint chat` and fix any lint errors
- [ ] 5.2 Run `npm exec nx typecheck chat` and fix any type errors
- [ ] 5.3 Open the app locally, open the User Menu, confirm Language appears between the identity header and Theme
- [ ] 5.4 Select Arabic — verify `document.documentElement.dir` becomes `"rtl"` and layout mirrors
- [ ] 5.5 Reload the page — verify the selected language is restored from localStorage
- [ ] 5.6 Switch back to English — verify `dir` returns to `"ltr"`
