## Why

### Problem

An application editor embedded in `/apps-editor` often already knows which external service the person must
connect: its own UI shows a row for that one service with a Connect button. The only way it can ask the Chat host
for a sign-in today is `REQUEST_APPLICATION_CREDENTIALS { appId }`
(`apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx:456`), which opens the Chat-owned
`ApplicationCredentials` dialog for the whole application (`AppEditorIframe.tsx:661`). For an application that
declares several services the person sees every one of them, has to find the one they just clicked, and has to
tick "Allow offline use" themselves: it starts unchecked
(`libs/catalog/src/components/ApplicationCredentials/ApplicationCredentialRow/ApplicationCredentialRow.tsx:39`). The
editor gets no answer back, so it cannot tell when the sign-in finished.

The DIAL Loop editor is one such editor: its connections point at shared connectors declared on one application,
and its runs read the person's credential on their behalf, which DIAL Core grants only with offline-use consent.
A sign-in made in the dialog without that box ticked is stored but unusable for those runs.

Toolsets already solved the same problem with a relay: `REQUEST_TOOLSET_LOGIN { toolsetId }` →
`TOOLSET_LOGIN_RESULT` (`AppEditorIframe.tsx:289`, archived change
`2026-07-20-add-quickapps-toolset-auth-relay`). External services have no equivalent.

## What Changes

### Solution

- Extend `@epam/ai-dial-visualizer-connector` (`libs/visualizer-connector`) with an editor → host request and a
  host → editor result:
  - `REQUEST_EXTERNAL_SERVICE_LOGIN { appId, serviceId, offlineUsageConsent }`;
  - `EXTERNAL_SERVICE_LOGIN_RESULT { appId, serviceId, success, reason? }`;
  - their `AppsEditorMessages` members, message types, parser cases, `AppsEditorClient.requestExternalServiceLogin`
    and the README rows.
- In `AppEditorIframe.tsx`, handle the request like the toolset relay: reserve the popup during the click, read
  the service's public metadata from the existing application listing, sign the person in at `USER` level through
  the existing `useExternalServiceLogin`, and post the outcome back. No dialog is shown; the only window is the
  provider's own consent page.
- `offlineUsageConsent` is the person's own choice made in the editor's UI and is passed through unchanged; the host
  never defaults it.
- Advertise support with a new iframe query parameter `externalServiceLogin=true`, behind the same gates as
  `applicationCredentials`, so editors fall back to `REQUEST_APPLICATION_CREDENTIALS` on hosts without it.
- `useExternalServiceLogin` accepts an optional, already-opened popup, so a caller that must look the service up
  after the click can still open the popup inside the click.

### Non-goals

- Changing `REQUEST_APPLICATION_CREDENTIALS`, the Catalog credential forms or the toolset relay.
- A logout or API-key relay: an editor that holds its own Chat BFF session (the DIAL Loop editor does) already signs
  out and submits API keys through `/api/v1/external-services/{appId}/{serviceId}/signout|signin`. A follow-up can
  add them if an editor without a BFF needs them.
- `APPLICATION` or `GLOBAL` credentials: the relay signs in at `USER` level only.
- A new BFF endpoint, feature flag, translated string, cache or telemetry stream.

### Acceptance criteria

1. With both credential gates on, the iframe URL carries `externalServiceLogin=true`; with either off it carries
   `false`, and the request is ignored.
2. A trusted `REQUEST_EXTERNAL_SERVICE_LOGIN` for an OAuth service opens only the provider's consent popup, signs
   the person in at `USER` level with the requested `offlineUsageConsent`, and posts
   `EXTERNAL_SERVICE_LOGIN_RESULT { success: true }` with the request's raw `appId` and `serviceId`.
3. A DIAL-native service goes through the existing offline-credentials flow and administrator-consent check.
4. Each failure answers `success: false` with a reason: `popup-blocked`, `not-found`, `unsupported-auth-type`,
   `cancelled`, `admin-consent-required`, `offline-unavailable`, `failure`.
5. Messages from another origin or window, or with an empty `appId`/`serviceId` or a non-boolean
   `offlineUsageConsent`, are ignored.
6. The library carries message shapes only: no API client, session, feature flag or OAuth detail moves into it.

## Capabilities

### New Capabilities

(none — this adds a trigger to the existing application-credential capability)

### Modified Capabilities

- `app-editor-flow`: the `externalServiceLogin` advertisement and the host's handling of the request and result.
- `custom-visualizers`: the two new `AppsEditorMessages` members and the client helper in
  `@epam/ai-dial-visualizer-connector`.

## Impact

- Library: `libs/visualizer-connector/src/types/visualizer-connector.ts`, `src/models/apps-editor.ts`,
  `src/lib/apps-editor-protocol.ts`, `src/lib/AppsEditorClient.ts`, `README.md`, and their tests.
- Frontend: `apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx`, `apps/chat/src/types/apps-editor.ts`,
  `apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts`, `apps/chat/src/server-api/external-services.ts`
  (a thin `listExternalServices` wrapper over the existing generated method), and their tests.
- Backend and generated client: none. i18n: no new keys. RTL: none (no new UI).
- Cross-repo: editors that want the relay send the request when the host advertises it; the DIAL Loop editor is the
  first.

### Existing patterns and alternatives

The model is the toolset relay, `handleToolsetLoginRequest` (`AppEditorIframe.tsx:289`): popup first, lookup after,
result message. The login itself is `useExternalServiceLogin.loginWithOAuth`
(`apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts:183`), which today opens its own popup
(`useExternalServiceLogin.ts:219`) and expects the OAuth settings from a list the dialog loaded earlier
(`apps/chat/src/components/ApplicationCredentials/ApplicationCredentials.tsx:64`). Those settings come from the
application listing (`libs/chat-hooks/src/catalog/useApplicationCredentials/useApplicationCredentials.ts:40`);
the single-service lookup does not carry them.

| Option | Person sees | Result to the editor | Change size | Verdict |
|---|---|---|---|---|
| A. Keep `REQUEST_APPLICATION_CREDENTIALS` (baseline) | the dialog with every service, consent unticked | none | none | does not solve the problem |
| B. Optional `serviceId` on `REQUEST_APPLICATION_CREDENTIALS`, dialog filtered to one row | the dialog with one row | none | small | still a host window and no result; kept as the fallback idea |
| C. Direct relay `REQUEST_EXTERNAL_SERVICE_LOGIN` → result | the provider's consent only | yes | medium | **chosen**: same shape as the toolset relay, reuses the login hook |
| D. The editor runs the OAuth flow itself | the provider's consent only | n/a | large, per editor | rejected for the reason the toolset relay replaced `add-toolset-popup-signin`: OAuth client config and the callback route belong to the host |

### Compatibility and rollback

Additive: a new query parameter, two new message types and an optional hook parameter. Hosts without the change
never advertise `externalServiceLogin`, so editors keep using `REQUEST_APPLICATION_CREDENTIALS`. Rollback removes
the handler and the advertisement; stored credentials are untouched. The open change
`add-editor-application-write-endpoints` modifies `external-service-authentication`, not the capabilities here.

### Open questions

- Which applications may an editor name? Like `REQUEST_APPLICATION_CREDENTIALS`, this proposal accepts any
  application id and relies on DIAL Core, which signs a person in only to services of an application they can read.
  The host could restrict it to the edited application and applications its schema names.
- Is an editor-supplied `offlineUsageConsent` acceptable, given the editor shows the consent wording next to its
  Connect action? The alternative is a one-line host confirmation for that one service.
