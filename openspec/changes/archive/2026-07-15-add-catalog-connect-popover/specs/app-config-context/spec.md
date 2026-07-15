## MODIFIED Requirements

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
