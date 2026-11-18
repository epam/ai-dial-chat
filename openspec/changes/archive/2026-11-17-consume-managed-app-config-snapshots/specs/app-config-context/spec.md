## MODIFIED Requirements

### Requirement: AppConfigProvider uses async/await with AbortController

The provider SHALL fetch config using `async`/`await` with an `AbortController` inside `useEffect`. A `cancelled` flag SHALL prevent `setState` after unmount. The pattern MUST follow `useFavicon.ts`.

The provider SHALL call the `getClientConfig(signal?)` wrapper from `apps/chat/src/server-api/app-config.api.ts`, which passes `{ appId: 'chat-ui' }` to the generated `@epam/ai-dial-chat-api-client` `AppConfigApi`. The provider MUST NOT call `fetch` directly or use `config.api.ts`.

The load SHALL be gated on authentication status: while `useUser().status` is `AuthStatus.Loading` the provider SHALL not issue a request, and it SHALL re-run the load whenever that status settles or changes, so the config reflects the signed-in user rather than a pre-auth response. `AppConfigProvider` therefore SHALL be mounted inside `UserProvider`.

When a successful response carries `metadata.nextRefreshAt`, the provider SHALL also re-fetch:

- when the document becomes visible;
- when the window gains focus;
- on `pageshow` with `persisted` (resume from the back-forward cache);
- on `online`;
- while the document is visible, after the response's `nextRefreshAt` minus its `resolvedAt` (both server time, so a wrong browser clock does not matter), measured from the moment the response was accepted, with the delay clamped to between 15 seconds and 15 minutes. Every accepted response SHALL re-arm this timer, even when it repeats the previous hint.

Triggers less than 15 seconds after the last started load SHALL be coalesced. While an identity load is in flight, no background refresh SHALL start, so that load alone decides what the new identity sees. A hidden document SHALL schedule no timed refresh. When the last accepted response has no `nextRefreshAt` (managed mode `off`, or an older backend), the only re-fetch trigger SHALL remain a change in authentication status. The refresh triggers SHALL live in an app-level hook in `apps/chat/src/hooks/`, not in a library.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: AbortController cancels in-flight request on unmount

- **WHEN** `AppConfigProvider` unmounts before the API call completes
- **THEN** the AbortController aborts the request
- **AND** no state update is performed after unmount (no React warning)

#### Scenario: Uses generated client, not base.ts

- **WHEN** the server-api wrapper `app-config.api.ts` is inspected
- **THEN** it uses the configured generated-client instance from `./api-client` and types from `@epam/ai-dial-chat-api-client`
- **AND** it does NOT import `get` from `./base`

#### Scenario: No request is issued while authentication is still resolving

- **WHEN** `AppConfigProvider` mounts while `useUser().status` is `AuthStatus.Loading`
- **THEN** no client-config request is issued and `status` stays `Loading`

#### Scenario: Authentication settling triggers the load

- **WHEN** the authentication status changes away from `AuthStatus.Loading`
- **THEN** the provider issues the client-config request, aborting any request left in flight from a previous status

---

#### Scenario: Visible tab refreshes at the hinted time

- **WHEN** a response carries `nextRefreshAt` 120 s in the future and the tab stays visible
- **THEN** exactly one new client-config request starts at that time

#### Scenario: Hidden tab does not poll

- **WHEN** the tab is hidden before `nextRefreshAt`
- **THEN** no request starts while it stays hidden, and one starts when it becomes visible again

#### Scenario: Focus and resume refresh

- **WHEN** the window regains focus, or the page is restored with `pageshow` `persisted`, at least 15 s after the last load started
- **THEN** a new client-config request starts

#### Scenario: Bursts are coalesced

- **WHEN** `visibilitychange`, `focus` and `online` fire within one second
- **THEN** a single request starts

#### Scenario: No hint keeps today's behavior

- **WHEN** the accepted response has no `metadata.nextRefreshAt`
- **THEN** visibility, focus, resume and time trigger no request

## ADDED Requirements

### Requirement: Background refresh keeps the ready state and rejects stale results

`AppConfigProvider` SHALL own the refresh state. Each load SHALL record a sequence number and the identity at its start. A newer load or an identity change SHALL abort the previous in-flight request. A result SHALL be applied only when its sequence number is the latest and the identity is unchanged.

A refresh started while `status` is `Ready` SHALL keep `status` `Ready` while it runs. It SHALL NOT reset `catalogCreationStatus` or `catalogCreationPermissions` unless the identity changed. A failed refresh SHALL keep the last accepted values and `status` `Ready`. A successful refresh SHALL replace the values atomically in one state update.

The context value SHALL stay memoized (`useMemo`). Fields a refresh returns unchanged SHALL keep their previous references, so consumers that compare a field by reference (memoized values, effect dependencies) see no change. Consumers of the whole context still re-render after every accepted refresh.

**Accessibility:** No new UI. Refreshed values reach existing components without focus changes. **RTL impact:** None. **i18n impact:** None. **Feature flag:** Not gated.

#### Scenario: Identity change discards an older result

- **WHEN** a refresh for user A is in flight and the user switches to B
- **THEN** A's request is aborted, its late result is ignored, and only B's response is applied

#### Scenario: Out-of-order responses

- **WHEN** refresh 1 and refresh 2 are started, and 2 resolves before 1
- **THEN** the values from 2 are kept, and the late result of 1 is ignored

#### Scenario: Failed refresh keeps features on

- **WHEN** `features.usageLimitsControl` is `true` in the accepted response and the next refresh fails with a network error
- **THEN** `status` stays `Ready` and `useFeatureFlag('usageLimitsControl')` stays `true`

#### Scenario: Identity reload is not superseded

- **WHEN** the identity changes, its load is still in flight after 15 seconds, and the window gains focus
- **THEN** no background refresh starts, and only the identity load's result is applied

#### Scenario: Refresh does not flicker

- **WHEN** a background refresh starts
- **THEN** `status` never becomes `Loading`, and `catalogCreationStatus` stays `Ready` for the same identity
