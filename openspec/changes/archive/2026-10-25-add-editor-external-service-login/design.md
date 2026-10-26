## Context

`AppEditorIframe.tsx` hosts application editors in a cross-origin iframe and talks to them through
`AppsEditorHost` from `@epam/ai-dial-visualizer-connector`. Two auth messages exist today:

- `REQUEST_TOOLSET_LOGIN` / `TOOLSET_LOGIN_RESULT`: the host runs one toolset's OAuth login and answers.
- `REQUEST_APPLICATION_CREDENTIALS`: the host opens `ApplicationCredentials` for a whole application and does not
  answer.

`useExternalServiceLogin` already performs every external-service login the dialog offers (API key, OAuth,
DIAL-native). Its OAuth branch opens the popup as its first statement and then navigates it with the OAuth settings
it was given. The dialog gets those settings from `useApplicationCredentials`, which calls
`externalServicesApi.listExternalServices({ appId })` (BFF `GET /api/v1/external-services/{appId}`); the
single-service response (`GET /api/v1/external-services/{appId}/{serviceId}`) has no client id, endpoint or scopes.

## Goals / Non-Goals

**Goals:**

- An editor can sign the person in to one named external service of one application, at `USER` level, with an
  offline-use choice it collected itself, and learn the outcome.
- The person sees no host dialog: only the provider's consent page (or, for DIAL-native, the existing offline
  credentials popup).
- The library stays a message-shape package; all auth, API and feature-gate knowledge stays in `apps/chat`.

**Non-Goals:**

- Logout, API-key submission, or `APPLICATION`/`GLOBAL` levels through the relay.
- Changing the dialog, Catalog forms, the toolset relay or the OAuth callback route.

## Decisions

### D1. Library: two messages, parsed like the toolset pair

`libs/visualizer-connector`:

- `AppsEditorMessages.RequestExternalServiceLogin = 'REQUEST_EXTERNAL_SERVICE_LOGIN'` and
  `AppsEditorMessages.ExternalServiceLoginResult = 'EXTERNAL_SERVICE_LOGIN_RESULT'`.
- `AppsEditorExternalServiceLoginRequestMessage { type; appId: string; serviceId: string; offlineUsageConsent: boolean }`
  joins `AppsEditorClientMessage`.
- `AppsEditorExternalServiceLoginResultMessage { type; appId: string; serviceId: string; success: boolean; reason?: string }`
  joins `AppsEditorHostMessage`.
- `parseAppsEditorClientMessage` accepts the request only with nonempty `appId` and `serviceId` (`isIdentifier`) and a
  boolean `offlineUsageConsent`; `parseAppsEditorHostMessage` accepts the result only with identifiers, a boolean
  `success` and an optional string `reason`. Each is rejected in the other direction.
- `AppsEditorClient.requestExternalServiceLogin(appId, serviceId, { offlineUsageConsent })`.

`reason` stays a plain string in the library, as for toolsets; the host owns its vocabulary (D4). Nothing about
OAuth, endpoints or levels enters the library.

### D2. Host: advertise, then relay like `handleToolsetLoginRequest`

`AppEditorIframe.tsx` adds `AppsEditorIframeQuery.ExternalServiceLogin = 'externalServiceLogin'` to the iframe URL
with the same value as `applicationCredentials` (`isApplicationAuthCapable && isApplicationAuthEnabled`), and
handles the request in the existing origin- and source-checked `handleMessage` only when both gates are on.

`handleExternalServiceLoginRequest(appId, serviceId, offlineUsageConsent, host)`:

1. `openToolsetOAuthPopup()` as the first statement; `null` → `popup-blocked`.
2. `listExternalServices(normalizeDeploymentId(appId))` (a new thin wrapper in
   `apps/chat/src/server-api/external-services.ts` over the generated `listExternalServices`), then the entry whose
   `id` equals `serviceId`; none → close the popup, `not-found`; a failed request → close, `failure`.
3. By `authenticationType`:
   - `OAUTH` → `login({ appId, serviceId, credentialsLevel: USER, authenticationType: OAUTH, oauthSettings, offlineUsageConsent, forceStale: userLevelAuthStatus === 'FAILED', popup })`,
     with `oauthSettings` mapped exactly as `ApplicationCredentials` maps them;
   - `DIAL_NATIVE` → `login({ …, authenticationType: DIAL_NATIVE, popup })` (the existing offline-credentials and
     administrator-consent path);
   - `API_KEY`, `NONE` → close the popup, `unsupported-auth-type`.
4. Post `EXTERNAL_SERVICE_LOGIN_RESULT` with the raw `appId` and `serviceId` as received.

**Why the listing and not a new endpoint:** it is the call the dialog already makes, it returns public metadata
only (no secrets) and is uncached, so no BFF or generated-client change is needed.

### D3. `useExternalServiceLogin` takes a reserved popup

`ExternalServiceLoginParams` gains `popup?: Window`: a popup the caller opened during the person's gesture.
`loginWithOAuth` and `loginWithDialNative` use it instead of calling `openToolsetOAuthPopup()`, and close it on
their early-return failures as they close their own today. Callers that omit it (the dialog, the sign-in interrupt)
behave as before.

**Alternative:** have the host call `navigateToolsetOAuthPopup` itself, as the toolset relay does. Rejected: it would
duplicate the hook's `forceStale` logout, offline-consent forwarding, DIAL-native branch and cancel re-check.

### D4. Outcome → result

| `ExternalServiceLoginOutcomeType` | `success` | `reason` |
|---|---|---|
| `Success` | `true` | — |
| `PopupBlocked` | `false` | `popup-blocked` |
| `Cancelled` | `false` | `cancelled` |
| `AdminConsentRequired` | `false` | `admin-consent-required` |
| `OfflineUnavailable` | `false` | `offline-unavailable` |
| `Failure` | `false` | `failure` |

plus the host's own `not-found` and `unsupported-auth-type` (D2).

### D5. Offline consent is the editor's, passed through

`offlineUsageConsent` is required on the request. The host forwards it to `login` unchanged and never sets it
itself, which keeps the hook's rule that consent is never defaulted on the person's behalf. An editor that sends
`true` SHALL show the consent wording next to the action that sends it; the DIAL Loop editor does, because its
runs act for the person later.

### D6. State, memoisation, accessibility, telemetry

No new state beyond the handler's local popup; the handler is a `useCallback` and joins `handleMessage`'s
dependencies, as `handleToolsetLoginRequest` does. No new UI, so no accessibility or RTL change; the popup is the
existing one. No telemetry or cache.

## Risks / Trade-offs

- **Popup blocked** despite opening first: the click happened in a cross-origin iframe and reaches the host by
  `postMessage`. Same exposure as the toolset relay; answered `popup-blocked`, and the editor offers a retry or the
  dialog.
- **An editor names an application it does not edit**: the same reach as `REQUEST_APPLICATION_CREDENTIALS` today.
  DIAL Core's sign-in requires read access to the application, and the person still approves at the provider. See
  the proposal's open questions for a host-side restriction.
- **Two requests in flight**: each runs its own popup and answers for its own `appId`/`serviceId`; the editor should
  disable its button while waiting.
- **Contract drift across repositories**: the spec deltas here are the source of truth; a payload change is a
  breaking cross-repository change and must say so in its PR.
