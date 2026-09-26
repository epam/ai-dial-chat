## Purpose

Proactive, app-owned authentication forms for application external services in Catalog details and the Quick app host dialog, with shared login behavior and a host-independent Catalog render slot.

## ADDED Requirements

### Requirement: Application details expose proactive credential forms

`CatalogView` SHALL supply the app-owned `ApplicationCredentials` surface for `CatalogEntityType.Agent` details when both the caller's `liveChatInteraction` backend capability and `OverlayFeature.LiveChatInteraction` UI setting are enabled. Backend capability SHALL use the existing `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` resolution, with no additional administrator requirement or new feature key. Model and toolset items SHALL not use this surface; existing toolset controls remain unchanged.

The forms SHALL be usable before any conversation completion or client-channel subscription. They SHALL display one independent row for every external service with `API_KEY`, `OAUTH` or `DIAL_NATIVE` authentication, identified by its display name or service id. `NONE` services SHALL be omitted. Loading SHALL have a status message, failed metadata loading SHALL offer a retry action, and an application without authenticated services SHALL render no credential section in Catalog. The shared component's `showEmptyState` option SHALL instead render the existing no-credentials-required message when used in Quick app Settings.

#### Scenario: Multiple services can be configured before starting chat

- **WHEN** an enabled application details panel opens with API-key and OAuth services
- **THEN** each service has its own credential row and current status
- **AND** no completion, client-channel subscription or interrupt report is needed

#### Scenario: No-auth services do not produce forms

- **WHEN** the application contains only `NONE` services or no external services
- **THEN** Catalog renders no credential section
- **AND** an editor dialog using `showEmptyState` renders the no-credentials-required message

#### Scenario: A disabled gate prevents credential loading from Catalog

- **WHEN** either backend capability or the overlay UI setting is disabled
- **THEN** `CatalogView` does not mount the application credential forms

### Requirement: Credential state belongs to the host application

`useApplicationCredentials(appId)` SHALL own the service list, loading/error state, offline connection state and a memoized `refresh`. It SHALL use `apps/chat/src/server-api/external-services.ts` to call the normal generated `listExternalServices` operation defined by `external-service-authentication`. It SHALL additionally query `getOfflineCredentials` only when at least one service is DIAL-native. An offline-status failure SHALL use the same load-error/retry state.

The hook SHALL fetch on mount and application change, and after a successful login or logout. Responses from older requests or unmounted/previous application instances SHALL not overwrite current state or initiate refresh for the old application. No shared client or BFF cache is introduced; state lives only for the mounted surface, and opening it again loads fresh data.

Each `ApplicationCredentialRow` SHALL own its API-key draft, initially unchecked offline-use consent, processing/error state and logout confirmation. Rows SHALL be keyed by both application and service id. A status refresh after another row's mutation SHALL preserve the existing rows and their unsent drafts. A successful login SHALL clear the submitted API-key draft. Closing the surface or switching applications SHALL discard its drafts; no credential SHALL be persisted locally or sent to the editor iframe.

#### Scenario: Older responses cannot show another application's services

- **WHEN** a user switches from application A to B before A's listing resolves
- **THEN** only B's services and statuses are displayed, regardless of response order

#### Scenario: A service mutation preserves another service's draft

- **WHEN** the user has an unsent key in service A and signs in to service B
- **THEN** refreshing B's status preserves A's draft while the request is pending and after it resolves

#### Scenario: Loading can be retried

- **WHEN** a listing or required offline-status request fails and the user selects Retry
- **THEN** the hook performs fresh reads and replaces the error state with the available forms on success

### Requirement: API-key and OAuth forms manage personal credentials

API-key rows SHALL expose a labelled password input while the user is signed out and SHALL disable login for an empty/whitespace-only key. OAuth rows SHALL invoke the existing popup flow. Both SHALL use `useExternalServiceLogin` with `credentialsLevel: USER`, the listed service's authentication type and public OAuth settings, and the user's explicit `offlineUsageConsent`. The consent checkbox SHALL start unchecked; the UI SHALL not infer consent from the application type or shared credentials. `forceStale` SHALL be true only when the current USER status is `FAILED`.

Rows SHALL show personal signed-in status only when `userLevelAuthStatus` is `SIGNED_IN`. If personal status is not signed in but GLOBAL or APPLICATION status is signed in, they SHALL display shared-credentials information while still allowing personal login. Login failures and blocked popups SHALL produce a localized, recoverable row error; cancellation SHALL not be treated as success. Successful login SHALL refresh service statuses.

Only a personally signed-in non-native row SHALL expose logout. The first action SHALL request confirmation with an option to cancel; confirmation SHALL call `signOutExternalService` for `USER` only and refresh statuses. It SHALL not revoke GLOBAL or APPLICATION credentials. A row SHALL prevent duplicate operations while processing and preserve a recoverable error on failure.

