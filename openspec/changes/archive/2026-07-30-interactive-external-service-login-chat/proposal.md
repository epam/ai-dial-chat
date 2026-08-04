## Why

DIAL Core's client-channel mechanism already lets a chat user resolve a mid-completion **toolset** credential problem without losing the conversation (`toolset-signin-interrupt`). Core now pushes an analogous `external-service/signin` event on the same channel when an **application's external service** (an OpenAPI/API-key/OAuth-backed dependency declared in an application's `external_services` config, not a toolset) blocks a completion for the same reason: missing, expired, or rejected credentials. Chat has no handling for this event today — the completion simply stalls/fails with no interactive recovery path, even though the underlying BFF plumbing (subscribe/report/unsubscribe) and login UX pattern already exist for toolsets.

## What Changes

- Extend the existing `ClientChannelContext` event parser to recognize `external-service/signin` events (`params.url` identifying an application external service) alongside the existing `toolset/signin` events, keeping one shared subscription, reconnect policy, and per-event-id pending map (per `client-channel-protocol`, unmodified).
- Add a BFF `apps/chat-api/src/external-services/` domain that proxies DIAL Core's existing `externalServiceSignIn` / `externalServiceSignOut` / `getExternalService` SDK operations (`@epam/ai-dial-typescript-sdk`, `/v1/ops/external-service/signin|signout`, `/v1/applications/{appId}/external-services/{id}`) using the session's bearer token, following the exact thin controller/service/DTO pattern of `apps/chat-api/src/toolsets/`.
- Add a global, non-dismissible `ExternalServiceSigninDialog` (or a generalized shared dialog — decided in design.md) that lists pending `external-service/signin` events, resolves each service's auth type (`API_KEY` / `OAUTH` / `NONE`) via the new BFF endpoint, and lets the user log in or decline, reporting `success`/`denied` back on the client channel exactly like `ToolsetSigninDialog`.
- Extract the OAuth popup/API-key submit orchestration shared between toolset and external-service login into a common controller (generalizing `useToolsetLogin`), so both features report through the same `success`/`denied` protocol without duplicating the popup/BroadcastChannel handshake.
- Extend the `client-channel-protocol` spec to document that the subscribe stream carries both `toolset/signin` and `external-service/signin` methods; no change to subscribe/report/unsubscribe request/response shapes or to completion channel-id forwarding.
- **BREAKING**: none — additive alongside the shipped toolset sign-in interrupt; `liveChatInteraction` continues to gate the whole mechanism for both event kinds.

## Capabilities

### New Capabilities

- `external-service-signin-interrupt`: Frontend behavior for receiving `external-service/signin` events during a chat completion, resolving each service's auth metadata, presenting a global login dialog (API key or OAuth), and reporting `success`/`denied` back to Core, including sibling-event and duplicate-event handling mirroring the toolset flow.
- `external-service-authentication`: BFF proxying of DIAL Core's `POST /v1/ops/external-service/signin`, `POST /v1/ops/external-service/signout`, and `GET /v1/applications/{appId}/external-services/{id}` operations, with request validation and logging discipline matching `toolset-authentication`.

### Modified Capabilities

- `client-channel-protocol`: the subscribe SSE stream's documented event set gains `external-service/signin` alongside `toolset/signin`; no other requirement in this spec changes (subscribe/report/unsubscribe contracts, channel-id propagation, feature-flag gating, and logging rules are reused as-is).

## Impact

- **Affected code**: `apps/chat/src/context/ClientChannelContext.tsx` (event-kind discrimination), a new `apps/chat/src/components/ExternalServiceSigninDialog/` (or generalized dialog shared with `ToolsetSigninDialog`), a new `apps/chat/src/hooks/` login controller generalized from `useToolsetLogin.ts`, a new `apps/chat-api/src/external-services/` domain (controller, service, DTOs), `apps/chat/src/server-api/` (new thin wrapper over the generated client), `apps/chat/src/i18n/locales/en.json` + `translation-keys.ts` (new `externalServiceSignin.*` keys, reusing `ButtonsI18nKeys.LogIn` where wording matches).
- **APIs**: new BFF endpoints proxying `/v1/ops/external-service/signin`, `/v1/ops/external-service/signout`, and `/v1/applications/{appId}/external-services/{id}`; no change to `/api/v1/client-channel/*` or completion endpoints.
- **Dependencies**: relies on `@epam/ai-dial-typescript-sdk`'s existing `externalServiceSignIn` / `externalServiceSignOut` / `getExternalService` / `listExternalServices` / `externalServiceGetCredentials` operations (already present in the installed SDK version) — no SDK upgrade needed, no raw-`fetch` fallback required.
- **Docs**: `docs/auth/` gains a note distinguishing application OIDC login, toolset credential login, and external-service credential login; extends or adds alongside `docs/auth/auth-diagrams/08-toolset-signin-interrupt.mmd`.
