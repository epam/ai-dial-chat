# app-config-context Specification

## Purpose

The frontend `AppConfigContext`: loading, ready, and error states for client configuration, and the feature-flag, overlay, and announcement fields it exposes.

## Requirements

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

---

### Requirement: AppConfigContext exposes the announcement message

`AppConfigState.config` SHALL include an `announcementHtml: string | null` field. The initial (loading) value SHALL be `null`. On a successful `GET /api/v1/client-config` response, `config.announcementHtml` SHALL be populated from the response's `config.announcementHtml` field. On error, or when the backend omits the field, `config.announcementHtml` SHALL retain the `null` default.

#### Scenario: announcementHtml is null before config loads

- **WHEN** `AppConfigProvider` has mounted but the API call has not resolved
- **THEN** `useAppConfig().config.announcementHtml` returns `null`

#### Scenario: announcementHtml is populated from a successful response

- **WHEN** the API call resolves with `config.announcementHtml: "Welcome to DIAL!"`
- **THEN** `useAppConfig().config.announcementHtml` returns `"Welcome to DIAL!"`

#### Scenario: announcementHtml stays null when the backend omits it or the call fails

- **WHEN** the response omits `config.announcementHtml`, or the API call rejects
- **THEN** `useAppConfig().config.announcementHtml` returns `null`

---

### Requirement: AppConfigContext exposes customVisualizers

`AppConfigContext` (`apps/chat/src/context/AppConfigContext.tsx`) SHALL surface the parsed `customVisualizers: CustomVisualizer[]` field from the `/api/v1/config` response to client consumers.

Behaviour:

- The field SHALL be readable via the existing `useAppConfig()` accessor and via a dedicated `useCustomVisualizers()` hook exported from `apps/chat/src/hooks/attachment/useCustomVisualizers.ts` (see the `custom-visualizers` capability).
- While the config request is loading OR on error, both accessors SHALL return `[]`.
- The returned array reference SHALL remain stable across renders as long as the underlying config has not changed (memoise the parse result).
- The type imported by the app SHALL be the same `CustomVisualizer` type exported from `@epam/ai-dial-chat-shared`.

Libs SHALL NOT read `AppConfigContext` for the registry — the app resolves the registry and passes concrete `VisualizerCanvasContent` values into libs.

**Feature flag:** none. The empty-array default keeps the field dark.

**RTL impact:** none.

**i18n impact:** none.

#### Scenario: customVisualizers is exposed when config is ready

- **WHEN** `AppConfigProvider` has fetched a config with `customVisualizers: [{ contentType: 'application/x-my-viz', url: 'https://viz.example.com' }]`
- **THEN** `useAppConfig().customVisualizers` returns that same array
- **AND** `useCustomVisualizers()` returns the same array (identical reference)

#### Scenario: customVisualizers defaults to empty during loading and on error

- **WHEN** the config request is in flight
- **THEN** both `useAppConfig().customVisualizers` and `useCustomVisualizers()` return `[]`
- **AND** the same holds after the request rejects

---

### Requirement: AppConfigContext exposes the announcement title and description

`AppConfigState.config` SHALL include `announcementTitle: string | null` and `announcementDescription: string | null`.

The initial (loading) value of each SHALL be `null`. On a successful `GET /api/v1/client-config` response, each SHALL be populated from the response's `config.announcementTitle` and `config.announcementDescription` fields. On error, or when the backend omits a field, each SHALL retain the `null` default.

The context SHALL NOT re-sanitize or otherwise transform these values — it surfaces what the backend returned, and the banner component applies its own client-side sanitization pass (see the `announcement-banner` capability).

#### Scenario: Announcement fields are null before config loads

- **WHEN** `AppConfigProvider` has mounted but the API call has not resolved
- **THEN** `useAppConfig().config.announcementTitle` returns `null` and `.announcementDescription` returns `null`

#### Scenario: Announcement fields are populated from a successful response

- **WHEN** the API call resolves with `config.announcementTitle: "🎉 Welcome to DIAL! 🎉"` and `config.announcementDescription: "Explore our AI offerings with your data."`
- **THEN** `useAppConfig().config` exposes those exact values

#### Scenario: Announcement fields stay null when the backend omits them or the call fails

- **WHEN** the response omits both fields, or the API call rejects
- **THEN** `useAppConfig().config.announcementTitle` returns `null` and `.announcementDescription` returns `null`

#### Scenario: One field populated, the other absent

- **WHEN** the response carries `config.announcementTitle` but omits `config.announcementDescription`
- **THEN** `useAppConfig().config.announcementTitle` returns the response value and `.announcementDescription` returns `null`

---

### Requirement: AppConfigContext exposes the announcements list

`AppConfigState.config` SHALL include an `announcements: AnnouncementItem[]` field.

The initial (loading) value SHALL be `[]`. On a successful `GET /api/v1/client-config` response, it SHALL be populated from the response's `config.announcements` field. On error, or when the backend omits the field, it SHALL retain the `[]` default. A `null` or non-array value SHALL be normalized to `[]`.

The returned array reference SHALL remain stable across renders as long as the underlying config has not changed. The context SHALL NOT re-validate, re-sanitize, or re-order entries — the backend is the authority on which entries are safe to render.

#### Scenario: Announcements default to an empty array before config loads

- **WHEN** `AppConfigProvider` has mounted but the API call has not resolved
- **THEN** `useAppConfig().config.announcements` returns `[]`

#### Scenario: Announcements are populated from a successful response

- **WHEN** the API call resolves with an entry in `config.announcements`
- **THEN** `useAppConfig().config.announcements` returns that entry

#### Scenario: Announcements stay empty when the backend omits them or the call fails

- **WHEN** the response omits `config.announcements`, or the API call rejects
- **THEN** `useAppConfig().config.announcements` returns `[]`

#### Scenario: A non-array announcements value is normalized

- **WHEN** the response carries `config.announcements: null`
- **THEN** `useAppConfig().config.announcements` returns `[]` rather than `null`

#### Scenario: The announcements array reference is stable across renders

- **WHEN** a consumer re-renders without the underlying config changing
- **THEN** `useAppConfig().config.announcements` returns the same array reference as the previous render
