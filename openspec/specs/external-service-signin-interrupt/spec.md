# external-service-signin-interrupt Specification

## Purpose
TBD - created by archiving change interactive-external-service-login-chat. Update Purpose after archive.
## Requirements

### Requirement: `ClientChannelContext` parses `external-service/signin` events

`ClientChannelContext.tsx`'s SSE frame parser SHALL discriminate incoming RPC events by `method`. In addition to the existing `toolset/signin` handling, it SHALL parse `external-service/signin` events (`{ method: "external-service/signin", params: { url: string }, id: string }`) into a `PendingExternalServiceSigninEvent { kind: "external-service", id, appId, serviceName }` and store it in the same `Map<eventId, PendingEvent>` used for toolset events, keyed by the event's `id` (never by `appId`/`serviceName` alone). Both event kinds SHALL share the existing reconnect/backoff, dedup-by-id, and tab-wide-lifetime behavior already specified for `toolset/signin` — no separate subscription, map, or reconnect policy is introduced for this event kind.

Core's `params.url` is shaped `applications/{bucket}/{app}/external_services/{name}`, where `{name}` is a real, distinct identifier — it keys the application's own `external_services` map (`external-service-authentication`) and DIAL Core requires the *full* url as the sign-in/sign-out scope id (confirmed by Core rejecting a bare application id with `400 Invalid external service scope id`). `parseExternalServiceUrl` (`libs/chat-hooks/src/shared/external-services.ts`, imported from `@epam/ai-dial-chat-hooks` together with `buildExternalServiceScopeId`) SHALL split `params.url` into `appId` (everything before `/external_services/`, used to fetch the service metadata) and `serviceName` (everything after). If `params.url` contains no `/external_services/` segment, or either the `appId` or the `serviceName` part is empty, the event SHALL be ignored (dropped) rather than guessing a service name — this shape is required, not optional.

State: owned by the existing `ClientChannelContext`/`useClientChannel` — no new context/hook.

#### Scenario: External-service signin event parsed into the shared pending map
- **WHEN** an `external-service/signin` SSE frame with `id: "applications/public/finhub-via-openapi__1.0.0/1"` and `params.url: "applications/public/finhub-via-openapi__1.0.0/external_services/finhub-api2"` is received
- **THEN** a `PendingExternalServiceSigninEvent { kind: "external-service", id: "applications/public/finhub-via-openapi__1.0.0/1", appId: "applications/public/finhub-via-openapi__1.0.0", serviceName: "finhub-api2" }` is added to the pending map alongside any existing `toolset/signin` entries

#### Scenario: Event with no /external_services/ segment is ignored
- **WHEN** an `external-service/signin` event's `params.url` contains no `/external_services/` segment
- **THEN** the event is dropped and not added to the pending map

#### Scenario: Event with an empty appId or serviceName is ignored
- **WHEN** an `external-service/signin` event's `params.url` has nothing before or nothing after `/external_services/`
- **THEN** the event is dropped and not added to the pending map

#### Scenario: Duplicate external-service event id is deduplicated
- **WHEN** an `external-service/signin` event with an `id` already present in the pending map is received again
- **THEN** no duplicate entry is added

#### Scenario: Mixed event kinds coexist
- **WHEN** the pending map already contains a `toolset/signin` entry and a new `external-service/signin` event arrives
- **THEN** both entries are retained simultaneously, each addressable by its own `id`

### Requirement: Metadata resolution via the dedicated external-service endpoint, keyed by appId+serviceName

