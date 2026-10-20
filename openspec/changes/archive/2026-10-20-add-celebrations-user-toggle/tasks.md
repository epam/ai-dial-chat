## 1. Preference

- [x] 1.1 Add `StorageKey.CelebrationsEnabled = 'celebrationsEnabled'` to `apps/chat/src/types/storage-key.ts`
- [x] 1.2 Add `useCelebrationPreference()` in `apps/chat/src/hooks/celebration/useCelebrationPreference.ts` returning `{ isEnabled, setIsEnabled }`; only `'true'` reads as on; same-tab sync through a window `CustomEvent`
- [x] 1.3 Unit tests in `apps/chat/src/hooks/celebration/tests/useCelebrationPreference.spec.ts`: default off, stored value read, write persists and syncs another instance

## 2. Host gate

- [x] 2.1 `CelebrationHost` passes `config.activeEventId` only while `isEnabled`
- [x] 2.2 `CelebrationHost.spec.tsx`: event withheld while the preference is off, passed once it turns on

## 3. Settings row

- [x] 3.1 Add `SettingsI18nKeys.Celebrations` / `CelebrationsDescription` and the `en.json` strings
- [x] 3.2 `PreferencesFields`: `isCelebrationEnabled` / `onCelebrationEnabledChange` props and a `Switch` row shown when `config.activeEventId != null` and `HideUserSettings` is off
- [x] 3.3 Wire `PreferencesTab` (applies at once) and `SettingsModal` (draft, written on Save)
- [x] 3.4 Tests in `PreferencesTab.spec.tsx` and `SettingsModal.spec.tsx`

## 4. Docs and verification

- [x] 4.1 Update `apps/chat/README.md`, `apps/chat-api/README.md`, `apps/chat-api/.env.template`, `docs/architecture.md`
- [x] 4.2 `npm run validate:docs`, lint, typecheck and the affected specs
