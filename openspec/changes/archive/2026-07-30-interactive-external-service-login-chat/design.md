## Context

The toolset sign-in interrupt (`openspec/specs/client-channel-protocol/spec.md`, `openspec/specs/toolset-signin-interrupt/spec.md`) already ships a working, flag-gated mechanism: `ClientChannelProvider` holds one tab-wide SSE subscription (`POST /api/v1/client-channel/subscribe`), a `Map<eventId, PendingEvent>`, bounded-backoff reconnect, and a global non-dismissible `ToolsetSigninDialog` that resolves events via `report`. DIAL Core now pushes a second event shape on the **same** channel:

```json
{
  "jsonrpc": "2.0",
  "method": "external-service/signin",
  "params": { "url": "applications/public/finhub-via-openapi__1.0.0/external_services/finhub-api2" },
  "id": "applications/public/finhub-via-openapi__1.0.0/1"
}
```

`params.url` identifies an **application external service** (`applications/{bucket}/{app}/external_services/{serviceId}`) — a credential-bearing dependency declared in an application's config — not a toolset. There is no `apps/chat-api/src/external-services/` domain today.

**SDK finding that changes the proposal's assumed scope**: `@epam/ai-dial-typescript-sdk` (the version already installed, `node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts`) already exposes the exact operations this feature needs:

| SDK operation | HTTP | Purpose |
|---|---|---|
| `externalServiceSignIn` | `POST /v1/ops/external-service/signin` | body: `ResourceSignInRequest { url, credentialsLevel, authenticationType, apiKey?, code?, redirectUri? }` → `boolean` |
| `externalServiceSignOut` | `POST /v1/ops/external-service/signout` | body: `ResourceSignOutRequest { url, credentialsLevel, authenticationType }` → `boolean` |
| `getExternalService` | `GET /v1/applications/{appId}/external-services/{id}` | → `ExternalServiceData { id, display_name, description, auth_settings: ResourceAuthSettings }` |
| `listExternalServices` | `GET /v1/applications/{appId}/external-services` | → map of `ExternalServiceData` |
| `externalServiceGetCredentials` | `POST /v1/ops/external-service/credentials` | resolved header credentials for an already-signed-in service — **not used by this design** (server-to-server concern, not a browser-facing login step) |

Crucially, `ResourceSignInRequest`/`ResourceSignOutRequest`/`ResourceAuthSettings` are the **same generic shapes** `ToolsetsService.loginToolset`/`logoutToolset` already map into via `toDialToolsetSigninBody`/`toDialToolsetSignoutBody` (`apps/chat-api/src/toolsets/toolsets.service.ts:1001-1080`) — toolset sign-in and external-service sign-in are two call sites of the same Core primitive, differing only in URL shape and target REST path. This means **there is no SDK gap** (the proposal's Open Question 4 in the user's brief), and the BFF module for external services is a near-mechanical port of the existing toolset module, not new protocol design.

The Postman collection referenced in the initial ask (`/v1/ops/external-service/obo-credentials`) does **not** appear anywhere in the installed SDK's operation list or path map. `AuthenticationType` is a closed enum (`'OAUTH' | 'API_KEY' | 'NONE'`) with no separate OBO variant. This design treats that endpoint as **unconfirmed** against the currently installed Core contract (see Open Questions) and does not implement it; `OAUTH` via `externalServiceSignIn` is assumed to already cover the consent flow the Postman collection called "OBO".

## Goals / Non-Goals

**Goals:**
- Let a user resolve a mid-completion external-service credential problem without losing the in-progress conversation, reusing the exact channel/dialog/report plumbing already shipped for toolsets.
- Add the missing BFF proxy for `externalServiceSignIn`/`externalServiceSignOut`/`getExternalService` following the `toolsets` domain's thin controller/service/DTO pattern exactly.
- Keep DIAL Core external-service knowledge (URL shape, auth-settings schema) inside `apps/chat-api/src/external-services/` and app-level `apps/chat` code only.
- Share the login orchestration (API key submit, OAuth popup/callback/BroadcastChannel, decline/decline-all, sibling resolution) between toolsets and external services instead of forking a second implementation of the same state machine.

