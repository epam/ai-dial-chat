## ADDED Requirements

### Requirement: AppConfigContext exposes loading, ready, and error states

The system SHALL rewrite `apps/chat/src/context/AppConfigContext.tsx` to expose an `AppConfigState` interface:

```typescript
interface AppConfigState {
  status: 'loading' | 'ready' | 'error';
  features: Record<string, boolean>;
  config: {
    asrModelId: string | null;
    transcribeSizeLimitBytes: number;
    dialCoreExternalUrl: string | null;
  };
  metadata?: { resolvedAt: string; cacheTtlSeconds: number };
}
```

The initial value (before the API call completes) SHALL use `status='loading'`, `features={}`, and safe default values for `config`, including `dialCoreExternalUrl: null`. On success, `status='ready'` and `config.dialCoreExternalUrl` is set from the `GET /api/v1/client-config` response's `config.dialCoreExternalUrl` field. On error, `status='error'` and defaults are retained.

Pattern MUST follow `ThemeContext.tsx`: `createContext<AppConfigState | undefined>(undefined)`, context value wrapped in `useMemo`, guard hook throws `Error` when used outside provider.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

**Memoization:** Context value MUST be wrapped in `useMemo` to prevent all consumers re-rendering on every parent render.

**Accessibility:** None required for this context (no UI element).

#### Scenario: Status is loading before API call completes

- **WHEN** `AppConfigProvider` mounts and the API call has not yet resolved
- **THEN** `useAppConfig().status` returns `'loading'`
- **AND** `useAppConfig().config.dialCoreExternalUrl` returns `null`
- **AND** `useFeatureFlag('features.asrEnabled')` returns `false`

#### Scenario: Status is ready after successful API call

- **WHEN** the API call resolves successfully
- **THEN** `useAppConfig().status` returns `'ready'`
- **AND** `useAppConfig().features` contains the values from the response

#### Scenario: Status is error after API call failure

- **WHEN** the API call rejects (network error, 4xx, 5xx)
- **THEN** `useAppConfig().status` returns `'error'`
- **AND** `useAppConfig().config` retains safe defaults (`asrModelId: null`, `transcribeSizeLimitBytes: 5242880`, `dialCoreExternalUrl: null`)

#### Scenario: useAppConfig throws when used outside provider

- **WHEN** `useAppConfig()` is called in a component that is not wrapped in `AppConfigProvider`
- **THEN** it throws an `Error` with a descriptive message (e.g. `'useAppConfig must be used within AppConfigProvider'`)

#### Scenario: dialCoreExternalUrl is populated from a successful response

- **WHEN** the API call resolves with `config.dialCoreExternalUrl: 'https://dial.example.com'`
- **THEN** `useAppConfig().config.dialCoreExternalUrl` returns `'https://dial.example.com'`

#### Scenario: dialCoreExternalUrl stays null when the backend omits it

- **WHEN** the API call resolves with `config.dialCoreExternalUrl: null`
- **THEN** `useAppConfig().config.dialCoreExternalUrl` returns `null`

---

### Requirement: AppConfigProvider uses async/await with AbortController

The provider SHALL fetch config using `async`/`await` with an `AbortController` inside `useEffect`. A `cancelled` flag SHALL prevent `setState` after unmount. The pattern MUST follow `useFavicon.ts`.

The provider SHALL call `AppConfigApi.getClientConfig({ appId: 'chat-ui' })` from the server-api wrapper `apps/chat/src/server-api/app-config.api.ts`, which wraps the generated `@epam/chat-api-client` `AppConfigApi`. The provider MUST NOT call `fetch` directly or use `config.api.ts`.

One bootstrap load only. No automatic polling or refresh in this slice (reserved for future).

**RTL impact:** None. **i18n impact:** None.

#### Scenario: AbortController cancels in-flight request on unmount

- **WHEN** `AppConfigProvider` unmounts before the API call completes
- **THEN** the AbortController aborts the request
- **AND** no state update is performed after unmount (no React warning)

#### Scenario: Uses generated client, not base.ts

- **WHEN** the server-api wrapper `app-config.api.ts` is inspected
- **THEN** it imports from `@epam/chat-api-client` (or `../api-client.ts` which re-exports the configured instance)
- **AND** it does NOT import `get` from `./base`

