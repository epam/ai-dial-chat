## Context

This document describes the implementation already in the working tree for [Chat #8662](https://github.com/epam/ai-dial-chat/issues/8662), with the external editor integration in [Quick Apps PR #140](https://github.com/epam/ai-dial-quickapps-frontend/pull/140). Runtime code is not changed by this specification capture.

The existing `useExternalServiceLogin` owns API-key/OAuth login and the DIAL-native offline-credentials path. `ApplicationCredentials` now supplies proactive entry points independent of `ClientChannelContext`. The current main external-service spec predates both generated-client migration and the active offline-credentials change, so the delta must preserve those implemented contracts while adding the new behavior.

Backend conventions remain governed by `apps/chat-api/AGENTS.md` sections 2–6 and 9–12. Library boundaries remain governed by root `AGENTS.md` and `.claude/rules/libs.md`; this change adds no lib manifest or dependencies.

## Goals / Non-Goals

**Goals:**

- Configure personal external-service credentials from Catalog or Quick app Settings before a completion.
- Share the existing authentication implementation across both surfaces.
- Return fresh, public metadata to users who can read an application, including its inline services.
- Keep the Catalog package independent of Chat authentication and preserve editor drafts.

**Non-Goals:**

- Administering service definitions or shared credentials; granting application-level DIAL-native consent.
- Changing toolset behavior, Quick app chip layout, preview/save semantics, or client-channel subscriptions.
- New contexts, persistence, analytics, dependencies, routes, or feature flags.

## Decisions

### 1. Read public single-application metadata through the BFF

`ExternalServicesService.listExternalServices` calls the existing SDK `getApplication` with the session access token and an encoded full application id. It maps `external_services` through the existing field allowlist, adding each map key as the service `id`. Core's deployment listing omits this map, and management endpoints can deny ordinary readers or hide inline definitions. Neither is an adequate source for the new forms.

The new GET requires an authenticated session and the existing `liveChatInteraction` capability resolved for the caller's roles; no admin role is required. Core remains the authority on application access. No backend cache is introduced, and the response carries `Cache-Control: private, no-store`. Absent services return an empty array; an absent successful application payload is a 502. The delta spec defines the complete request, response and error contract.

The single-service endpoint keeps its management lookup for compatibility. On 403/404 it attempts the public list and selects the requested id. For an original 404, it retains the existing `getCustomApplication` fallback if needed. Failed fallbacks do not turn an unreadable service into successful empty metadata.

### 2. Keep state in app-owned hooks and rows

`useApplicationCredentials(appId)` owns the service list, loading/error flags, offline connection status, and a memoized refresh function. It queries offline status only when a DIAL-native service is present. A request generation and active application id invalidate stale responses and callbacks after an application switch or unmount. There is no shared cache or new context.

`ApplicationCredentialRow` owns its password input, initially unchecked offline-use consent, mutation progress, error, and logout confirmation. Rows are keyed by application and service id. Refreshing after one successful mutation keeps existing rows mounted, preserving other service drafts. Loading is explicit for an initial/empty load; failed metadata requests expose retry. No-auth applications render nothing in Catalog and an informational empty state in the editor dialog.

API-key and OAuth operations use `USER` credentials. Shared `GLOBAL`/`APPLICATION` status is informational, and confirmed logout targets only the user's credentials. The existing login hook receives `forceStale` only for a `FAILED` personal status. DIAL-native readiness combines connected offline credentials with `appLevelAuthStatus === SIGNED_IN`; its login hook rechecks consent and status and never sends per-service signin/signout or exposes a logout action for platform offline credentials.

A dedicated global provider or a second OAuth implementation would add lifecycle and security obligations without a cross-surface state requirement. Local state plus an explicit refresh is sufficient.

### 3. Expose a render slot at the Catalog boundary

`CatalogProps` and `DetailsPanelProps` accept `renderCredentials?: (item: CatalogItem) => ReactNode`. `Catalog` forwards it to the open, editable details panel, which renders it below the header in the normal details view. Closed, read-only and alternate subviews do not render the slot.

`CatalogView` supplies a memoized callback returning `ApplicationCredentials` only for `CatalogEntityType.Agent` and when both `useFeatureFlag('liveChatInteraction')` and `useUiFeature(OverlayFeature.LiveChatInteraction)` are true. The library does not learn about service DTOs, endpoint paths, session state, flags, routing or iframe messages. A built-in application-auth subsystem inside `libs/catalog` would violate this boundary.

### 4. Use a trusted iframe request to open the same host forms

`AppEditorIframe` adds `applicationCredentials=true|false` to its memoized URL based on the same two gates. It owns `credentialsAppId` and handles `{ type: 'REQUEST_APPLICATION_CREDENTIALS', appId }` only when the origin equals the editor URL's origin, the source equals that iframe's current `contentWindow`, and `appId` is a nonempty string. It normalizes the raw editor id with the existing encoder before opening a Chat-owned `Popup`.

The popup renders the same forms with an explicit empty state. Close clears the selected id; an iframe URL change also clears it. The iframe remains mounted, so opening/closing credentials does not save, discard or reload its settings. Disabling either feature gate suppresses the dialog. Only the requested application identifier crosses the message boundary; API keys, authorization codes and tokens stay in the existing Chat authentication flow. No result message or client-channel event is introduced.

The companion Quick Apps PR queries metadata only for selected applications and exposes the action only if the host advertises support. It offers the host retry surface when detection fails. It preserves the existing chip styles. This repository specifies the host contract; the companion repository owns its UI and metadata detection.

### 5. Preserve generated contracts, localization and accessibility

The controller/DTO sources drive OpenAPI generation. The new `ExternalServicesApi.listExternalServices` returns `ApplicationExternalServiceDto[]`; existing get/signin/signout operations remain generated. `apps/chat/src/server-api/external-services.ts` uses normal generated methods through the existing configured `externalServicesApi` singleton. No raw transport helpers or library-owned API adapters are introduced.

New strings are `applicationCredentials.title`, `.loadError`, `.signedIn`, `.signedOut`, `.sharedCredentials`, and `.confirmLogout`; existing button, API-key, offline-consent and error keys are reused. The forms have labelled password/checkbox controls, named service groups, `aria-busy` during mutations, `role="status"` for status and `role="alert"` for errors, a labelled popup close action, wrapping content and logical spacing. App forms retain 44px action targets. They inherit RTL without adding directional icons or language-aware library code.

No new analytics events, metrics or log streams are needed. Existing request/error handling is reused without adding credentials to metadata or iframe messages.

## Risks / Trade-offs

- Core versions omitting `external_services` even from single-application metadata produce the no-auth empty state. Deployment listing cannot be used to infer whether an app requires auth; support depends on the Core application metadata contract.
- A failed offline-status request currently fails the whole form load when a DIAL-native service is present. The common retry action retries both reads; partial per-service loading is outside this change.
- Two separately deployed frontends must agree on the message contract. Capability advertisement keeps the Quick Apps action hidden on older/disabled hosts.
- The active offline-credentials delta overlaps two requirement headings. Synchronizing in the wrong order can restore outdated metadata behavior; apply the sequence below and retain its separate native-interrupt requirement.
- A live-provider browser walkthrough has not been performed. Automated tests and builds establish component/protocol behavior, not successful authorization against a deployed identity provider.
- Full repository verification encountered unrelated formatting failures in `refactoring-backend.md` and `technical-debt-remediation-plan.md`, and a separate test-suite run was blocked by a missing installed Tabler module in `attachment-canvas-consumer-fixture:build`. Relevant project tests, types, lint, OpenAPI checks, documentation checks and builds passed; see `tasks.md`.

## Migration Plan

1. Review the three deltas in this change against the existing runtime diff; no persisted data migration is needed.
2. Before syncing these deltas to main specs, synchronize the implemented `external-service-authentication` delta from `add-scheduled-task-offline-credentials-login`. Do not automatically archive its other capabilities or mark its remaining work complete.
3. Apply this change's deltas after that prerequisite. Its two modified external-service requirements contain the complete current mutation/client contract and the new fallback. The prerequisite's separately added DIAL-native interrupt requirement remains intact.
4. If the prerequisite is archived later, reconcile its two overlapping requirements with the newer main spec first, instead of blindly reapplying its older fallback. This capture leaves that separate change and the main specs untouched.
5. Deploy the Chat BFF and frontend together. Deploy Quick Apps PR #140 when ready; either deployment order is safe because the action requires host capability advertisement.
6. Roll back by removing the advertised capability and the app form entry points. No stored credentials, Quick app settings or data schemas are changed by rollback.

## Open Questions

No unresolved product or ownership decisions. The remaining limitations concern environment-wide verification and a live-provider browser check; they are recorded rather than represented as completed validation.