**Non-Goals:**
- Changing `toolset-signin-interrupt` or `client-channel-protocol`'s subscribe/report/unsubscribe contracts, reconnect policy, or completion channel-id forwarding — those are reused unmodified.
- Implementing `/v1/ops/external-service/obo-credentials` or `externalServiceGetCredentials` — out of scope until confirmed against live Core (Open Questions).
- Proactive login from a Catalog-equivalent surface for applications (an "Application details" credentials panel) — this change is completion-time interrupt only, matching the first toolset shipment's scope.
- A general RPC/event framework beyond dispatching on `method` for these two sign-in event kinds.

## Decisions

### 1. Discriminate on `method`, not on a second subscription

`ClientChannelContext.tsx`'s existing SSE frame parser gains a `method` switch: `toolset/signin` → existing `PendingToolsetSigninEvent` handling (unchanged), `external-service/signin` → new `PendingExternalServiceSigninEvent` handling. Both live in the same `Map<eventId, PendingEvent>` (a discriminated union keyed by `kind`), one tab-wide subscription, same reconnect/backoff/dedup-by-id rules already specified in `client-channel-protocol` and `toolset-signin-interrupt`.

**Alternative considered**: a second `ClientChannelProvider`-like context specifically for external services. Rejected — Core's channel id is connection-level, not event-kind-level; a second subscription would double SSE connections and reconnect logic for no benefit, and `client-channel-protocol` already documents the stream as carrying arbitrary RPC methods.

### 2. One generalized dialog component, not two

`ToolsetSigninDialog` is generalized into a dialog that renders both pending-event kinds as rows in the same list (same non-dismissible modal, same `Decline all`, same `aria-live` region), rather than mounting a second global dialog. Each row's `Log in ` action dispatches to a kind-specific login call (`useToolsetLogin` vs. a new `useExternalServiceLogin`) behind a shared row-rendering shell.

**Alternative considered**: a dedicated `ExternalServiceSigninDialog` mounted alongside `ToolsetSigninDialog`. Rejected — two independently-mounted non-dismissible global modals risk stacking/z-index and focus-trap conflicts if both fire in the same session (a completion can plausibly hit both a toolset and an external service back-to-back); one dialog with mixed rows avoids that entirely and matches the "one interrupt surface" mental model implied by the shared channel.

**Naming**: the component is renamed `SigninInterruptDialog` (file move `ToolsetSigninDialog/` → `SigninInterruptDialog/`) to reflect the broadened scope; this is a mechanical rename, not a behavior change for existing toolset rows.

### 3. Metadata resolution: `getExternalService`, parsed from `params.url`

