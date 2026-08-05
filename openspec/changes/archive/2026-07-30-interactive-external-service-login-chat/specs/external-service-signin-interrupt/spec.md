## ADDED Requirements

### Requirement: `ClientChannelContext` parses `external-service/signin` events

`ClientChannelContext.tsx`'s SSE frame parser SHALL discriminate incoming RPC events by `method`. In addition to the existing `toolset/signin` handling, it SHALL parse `external-service/signin` events (`{ method: "external-service/signin", params: { url: string }, id: string }`) into a `PendingExternalServiceSigninEvent` and store it in the same `Map<eventId, PendingEvent>` used for toolset events, keyed by the event's `id` (never by `url` alone). Both event kinds SHALL share the existing reconnect/backoff, dedup-by-id, and tab-wide-lifetime behavior already specified for `toolset/signin` — no separate subscription, map, or reconnect policy is introduced for this event kind.

State: owned by the existing `ClientChannelContext`/`useClientChannel` — no new context/hook.

#### Scenario: External-service signin event parsed into the shared pending map
- **WHEN** an `external-service/signin` SSE frame with `id: "applications/public/finhub-via-openapi__1.0.0/1"` and `params.url: "applications/public/finhub-via-openapi__1.0.0/external_services/finhub-api2"` is received
- **THEN** a `PendingExternalServiceSigninEvent` keyed by that `id` is added to the pending map alongside any existing `toolset/signin` entries

#### Scenario: Duplicate external-service event id is deduplicated
- **WHEN** an `external-service/signin` event with an `id` already present in the pending map is received again
- **THEN** no duplicate entry is added

#### Scenario: Mixed event kinds coexist
- **WHEN** the pending map already contains a `toolset/signin` entry and a new `external-service/signin` event arrives
- **THEN** both entries are retained simultaneously, each addressable by its own `id`

### Requirement: Metadata resolution via the BFF external-services endpoint

For each pending `external-service/signin` event, the dialog SHALL resolve display metadata by calling `GET /api/v1/external-services/:appId/:serviceId` (parsed and forwarded by the BFF per `external-service-authentication`), never by parsing `params.url` itself or embedding any DIAL Core path convention in `apps/chat` beyond passing the raw `url` value through. While metadata is loading or if the lookup fails, the row SHALL render a fallback label derived from the event's `serviceId` portion of `params.url` rather than blocking the dialog from rendering.

i18n keys: `externalServiceSignin.fallbackName`.

#### Scenario: Metadata resolved successfully
- **WHEN** a pending event's metadata lookup succeeds
- **THEN** the row shows the resolved `displayName` and, if present, `description`

#### Scenario: Metadata lookup fails or is still loading
- **WHEN** the metadata lookup for a pending event has not completed or returns an error
- **THEN** the row shows a fallback label derived from the service id instead of blocking rendering

### Requirement: Global sign-in dialog renders both toolset and external-service rows

The existing global, non-dismissible sign-in dialog (renamed `SigninInterruptDialog`, `apps/chat/src/components/SigninInterruptDialog/SigninInterruptDialog.tsx`, formerly `ToolsetSigninDialog`) SHALL render pending `external-service/signin` events as rows in the same list as pending `toolset/signin` events, using the same non-dismissible modal, `Decline all`, per-row `aria-busy`/disabled-while-processing, and shared `aria-live="polite"` status region already specified for the toolset case. Each external-service row SHALL branch its `Log in` action on the resolved `authenticationType`: `API_KEY` SHALL show an inline key field; `OAUTH` SHALL invoke the login action directly (synchronous popup open). A resolved `authenticationType` of `NONE` SHALL render the row as non-actionable with an informational label and SHALL auto-report `success` for that event without user interaction, since Core is not expected to pause on a service requiring no credentials.

i18n keys: `externalServiceSignin.rowLogin` (or reuse `toolsetSignin.rowLogin`/`ButtonsI18nKeys.LogIn` where wording is identical), `externalServiceSignin.rowDecline`, `externalServiceSignin.apiKeyPlaceholder`, `externalServiceSignin.noCredentialsRequired`.

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

#### Scenario: No-credentials-required row auto-resolves
- **WHEN** a pending external-service event resolves to `authenticationType: "NONE"`
- **THEN** the row renders as non-actionable and the dialog reports `success` for that event's id without requiring user interaction

#### Scenario: Mixed rows in one dialog
- **WHEN** the dialog has one pending `toolset/signin` row and one pending `external-service/signin` row simultaneously
- **THEN** both rows render in the same non-dismissible modal and are independently actionable

### Requirement: Shared login controller drives external-service sign-in

A generalized login controller (extracted from `useToolsetLogin.ts` into a shared parameterized hook, plus a thin `useExternalServiceLogin` wrapper supplying `signInExternalService`/`signOutExternalService` as its BFF calls) SHALL drive external-service `Log in` actions. It SHALL reuse, unchanged: the OAuth popup/`state`/`BroadcastChannel` handshake, the `Cancelled`-result re-verification-via-fresh-metadata-fetch behavior, and the `forceStale`-style pre-logout-then-login semantics (a Core-pushed `external-service/signin` event is proof the Core-side credentials are invalid even if any locally cached status disagrees). After a successful login, the controller SHALL report `{ id: eventId, result: 'success' }` via the existing `POST /api/v1/client-channel/report`; after a successful decline, `{ id: eventId, result: 'denied' }`. A failed login or decline SHALL leave the event pending with a recoverable row-level error, exactly as specified for `toolset-signin-interrupt`.

#### Scenario: API key login for an external-service event
- **WHEN** the user submits a non-empty API key for a pending external-service event
- **THEN** the controller calls `signInExternalService`, and only on success reports `success` for that event's id

#### Scenario: API key login fails
- **WHEN** the `signInExternalService` call fails
- **THEN** the event remains pending, a recoverable inline error is shown on that row, and no `report` is sent

#### Scenario: OAuth login succeeds
- **WHEN** the popup reports a `Success` result on its `BroadcastChannel` for an external-service login
- **THEN** the controller reports `{ id: eventId, result: 'success' }` on the client channel

#### Scenario: Popup closed without a result
- **WHEN** the user closes the OAuth popup before any message is posted
- **THEN** the controller re-verifies the real external-service auth status before deciding whether to report success or leave the event pending

#### Scenario: Decline reports denied
- **WHEN** the user clicks `Decline` on a pending external-service event and the report call succeeds
- **THEN** that event is removed from the dialog; other pending events (of either kind) are unaffected

### Requirement: Feature flag reuse — no new flag for external-service events

External-service sign-in events SHALL be gated by the same `liveChatInteraction` feature flag already gating `toolset/signin` handling — no new flag key is introduced. When the flag is `false`, the dialog SHALL NOT render external-service rows and no BFF metadata/signin/signout calls SHALL be made, exactly mirroring the existing flag-disabled behavior for toolset events.

#### Scenario: Flag disabled suppresses external-service handling
- **WHEN** `liveChatInteraction` resolves to `false`
- **THEN** no external-service metadata lookup, sign-in, or sign-out call is made, and no external-service row is rendered even if an event was received before the flag flipped