---

### Requirement: useFeatureFlag hook returns false while loading or on error

The system SHALL export `useFeatureFlag(key: string): boolean` from `AppConfigContext.tsx`. It SHALL return `false` when `status` is `'loading'` or `'error'` — never `undefined`. It SHALL return the value from `features[key]` when `status='ready'`, defaulting to `false` if the key is absent.

**RTL impact:** None. **i18n impact:** None.

**Memoization:** `useFeatureFlag` is a derived value from context — no additional memoization needed beyond the `useMemo` on the context value.

#### Scenario: Returns false while loading

- **WHEN** `AppConfigProvider` is in `status='loading'`
- **THEN** `useFeatureFlag('features.asrEnabled')` returns `false`

#### Scenario: Returns true when feature enabled

- **WHEN** `AppConfigProvider` is in `status='ready'` and `features['features.asrEnabled']=true`
- **THEN** `useFeatureFlag('features.asrEnabled')` returns `true`

#### Scenario: Returns false for unknown key even when ready

- **WHEN** `AppConfigProvider` is in `status='ready'` and the key is not in the `features` map
- **THEN** `useFeatureFlag('features.unknownFlag')` returns `false`

---

### Requirement: AppConfigProvider is mounted before RequireAuth in main.tsx

`AppConfigProvider` SHALL be moved to wrap the router before `RequireAuth` in `apps/chat/src/main.tsx`. It SHALL appear after `ThemeProvider` but before `RequireAuth`, so config is available on the login page and in auth error boundaries.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Config loads before RequireAuth renders

- **WHEN** `main.tsx` renders
- **THEN** `AppConfigProvider` is an ancestor of `RequireAuth` in the component tree
- **AND** `useFeatureFlag` is callable from within the login page components without throwing

---

### Requirement: useAppConfig config fields remain backward-compatible for existing callers

Callers currently access `useAppConfig().asrModelId` and `useAppConfig().transcribeSizeLimitBytes`. After this change, these fields move to `useAppConfig().config.asrModelId` and `useAppConfig().config.transcribeSizeLimitBytes`. All callers in `apps/chat` SHALL be updated in the same PR.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Transcription component uses new config shape

- **WHEN** the transcription-related component reads the ASR model ID
- **THEN** it accesses `useAppConfig().config.asrModelId`, NOT `useAppConfig().asrModelId`

#### Scenario: No callers of the old flat shape remain

- **WHEN** `grep -r 'useAppConfig()\.asrModelId\|useAppConfig()\.transcribeSizeLimitBytes' apps/chat/src` is run
- **THEN** it returns no results

---

### Requirement: AppConfigContext exposes overlay eligibility fields

`AppConfigState.config` SHALL add `overlayEnabled: boolean` and `overlayAllowedOrigins: string[]`, populated from the corresponding `client-config-endpoint` response fields, with safe defaults (`overlayEnabled: false`, `overlayAllowedOrigins: []`) in both the initial (`loading`) and `error` states — no change to `AppConfigState.status`'s existing three-value shape or to any other existing field.

**RTL impact:** None. **i18n impact:** None. **Memoization:** Covered by the existing context-value `useMemo` — no additional memoization needed for these two fields.

#### Scenario: Defaults while loading

- **WHEN** `AppConfigProvider` mounts and the API call has not yet resolved
- **THEN** `useAppConfig().config.overlayEnabled` returns `false` and `useAppConfig().config.overlayAllowedOrigins` returns `[]`

#### Scenario: Populated on success

- **WHEN** the API call resolves with `config.overlayEnabled: true` and `config.overlayAllowedOrigins: ["https://partner.example.com"]`
- **THEN** `useAppConfig().config.overlayEnabled` returns `true` and `useAppConfig().config.overlayAllowedOrigins` returns `["https://partner.example.com"]`

#### Scenario: Defaults on error

- **WHEN** the API call rejects
- **THEN** `useAppConfig().config.overlayEnabled` returns `false` and `useAppConfig().config.overlayAllowedOrigins` returns `[]`, alongside the existing error-state defaults for the other config fields
