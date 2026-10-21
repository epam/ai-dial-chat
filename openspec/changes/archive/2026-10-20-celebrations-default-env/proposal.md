## Why

The user toggle for seasonal celebrations (#9496) made every configured `UI_EVENT` invisible until each user opts in, and the operator has no way to change that default. An operator who sets `UI_EVENT=new-year` usually wants people to see it. Today every user has to find the switch in Settings first, so the event effectively stays dark.

## What Changes

- New env var `UI_EVENT_ENABLED_BY_DEFAULT` (boolean, **default `true`**). It sets the initial state of the **Seasonal celebrations** switch for users who have not saved a choice of their own. Only `false`, `0` or `no` (case-insensitive) turn it off.
- New client-visible config registry key `ui.celebrationsEnabledByDefault`, exposed by the existing `GET /api/v1/client-config` as `config.celebrationsEnabledByDefault: boolean`. Swagger and the generated client response model gain the field. No new endpoint.
- `useCelebrationPreference()` reads three states from storage. A stored `'true'` or `'false'` still wins; when nothing is stored, it falls back to `config.celebrationsEnabledByDefault`. The user switch, its visibility rule and its Save/Cancel behaviour stay the same.
- **Behaviour change (reverses #9496's default):** on deployments that set `UI_EVENT` and leave the new var unset, users who never touched the switch see celebrations again. Operators who want #9496's opt-in behaviour set `UI_EVENT_ENABLED_BY_DEFAULT=false`. Users who already saved a choice keep it.

**Problem:** the operator cannot choose whether a configured event is visible by default.
**Solution:** an operator default for the per-user preference. The user's explicit choice still overrides it.
**Non-goals:** per-role defaults or role gating; server-side persistence of the user choice; scheduling; changes to `libs/celebrations`; a new `ENABLED_FEATURES` key.

**Alternatives considered:**
1. *Make the switch default on in code only.* Rejected: it still leaves the operator no say, which is what was asked for.
2. *Register a `features.*` flag (`FeatureKey`, `useFeatureFlag`).* Rejected: feature flags go through role gating and mean "capability on/off". This value is a default for a user preference that sits next to `config.activeEventId`, so it belongs in `config.*`. `overlay.enabled` is the existing precedent for a boolean `config` key.
3. *Write the operator default into `localStorage` on first load.* Rejected: it freezes the default per browser, so a later operator change never reaches users who never touched the switch.

**Acceptance criteria:**
- With `UI_EVENT=halloween` and the new var unset, a user with nothing stored sees decorations on `/` and the switch reads on.
- With `UI_EVENT_ENABLED_BY_DEFAULT=false`, the same user sees nothing and the switch reads off (the #9496 behaviour).
- A stored `'false'` hides celebrations even when the default is `true`. A stored `'true'` shows them even when the default is `false`.
- Opening the Settings dialog and saving without changes writes nothing to storage.
- `client-config` returns `config.celebrationsEnabledByDefault`. `npm run openapi:check`, chat and chat-api tests, and `npm run validate:docs` / `validate:specs` pass.

**Rollback:** not breaking at the API level; the field is additive. To restore the #9496 behaviour without a deploy, set `UI_EVENT_ENABLED_BY_DEFAULT=false`. Reverting the code is safe because stored values keep the same format.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `config-registry-and-env-provider`: adds `UI_EVENT_ENABLED_BY_DEFAULT` → `ui.celebrationsEnabledByDefault` → `config.celebrationsEnabledByDefault`.
- `settings-preferences-tab`: the celebrations switch's default comes from the operator config instead of always being off.
- `celebration-events`: `CelebrationHost`'s opt-in gate uses the effective preference (stored choice, otherwise the operator default).

## Impact

- **Backend (`apps/chat-api`):** `src/config/environment.config.ts` (new validated var, modelled on `USAGE_LIMITS_CONTROL_ENABLED`), `src/app-config/config-registry/config-registry.constants.ts` (new entry next to `ui.activeEventId`), `src/app-config/client-config.mapper.ts` (default + mapping), `src/app-config/dto/client-config-response.dto.ts`, OpenAPI regeneration of `libs/chat-api-client` (generated only, no hand edits).
- **Frontend (`apps/chat`):** `src/context/AppConfigContext.tsx` (state field), `src/hooks/celebration/useCelebrationPreference.ts` (fallback to the operator default; modelled on its current shape). `CelebrationHost`, `PreferencesFields`, `PreferencesTab` and `SettingsModal` keep calling the hook unchanged.
- **Libs:** none. `libs/celebrations` still receives only a resolved `activeEventId`.
- **i18n:** no new user-visible strings. The existing caption stays accurate.
- **Docs:** `apps/chat-api/README.md`, `apps/chat-api/.env.template`, `apps/chat/README.md`, `docs/architecture.md` (`CelebrationHost` row), `docs/theme-customization.md`.