#### Scenario: API-key login includes only the selected consent

- **WHEN** the user enters a key and signs in without selecting offline-use consent
- **THEN** login targets that application's service at USER level with `offlineUsageConsent: false`
- **AND** after success the submitted draft is cleared and status is refreshed

#### Scenario: OAuth popup is blocked

- **WHEN** the shared OAuth login flow reports a blocked popup
- **THEN** the row shows the existing localized popup-blocked error and remains available for retry

#### Scenario: Personal logout requires confirmation

- **WHEN** the user first selects Log out
- **THEN** no sign-out request is sent until confirmation
- **AND** cancellation leaves the credentials unchanged

#### Scenario: Shared credentials survive personal logout

- **WHEN** the user confirms logout while both USER and GLOBAL or APPLICATION credentials exist
- **THEN** only USER credentials are revoked
- **AND** refreshed shared status is displayed without offering revocation of shared credentials

### Requirement: DIAL-native rows reuse offline credentials without managing administrator consent

DIAL-native rows SHALL show signed in only when the fresh offline connection is connected and the service reports `appLevelAuthStatus: SIGNED_IN`. Their login action SHALL reuse `useExternalServiceLogin` and the existing offline OAuth/administrator-consent checks. They SHALL not show an API-key field, per-service offline-use checkbox or logout action. They SHALL not invoke per-service signin/signout or revoke the user's platform offline credentials. Missing administrator consent or unavailable offline access SHALL produce the existing localized error outcome.

#### Scenario: Connected offline credentials and application consent satisfy a native service

- **WHEN** offline status is connected and the native service's application consent is signed in
- **THEN** the row shows signed in and has no login or logout action

#### Scenario: Administrator consent cannot be granted from the user form

- **WHEN** the native login hook reports that administrator consent is required
- **THEN** the row displays the administrator-consent message without performing per-service credential mutation

### Requirement: Catalog accepts credential content without owning host authentication

`CatalogProps` and `DetailsPanelProps` SHALL expose an optional `renderCredentials?: (item: CatalogItem) => ReactNode`. `Catalog` SHALL forward it to `DetailsPanel`, which SHALL invoke it below the header only in the open, editable, normal item-details view. It SHALL not invoke it in read-only mode, while closed, or in alternate detail subviews. Omitting it SHALL preserve existing behavior.

The host's memoized callback SHALL decide which items and feature settings qualify and render the app-owned forms keyed by application id. `libs/catalog` SHALL not import or configure API clients, server-api modules, session/auth providers, feature flags, routing, persistence, telemetry or iframe contracts for this slot. It SHALL accept the supplied content without inspecting application external-service DTOs. The generated-client exception remains limited to `libs/chat-api-client`; its artifacts SHALL be generated from backend Swagger sources.

#### Scenario: The host supplies credential content

- **WHEN** an editable normal details view is open and `renderCredentials` is supplied
- **THEN** the library renders the callback's result below the header
- **AND** all data loading and authentication behavior remain owned by that callback's app component

#### Scenario: Read-only or closed details do not mount credentials

- **WHEN** the details panel is read-only or closed
- **THEN** it does not invoke the credential render callback

### Requirement: Proactive credential forms are localized and accessible

New strings SHALL use `applicationCredentials.title`, `applicationCredentials.loadError`, `applicationCredentials.signedIn`, `applicationCredentials.signedOut`, `applicationCredentials.sharedCredentials`, and `applicationCredentials.confirmLogout` from the app's English locale. Button labels, loading text, API-key labels, no-credentials text, offline-consent captions and login/logout errors SHALL reuse the existing `ButtonsI18nKeys`, `BasicI18nKeys`, `ToolsetSigninI18nKeys`, and `ToolsetEditorI18nKeys` keys.

The surface SHALL have a localized section label; each row SHALL have a service-name group label, labelled password/checkbox controls and `aria-busy` during mutation. Loading and signed-in/out feedback SHALL use `role="status"`; errors SHALL use `role="alert"`. Actions SHALL be reachable by keyboard, and application-form action buttons SHALL have a minimum 44px height. Text SHALL wrap at mobile and desktop widths, spacing SHALL use logical properties, and inherited RTL direction SHALL be preserved. This requirement does not change existing Quick app chip styles. No new analytics events or credential logging are introduced.

#### Scenario: Status and errors are exposed to assistive technology

- **WHEN** a form is loading, changes login status, or encounters an error
- **THEN** it exposes the appropriate status or alert semantics with localized text

#### Scenario: Service descriptions adapt to direction and width

- **WHEN** a long service name or description is rendered in a narrow viewport or RTL document
- **THEN** text wraps and logical spacing follows the inherited direction without adding physical left/right layout rules