`params.url` (`applications/{bucket}/{app}/external_services/{serviceId}`) is parsed into `{ appId: "applications/{bucket}/{app}", serviceId }` by a small app-level parser in `apps/chat-api/src/external-services/external-services.mapper.ts` (mirrors `toolsets.mapper.ts`'s existing URL-parsing helpers). The BFF calls `getExternalService(appId, serviceId)` to fetch `display_name`, `description`, and `auth_settings.authentication_type` — the same information `getToolset` already supplies for toolset rows. The frontend never parses the resource URL itself; it receives a resolved DTO from the BFF, keeping DIAL Core path semantics out of `apps/chat`.

**Alternative considered**: have the frontend call `listExternalServices` per application and cache-match by `serviceId`. Rejected — a direct `getExternalService(appId, id)` call is one round trip instead of a list-then-filter, and keeps the app-id/service-id split (a DIAL Core path convention) entirely inside the BFF mapper.

**Fallback**: if metadata resolution fails (service deleted, transient error), the row shows a fallback label derived from `serviceId` — mirrors `toolset-signin-interrupt`'s "Metadata not yet loaded shows a fallback name" scenario.

### 4. Auth-type branching: `API_KEY` and `OAUTH`, `NONE` never interrupts

`auth_settings.authentication_type` (`'OAUTH' | 'API_KEY' | 'NONE'`) drives the row UI exactly as it does for toolsets: `API_KEY` shows an inline key field, `OAUTH` calls `login()` directly to open the popup. `NONE` is not expected to ever appear in an `external-service/signin` event (nothing to sign in to); if it does, the row surfaces a non-actionable "no credentials required" state and auto-reports `success` on render, since Core would not have paused on a `NONE`-auth service in the first place — this is defensive, not a designed-for path.

### 5. Login controller: generalize `useToolsetLogin`, don't fork it

`useToolsetLogin.ts` is generalized into a shared controller parameterized over a small `SigninTarget` interface (`{ url, credentialsLevel, authenticationType, signIn, signOut }`) so both toolsets and external services supply their own BFF calls (`loginToolset`/`logoutToolset` vs. new `signInExternalService`/`signOutExternalService`) while sharing: `forceStale` pre-logout-then-login, the OAuth popup/`state`/`BroadcastChannel`/`Cancelled`-then-reverify flow, and post-login refetch. `ToolsetSigninDialog`'s existing `forceStale: true` behavior for signin-triggered logins is preserved unchanged.

**Credentials level for external services**: unlike toolsets (`public → USER`, `private → GLOBAL`), external service `credentials_level` comes directly from `ResourceAuthSettings`/the event context rather than a public/private toggle — the dialog uses whatever level the fetched `auth_settings` (or a per-service level field, if Core's real response includes one) indicates, never inferring it client-side. This is flagged as an item to confirm against a live external service in Open Questions, since the exact field carrying `credentialsLevel` for a *pending event* (as opposed to a user-initiated login) is not yet confirmed.

**Alternative considered**: keep two separate hooks with duplicated OAuth/popup code. Rejected — the OAuth popup/BroadcastChannel handshake is the most fragile, security-sensitive part of the existing flow (state validation, `popup.opener = null`, `sessionStorage` scoping); duplicating it doubles the surface for it to drift out of sync.

### 6. BFF module structure mirrors `toolsets/` exactly

New `apps/chat-api/src/external-services/` domain (no `modules/` wrapper):
- `external-services.controller.ts` — `@Controller({ path: 'external-services', version: '1' })`: `GET /:appId/:serviceId` (proxies `getExternalService`), `POST /:appId/:serviceId/signin` (proxies `externalServiceSignIn`), `POST /:appId/:serviceId/signout` (proxies `externalServiceSignOut`). All guarded by the existing global `CsrfGuard` on mutating routes and `@RequireFeature(FeatureKey.LiveChatInteraction)` on all three, matching how `client-channel.controller.ts` gates `subscribe`/`report` (defense in depth — a role-restricted or flag-disabled user cannot reach these endpoints directly even though the frontend gate would already block the UI).
- `external-services.service.ts` — calls `dialClient.client.getExternalService`/`externalServiceSignIn`/`externalServiceSignOut` with the session bearer token; logs only `appId`/`serviceId`/`authenticationType`/`credentialsLevel`, never `apiKey`/`code` — identical discipline to `ToolsetsService.loginToolset`.
- `external-services.mapper.ts` — parses `params.url` into `{ appId, serviceId }`; maps DTOs to/from `ResourceSignInRequest`/`ResourceSignOutRequest`.
- `dto/` — `ExternalServiceSigninBodyDto` (`credentialsLevel`, `authenticationType`, `apiKey?`, `code?`, `redirectUri?`), `ExternalServiceLogoutBodyDto`, response DTO for `getExternalService` (`displayName`, `description`, `authenticationType`). Path segments (`appId`, `serviceId`) validated with an allowlist `@Matches` regex before being logged or forwarded, per `apps/chat-api/AGENTS.md`.

### 7. Generated client and frontend wrappers

All three new endpoints are plain JSON request/response (no SSE) and go through the generated `@epam/chat-api-client` after `npm run openapi`, with `operationIdFactory` names `getExternalService`, `signInExternalService`, `signOutExternalService`. `apps/chat/src/server-api/external-services.ts` provides thin wrappers, mirroring `apps/chat/src/server-api/toolsets.ts`.

### 8. Feature flag: reuse `liveChatInteraction`, no new flag

External-service events are gated by the exact same `liveChatInteraction` flag as toolset events (`FeatureKey.LiveChatInteraction`, `useFeatureFlag('liveChatInteraction')`) — there is no separate rollout lever, since both event kinds arrive on the same channel that the flag already gates end-to-end (subscribe attempt, completion channel-id attach, dialog rendering). The new BFF endpoints (`getExternalService`, sign-in, sign-out) apply the same `@RequireFeature` guard as `client-channel.controller.ts`'s `subscribe`/`report`.

## Risks / Trade-offs

- **[Risk] `params.url` parsing (`applications/{bucket}/{app}/external_services/{serviceId}` → `appId`/`serviceId`) is inferred from the one example event in the proposal, not confirmed against a live Core response.** → Mitigation: isolate the parse in one mapper function with unit tests covering the documented example plus edge cases (missing segments, encoded characters); treat any Core response that doesn't match the expected shape as a fallback-name case (Decision 3) rather than throwing.
- **[Risk] `credentialsLevel` resolution for a Core-*pushed* external-service event is unconfirmed (Decision 5) — using the wrong level could either fail sign-in or, worse, sign in at a broader level (`GLOBAL`) than intended.** → Mitigation: default to the narrowest level the fetched `auth_settings` indicates is currently `FAILED`/`SIGNED_OUT`; never widen to `GLOBAL` without an explicit signal from the resolved metadata. Flagged as an Open Question requiring product/Core confirmation before enabling in a real environment.
- **[Risk] Generalizing `useToolsetLogin`/`ToolsetSigninDialog` risks regressing the already-shipped, tested toolset flow.** → Mitigation: the generalization is additive (new parameters with defaults matching current toolset behavior exactly); the full existing toolset test suite (`useToolsetLogin.spec.ts`, `ToolsetSigninDialog.spec.tsx` renamed/extended) must pass unchanged before adding external-service-specific tests.
- **[Risk] The Postman-documented `/v1/ops/external-service/obo-credentials` endpoint isn't in the installed SDK; if Core actually requires a separate OBO consent step for some external services, `OAUTH` via `externalServiceSignIn` alone may not be sufficient.** → Mitigation: not implemented in this change (Non-Goal); flagged as an Open Question and explicitly out of scope until a live Core check confirms whether `OAUTH` fully covers it or a follow-up change is needed.

## Migration Plan

- No data migration. Ships behind the already-live `liveChatInteraction` flag (default off / per-environment as already configured for toolsets) — no new flag to roll out.
- Rollout: since the flag is already enabled in whichever environments ship toolset sign-in today, this change activates for external-service events in those same environments as soon as it deploys. Verify in a lower environment first with a real or mocked `external-service/signin` event before relying on it in production.
- Rollback: no separate rollback lever from the toolset flow — disabling `liveChatInteraction` disables both event kinds together, matching existing behavior.

## Open Questions

1. Is `applications/{bucket}/{app}/external_services/{serviceId}` → `getExternalService(appId="applications/{bucket}/{app}", id="{serviceId}")` the correct split, or does Core's `appId` path parameter expect a different substring (e.g. without the `applications/` prefix, or including the version suffix differently)? Needs a live Core check.
2. For a Core-*pushed* `external-service/signin` event, what determines `credentialsLevel` (`GLOBAL` / `APPLICATION` / `USER`) — is it present in `auth_settings` (`app_level_auth_status`/`user_level_auth_status`/`global_auth_status`), inferred from which level is currently non-`SIGNED_IN`, or does the event need Core to add it explicitly?
3. Does `externalServiceSignIn`'s generic `AuthenticationType` (`'OAUTH' | 'API_KEY' | 'NONE'`) fully cover the "OBO"/consent case referenced in the original Postman collection, or is `/v1/ops/external-service/obo-credentials` a real, separate Core endpoint not yet reflected in the installed SDK version?
4. Should sibling-event auto-resolution (Decision 4 of `toolset-signin-interrupt`, "one login resolves other pending events for the same toolset+level") extend to external services keyed by `serviceId` + `credentialsLevel`, or should every external-service event always require its own explicit action given the credentials-level ambiguity in Open Question 2?
5. Is completion-time interrupt (this change's only scope) sufficient, or does product also want a proactive external-service login surface (an "Application details" panel, analogous to Catalog for toolsets) in a follow-up change?
