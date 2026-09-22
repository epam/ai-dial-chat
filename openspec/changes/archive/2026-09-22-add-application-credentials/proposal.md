## Why

### Problem

[Chat issue #8662](https://github.com/epam/ai-dial-chat/issues/8662) requires users to configure an application's external-service credentials from Catalog details and Quick app Context & Tools before running a conversation. The existing completion-interrupt flow only asks for credentials after an application is invoked.

This change records the implementation already present in the Chat working tree and the companion [Quick Apps PR #140](https://github.com/epam/ai-dial-quickapps-frontend/pull/140). It is a specification capture, not a request to implement a second authentication flow.

## What Changes

### Solution

- Add an uncached, session-authenticated `GET /api/v1/external-services/{appId}` listing public service metadata and statuses from Core's single-application endpoint. Extend single-service lookup with a public-metadata fallback for management-endpoint 403/404 responses.
- Reuse `useExternalServiceLogin` for API-key, OAuth and DIAL-native forms owned by `apps/chat`, with personal login/logout, explicit offline-use consent, retry, and independent service drafts.
- Add an optional `renderCredentials` slot to Catalog/DetailsPanel. Catalog forms appear for applications when both backend capability and overlay `liveChatInteraction` are enabled.
- Advertise host support through `applicationCredentials=true` in the editor URL. Handle `REQUEST_APPLICATION_CREDENTIALS` from the exact embedded editor window and origin by opening the same forms in a Chat-owned dialog.
- Update the API/generated-client contract and iframe specification, and document the new Catalog behavior.

### Non-goals

- Changing existing Quick app chip styles or toolset credential behavior.
- Adding external services, administering shared credentials, or revoking platform offline access.
- Changing the completion-interrupt/client-channel lifecycle or adding a new feature flag, context, dependency, or telemetry stream.
- Copying credential handling into the external Quick Apps editor or including that repository's implementation in this change.

### Acceptance criteria

1. Application details expose one form per authenticated external service without starting a completion or opening a client channel; `NONE` services are omitted.
2. Personal API-key/OAuth login refreshes status; logout requires confirmation and targets only `USER`. DIAL-native login reuses the existing offline flow and separate administrator consent.
3. Quick app Settings can request the host dialog before saving; invalid-origin/source messages and disabled features cannot open it. Closing it preserves the editor's unsaved state.
4. Service metadata never includes secrets, remains fresh after mutations, and is accessible to an ordinary user who can read an inline service's application.
5. The Catalog library receives only a render callback; API clients, session state, feature gates and auth behavior stay at the application edge.
6. Specs retain existing offline-credentials requirements and record verification limitations accurately.

## Capabilities

### New Capabilities

- `catalog-application-credentials`: Proactive application credential forms, their app-owned state and Catalog render slot, including shared behavior used by the Quick app host dialog.

### Modified Capabilities

- `external-service-authentication`: Public service listing, safe single-service fallback, and the current generated-client and mutation contracts.
- `app-editor-flow`: Capability advertisement, trusted iframe credential requests, and the host dialog lifecycle.

## Impact

- Backend: `apps/chat-api/src/external-services/`; generated OpenAPI/client in `libs/chat-api-client/`; the existing `externalServicesApi` singleton and `apps/chat/src/server-api/external-services.ts` adapter.
- Frontend: `ApplicationCredentials`, `ApplicationCredentialRow`, `useApplicationCredentials`, `CatalogView`, and `AppEditorIframe`.
- Shared-library scope is limited to the optional `(item: CatalogItem) => ReactNode` slot on `Catalog`/`DetailsPanel`; no host contracts move into `libs/catalog`.
- Six `applicationCredentials.*` English translation keys are added; existing login/logout, offline-consent and error keys are reused. Forms use logical spacing and wrapping for mobile/desktop and inherited RTL.
- Documentation: `apps/chat/README.md`, `libs/catalog/README.md`, `docs/architecture.md`, and `docs/auth/auth-bff-encrypted-cookie.md`.

### Existing patterns and alternatives

The login reference is `apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts:97`. The implemented metadata boundary is `apps/chat-api/src/external-services/external-services.service.ts:38`; Catalog injection is in `apps/chat/src/components/CatalogView/CatalogView.tsx:191`. Local hook/row state is sufficient; no new context is needed.

Keeping reactive-only login does not satisfy pre-save credential setup. Implementing auth independently in the Quick Apps iframe would duplicate OAuth and consent handling. Sharing the existing Chat flow through a host dialog covers both surfaces with one credential owner. The Core management listing is unsuitable because it can hide inline services from ordinary users; use readable application metadata instead.

### Compatibility and specification ordering

The API and Catalog prop additions are backward compatible. The Quick Apps action is hidden unless the host advertises support. Rollback removes the host capability and forms; it does not revoke stored credentials or change Quick app data.

The active `add-scheduled-task-offline-credentials-login` change modifies the same two external-service requirements. Its external-service delta must be synchronized before this change's delta; this change preserves its DIAL-native types, application-consent status, generated client, explicit offline consent and per-service mutation restrictions. Do not archive that separate, incomplete change automatically. Reapplying its older metadata requirement after this change would overwrite the new fallback and must be reconciled first. Details and verification evidence belong in `design.md` and `tasks.md`.