For each pending `external-service/signin` event, the dialog SHALL resolve display metadata by calling `GET /api/v1/external-services/{appId}/{serviceName}` (per `external-service-authentication`'s dedicated `getExternalService` endpoint) using the event's `appId` and `serviceName` as separate path segments. Core's application resource (`getApplication`) does not expose an `external_services` map, so this dedicated per-service endpoint is the only metadata source — there is no shared per-application fetch. This fetch SHALL be deduplicated per `appId`+`serviceName` pair (the composite key built by `buildExternalServiceScopeId`), so two pending events for the same pair share one in-flight request, but distinct `serviceName`s under the same `appId` each require their own request. While metadata is loading or if the lookup fails, the row SHALL render a fallback label equal to the percent-decoded `serviceName` (`getExternalServiceFallbackName` from `@epam/ai-dial-chat-hooks`; the raw `serviceName` if decoding fails) rather than blocking the dialog from rendering. The fallback label is not translated and uses no i18n key.

#### Scenario: Metadata resolved successfully
- **WHEN** a pending event's `GET /api/v1/external-services/{appId}/{serviceName}` call succeeds
- **THEN** the row shows the response's `displayName`

#### Scenario: Metadata lookup fails or is still loading
- **WHEN** the metadata lookup for a pending event has not completed or returns an error (e.g. `404`)
- **THEN** the row shows the percent-decoded `serviceName` as its label instead of blocking rendering

#### Scenario: Distinct services under the same application each fetch independently
- **WHEN** two pending events share the same `appId` but target different `serviceName`s
- **THEN** two separate `GET /api/v1/external-services/{appId}/{serviceName}` requests are made, one per `serviceName`, and each row resolves its own response

### Requirement: Global sign-in dialog renders both toolset and external-service rows

The existing global, non-dismissible sign-in dialog (renamed `SigninInterruptDialog`, `apps/chat/src/components/SigninInterruptDialog/SigninInterruptDialog.tsx`, formerly `ToolsetSigninDialog`) SHALL render pending `external-service/signin` events as rows in the same list as pending `toolset/signin` events, using the same non-dismissible modal, `Decline all`, per-row `aria-busy`/disabled-while-processing, and shared `aria-live="polite"` status region already specified for the toolset case. Each external-service row SHALL branch on the resolved `authenticationType` (`RowAuthType` in `apps/chat/src/types/signin-interrupt.ts`: `NONE`, `API_KEY`, `OAUTH`, `DIAL_NATIVE`): `API_KEY` SHALL show an inline password-type key field, and `Log in` stays disabled until the trimmed key is non-empty; `OAUTH` SHALL invoke the login action directly (synchronous popup open); `DIAL_NATIVE` SHALL show an informational hint (`ToolsetSigninI18nKeys.DialNativeHint`) and a `Log in` action that uses the platform's offline credentials. A resolved `authenticationType` of `NONE` SHALL render the row as non-actionable with an informational label and SHALL auto-report `success` for that event without user interaction, since Core is not expected to pause on a service requiring no credentials.

When at least one pending row resolves to `API_KEY` or `OAUTH`, the dialog SHALL show an offline-usage-consent `Checkbox` (`ToolsetSigninI18nKeys.OfflineUsageConsent`, caption `OfflineUsageConsentHint`), checked by default; its value is passed as `offlineUsageConsent` to every login started from the dialog. The `Decline all` footer action SHALL appear only when more than one event is pending.

i18n keys: there is no `externalServiceSignin` namespace — external-service rows reuse the `toolsetSignin` keys (`ToolsetSigninI18nKeys.RowDecline`, `ApiKeyPlaceholder`, `ApiKeyLabel`, `NoCredentialsRequired`, `DialNativeHint`, `AdminConsentRequired`, `OfflineUnavailable`, `OfflineUsageConsent`, `OfflineUsageConsentHint`, `DeclineAll`) and `ButtonsI18nKeys.LogIn` for the `Log in` button.

RTL: dialog and row layout reuse the existing logical-Tailwind-utility layout already specified for `ToolsetSigninDialog`; no new directional icons are introduced.

Accessibility: reuses the existing dialog's `role="dialog"` + `aria-modal="true"` + `aria-labelledby`, focus trap via `inert` on background content, and per-row `aria-busy` — no new accessibility pattern is introduced for the added row kind.

Mobile/desktop: reuses the existing dialog's responsive layout (`useBreakpoint`/`useIsMobile`-driven where the dialog itself branches, otherwise delegated to the shared modal component) — no separate mobile layout for external-service rows.

Memoization: per-row resolved metadata and disabled state SHALL be memoized with `useMemo`/`useCallback`, consistent with the existing toolset row requirement, to avoid re-rendering unrelated rows when the pending map changes.

#### Scenario: Dialog lists an external-service event
- **WHEN** the first `external-service/signin` event is received while `liveChatInteraction` is enabled
- **THEN** the global dialog renders that event as a row with `Log in`/`Decline` actions appropriate to its resolved `authenticationType`

#### Scenario: API key row
- **WHEN** a pending external-service event resolves to `authenticationType: "API_KEY"`
- **THEN** the row shows an inline API key input and a `Log in` submit action

#### Scenario: OAuth row
- **WHEN** a pending external-service event resolves to `authenticationType: "OAUTH"`
- **THEN** clicking `Log in` opens the OAuth popup directly, without an intermediate input step

#### Scenario: DIAL-native row
- **WHEN** a pending external-service event resolves to `authenticationType: "DIAL_NATIVE"`
- **THEN** the row shows the DIAL-native hint and a `Log in` action without an API key input

#### Scenario: No-credentials-required row auto-resolves
- **WHEN** a pending external-service event resolves to `authenticationType: "NONE"`
- **THEN** the row renders as non-actionable and the dialog reports `success` for that event's id without requiring user interaction

#### Scenario: Mixed rows in one dialog
- **WHEN** the dialog has one pending `toolset/signin` row and one pending `external-service/signin` row simultaneously
- **THEN** both rows render in the same non-dismissible modal and are independently actionable

### Requirement: Shared login controller drives external-service sign-in

`useExternalServiceLogin` (`apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts`) SHALL drive external-service `Log in` actions. It is a standalone hook — the external-service counterpart of `useToolsetLogin`, not a wrapper over an extracted shared controller — built from the shared OAuth primitives in `@epam/ai-dial-chat-hooks` (`openToolsetOAuthPopup`, `navigateToolsetOAuthPopup`, `waitForToolsetOAuthResult`, with `buildExternalServiceScopeId` as the client-side correlation id) and calling `signInExternalService`/`signOutExternalService`/`getExternalService`. Its `login(params)` returns an `ExternalServiceLoginOutcomeType` (`Success`, `Failure`, `PopupBlocked`, `Cancelled`, `AdminConsentRequired`, `OfflineUnavailable`) and branches on `authenticationType`:

- `OAUTH` — opens the popup synchronously, pre-logs-out the level when `forceStale` is set (the dialog always passes `forceStale: true`, since a Core-pushed `external-service/signin` event is proof the Core-side credentials may be stale), runs the popup/`BroadcastChannel` handshake, and on a `Cancelled` result re-verifies via a fresh `getExternalService` fetch (`userLevelAuthStatus` or `globalAuthStatus` equal to `SIGNED_IN` counts as success).
- `API_KEY` — pre-logs-out when `forceStale` is set, then calls `signInExternalService` with the trimmed key and `offlineUsageConsent`.
- `DIAL_NATIVE` — reserves the popup, requires the service's `appLevelAuthStatus` to be `SIGNED_IN` (`SIGNED_OUT` gives `AdminConsentRequired`), then uses the platform offline credentials (`getOfflineCredentials` / `useOfflineCredentialsLogin`): already connected gives `Success`, unavailable gives `OfflineUnavailable`, otherwise it connects through the popup and re-checks `appLevelAuthStatus`.

The hook itself does not report to the client channel. `SigninInterruptDialog` SHALL report `{ id: eventId, result: 'success' }` via `POST /api/v1/client-channel/report` after a `Success` outcome (also reporting success for sibling pending events on the same resource and credentials level), and `{ id: eventId, result: 'denied' }` on decline. Any other outcome SHALL leave the event pending with a recoverable row-level error (`ErrorPopupBlocked`, `ErrorLoginFailed`, `AdminConsentRequired`, or `OfflineUnavailable`); a `Cancelled` outcome returns the row to idle without an error.

#### Scenario: API key login for an external-service event
- **WHEN** the user submits a non-empty API key for a pending external-service event
- **THEN** `useExternalServiceLogin` calls `signInExternalService`, and only on success does the dialog report `success` for that event's id

#### Scenario: API key login fails
- **WHEN** the `signInExternalService` call fails
- **THEN** the event remains pending, a recoverable inline error is shown on that row, and no `report` is sent

#### Scenario: OAuth login succeeds
- **WHEN** the popup reports a `Success` result on its `BroadcastChannel` for an external-service login
- **THEN** the dialog reports `{ id: eventId, result: 'success' }` on the client channel

#### Scenario: Popup closed without a result
- **WHEN** the user closes the OAuth popup before any message is posted
- **THEN** `useExternalServiceLogin` re-verifies the real external-service auth status before deciding whether to report success or leave the event pending

#### Scenario: Decline reports denied
- **WHEN** the user clicks `Decline` on a pending external-service event and the report call succeeds
- **THEN** that event is removed from the dialog; other pending events (of either kind) are unaffected

#### Scenario: DIAL-native login without admin consent
- **WHEN** the user clicks `Log in` on a `DIAL_NATIVE` row and the service's `appLevelAuthStatus` is `SIGNED_OUT`
- **THEN** the event stays pending and the row shows the `AdminConsentRequired` error

### Requirement: Feature flag reuse — no new flag for external-service events

External-service sign-in events SHALL be gated by the same `liveChatInteraction` feature flag already gating `toolset/signin` handling — no new flag key is introduced. When the flag is `false`, the dialog SHALL NOT render external-service rows and no BFF metadata/signin/signout calls SHALL be made, exactly mirroring the existing flag-disabled behavior for toolset events. In addition, the dialog renders only when the `OverlayFeature.LiveChatInteraction` UI feature is also enabled, and `ClientChannelProvider` keeps the channel active only on `/conversations/*` and the `ROUTES.AppsEditor` route (the two pages that stream completions).

#### Scenario: Flag disabled suppresses external-service handling
- **WHEN** `liveChatInteraction` resolves to `false`
- **THEN** no external-service metadata lookup, sign-in, or sign-out call is made, and no external-service row is rendered even if an event was received before the flag flipped

#### Scenario: UI feature disabled hides the dialog
- **WHEN** `liveChatInteraction` is `true` but `OverlayFeature.LiveChatInteraction` is not enabled
- **THEN** the dialog renders nothing, even with pending events
