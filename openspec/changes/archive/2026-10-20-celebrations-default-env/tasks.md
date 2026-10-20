Slicing strategy: **contract-first, then vertical.** Slice 1 lands the backend field and the
regenerated client, so the frontend has a typed `config.celebrationsEnabledByDefault`. Slice 2
makes the hook use it end to end. Slice 3 is docs. Each slice is verifiable on its own; no lib is
touched.

## 1. Backend: env var → registry → client-config (chat-api)

- [x] 1.1 Add `UI_EVENT_ENABLED_BY_DEFAULT?: boolean = true` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`, next to `UI_EVENT`, with the same `@IsOptional`/`@Transform`/`@IsBoolean` shape as `USAGE_LIMITS_CONTROL_ENABLED` (absent → default; `false`/`0`/`no`, trimmed and case-insensitive → `false`; else `true`).
  - Verification: add cases to `apps/chat-api/src/config/tests/validation.spec.ts` (unset → `true`; `false`/`0`/`no`/`FALSE` → `false`; `true`/`1`/`yes` → `true`); `npm run test:file -- apps/chat-api/src/config/tests/validation.spec.ts`
- [x] 1.2 Add the `ui.celebrationsEnabledByDefault` entry to `CONFIG_DEFINITIONS` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, directly after `ui.activeEventId` (`type: 'config'`, `valueType: 'boolean'`, `visibility: 'client'`, `defaultValue: true`, `critical: false`, `owner: 'chat-team'`, `envVar: 'UI_EVENT_ENABLED_BY_DEFAULT'`, description stating the user's stored choice overrides it).
  - Verification: a test in `apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts` asserting the entry; a test in `apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts` that `false` resolves to `false` and the unset default resolves to `true`; `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts`
- [x] 1.3 In `apps/chat-api/src/app-config/client-config.mapper.ts`, add `celebrationsEnabledByDefault: true` at the end of `createDefaultClientConfig` and the mapping `defineMapping('celebrationsEnabledByDefault', ({ resolved }) => resolved !== false)` to `CLIENT_CONFIG_MAPPINGS`. Update `MappedClientConfig` if it is declared separately.
  - Verification: update `apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts` (table stays in sync with `CONFIG_DEFINITIONS`; `false` → `false`, `undefined`/non-boolean → `true`) and the `Object.keys(result.config)` order list in `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`; assert `celebrationsEnabledByDefault` is absent from `result.features`; `npm run test:file -- apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts apps/chat-api/src/app-config/tests/app-config.service.spec.ts`
- [x] 1.4 Add the required `celebrationsEnabledByDefault!: boolean` field with `@ApiProperty({ type: Boolean, description, example: true })` to `ClientConfigDto` in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts`.
- [x] 1.5 Regenerate the client: `npm run openapi`, then `npm run openapi:check`; build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`). Do not hand-edit `libs/chat-api-client`.
- [x] 1.6 Slice check: `npm run verify:changed`.

## 2. Frontend: effective preference (chat)

- [x] 2.1 Add `celebrationsEnabledByDefault: boolean` to `AppConfigState['config']` in `apps/chat/src/context/AppConfigContext.tsx`, `true` in `INITIAL_STATE`, and `response.config?.celebrationsEnabledByDefault ?? true` in `loadConfig`. Add the field to `apps/chat/src/context/tests/app-config-context-mock.ts` and to any typed `config` literal that now fails typecheck (e.g. `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx`).
  - Verification: cases in `apps/chat/src/context/tests/AppConfigContext.spec.tsx` (missing field → `true`; `false` passes through); `npm run test:file -- apps/chat/src/context/tests/AppConfigContext.spec.tsx`
- [x] 2.2 In `apps/chat/src/hooks/celebration/useCelebrationPreference.ts`, make `readStoredPreference` return `boolean | null` (`'true'`/`'false'`/else `null`). Keep the stored value in state and derive `isEnabled = stored ?? config.celebrationsEnabledByDefault` from `useAppConfig()`. Never write the default. Keep `setIsEnabled` and the `CustomEvent` broadcast unchanged. Update the comment and JSDoc to explain why the default stays live (operator changes must reach users who never chose).
  - Verification: extend `apps/chat/src/hooks/celebration/tests/useCelebrationPreference.spec.ts` (nothing stored + default `true` → on; nothing stored + default `false` → off; stored `'false'` beats default `true`; stored `'true'` beats default `false`; changing the config default flips an unstored hook; reading never writes storage); `npm run test:file -- apps/chat/src/hooks/celebration/tests/useCelebrationPreference.spec.ts`
- [x] 2.3 Update consumers' tests whose `useAppConfig` mocks lack the new field, and add the spec scenarios: `CelebrationHost` passes the event with nothing stored and default `true`, and `null` with stored `'false'`; the `PreferencesTab` switch reads on/off from the default; a `SettingsModal` Save without changes writes nothing.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.spec.tsx apps/chat/src/context/tests/CelebrationHost.integration.spec.tsx apps/chat/src/pages/SettingsPage/PreferencesTab/tests/PreferencesTab.spec.tsx apps/chat/src/components/SettingsModal/tests/SettingsModal.spec.tsx`
- [x] 2.4 Slice check: `npm run verify:changed`.

## 3. Docs and specs

- [x] 3.1 `apps/chat-api/README.md`: add a `UI_EVENT_ENABLED_BY_DEFAULT` row (default `true`; exposed as `config.celebrationsEnabledByDefault`; only `false`/`0`/`no` turn it off; the user's saved choice wins; restart to apply). Update the `UI_EVENT` row's "off for each user until they turn it on" sentence.
- [x] 3.2 `apps/chat-api/.env.template`: add a commented `# UI_EVENT_ENABLED_BY_DEFAULT=true` under `UI_EVENT` and replace the "off by default" line.
- [x] 3.3 `apps/chat/README.md` (celebrations section), the `CelebrationHost` row in `docs/architecture.md`, and the `UI_EVENT` paragraph in `docs/theme-customization.md`: describe the operator default and that a stored choice overrides it.
- [x] 3.4 Run `npm run validate:docs` and `npm run validate:specs`.

## 4. Close

- [x] 4.1 `npm run verify:full`.
