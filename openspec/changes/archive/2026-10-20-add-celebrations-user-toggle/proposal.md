## Why

Seasonal celebrations (decorations, click scenes, the event icon and secret phrases from `@epam/ai-dial-celebrations`) are switched on for everyone by the operator's `UI_EVENT`. A user who finds them distracting has no way to turn them off, and users who never asked for them get them anyway. The decision should belong to the user, with the operator's `UI_EVENT` only deciding which event is available.

## What Changes

- **New user preference.** `useCelebrationPreference()` (`apps/chat/src/hooks/celebration/useCelebrationPreference.ts`) stores a boolean under `StorageKey.CelebrationsEnabled` (`'celebrationsEnabled'`) in `localStorage`. Only the stored string `'true'` enables celebrations, so the default is **off**. Mounted instances stay in sync through a window `CustomEvent`, the same way `useKeyboardShortcutPreference` does.
- **Host gate.** `CelebrationHost` passes `config.activeEventId` to `CelebrationProvider` only while the preference is on. Off means the provider receives `null`: no decoration, no scenes, no icon replacement, no secret phrases.
- **Settings row.** `PreferencesFields` renders a `Switch` labeled `t(SettingsI18nKeys.Celebrations)` with the caption `t(SettingsI18nKeys.CelebrationsDescription)`. The row is shown only when the operator configured an event (`config.activeEventId != null`) and `OverlayFeature.HideUserSettings` is off. The Settings page applies the toggle at once; the Settings dialog keeps it in its draft and writes it on Save.
- **Unchanged.** `UI_EVENT`, the client config contract, and the library.

## Capabilities

### Modified Capabilities

- `settings-preferences-tab`: a new seasonal-celebrations switch row.
- `celebration-events`: `CelebrationHost` additionally requires the user's opt-in before it passes the active event.

## Impact

- `apps/chat` only: `StorageKey`, a new hook, `CelebrationHost`, `PreferencesFields`, `PreferencesTab`, `SettingsModal`, i18n keys in `translation-keys.ts` and `en.json`.
- No lib change, so library isolation is unaffected: the library still receives a resolved `activeEventId`.
- Behaviour change for existing deployments with `UI_EVENT` set: celebrations stop showing until each user turns them on.
- Docs: `apps/chat/README.md` (celebration events), `apps/chat-api/README.md` and `.env.template` (`UI_EVENT`), `docs/architecture.md` (`CelebrationHost` row).

## Non-goals

- Persisting the preference on the server (preferences live in `localStorage`, ADR #18 in `docs/architecture.md`).
- An operator setting that changes the default to on.
- Per-scene user toggles.
