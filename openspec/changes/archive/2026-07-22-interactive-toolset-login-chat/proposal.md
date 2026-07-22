## Why

Today a toolset can only be logged into from the Catalog details panel or the Toolset Editor. When DIAL Core actually invokes a toolset mid-completion and its credentials are missing, expired, or rejected by the downstream provider, Core has no way to ask the *chat user in the middle of a conversation* to log in — the completion simply fails (or the tool call errors out) with no interactive recovery path. DIAL Core now exposes a generic client-channel RPC mechanism (`/v1/ops/client-channel/subscribe|report|unsubscribe`) that lets a client register a channel, receive `toolset/signin` events correlated to an in-flight completion, and report back `success`/`denied` so Core can resume or terminate the blocked tool call. Chat needs to consume this protocol so users can complete a conversation without manually discovering and fixing toolset credentials out-of-band.

## What Changes

- Add a NestJS client-channel adapter in `apps/chat-api` that proxies DIAL Core's `subscribe` (SSE), `report`, and `unsubscribe` client-channel operations using the user's BFF-held access token, and forwards the channel id (`X-DIAL-CLIENT-CHANNEL-ID`) into the existing completion relay so Core can correlate signin events to the right conversation stream.
- Add a frontend client-channel provider/hook that opens one subscription per active session, keeps it alive across route navigation and multiple/background conversation generations, reconnects with bounded retries, and cleans up on completion, cancellation, logout, or session end.
- Add a global, non-dismissible toolset sign-in dialog that surfaces pending `toolset/signin` events, lets the user log in (API key or OAuth, reusing the existing Catalog login mechanics) or decline (single or all), and reports the protocol result back through the channel.
- Extract the current Catalog-only API key/OAuth login mechanics (`apps/chat/src/utils/toolsets.ts`, `CatalogView.tsx` login handling) into a reusable app-level `useToolsetLogin` controller shared by Catalog and the new chat dialog, including a way to force-treat locally `SIGNED_IN` credentials as stale (`FAILED`) when Core reports a signin is required, and to logout-before-relogin in that case.
- Add a `liveChatInteraction` feature flag gating the whole mechanism (subscribe attempt, dialog rendering); document fallback behavior when disabled mid-flight.
- **BREAKING**: none — this is additive; existing Catalog/Editor login flows are unaffected except for the internal refactor into a shared controller.

## Capabilities

### New Capabilities

- `client-channel-protocol`: BFF-side subscribe/report/unsubscribe proxying of DIAL Core's client-channel RPC mechanism, SSE relay, channel-id propagation into completion requests, and channel lifecycle/cleanup rules.
- `toolset-signin-interrupt`: Frontend behavior for receiving `toolset/signin` events during a chat completion, presenting a global login dialog, resolving stale/local credential state, and reporting `success`/`denied` back to Core, including concurrency and multi-event handling.

### Modified Capabilities

(none — existing `toolset-authentication` and `catalog-toolset-credentials` requirements for Editor/Catalog login are reused as-is by the new shared controller; no documented requirement in those specs changes. `feature-flags-service` gains a new flag *value*, not a new requirement.)

## Impact

- **Affected code**: `apps/chat-api/src/toolsets/*` (new client-channel module/service), `apps/chat-api/src/conversations/conversation.service.ts` (forward channel id on completion), `apps/chat/src/utils/toolsets.ts` and `apps/chat/src/components/CatalogView/CatalogView.tsx` (extract shared login controller), `apps/chat/src/context/` (new `ClientChannelProvider`), `apps/chat/src/hooks/conversation/useConversationStream.ts` / `GenerationContext.tsx` (channel id plumbing), `apps/chat/src/server-api/chat-stream.api.ts` (send channel id header), a new global dialog component, `apps/chat/src/context/AppConfigContext.tsx` (new feature flag key).
- **APIs**: new BFF endpoints proxying `/v1/ops/client-channel/subscribe|report|unsubscribe`; `POST /api/conversations/completions` gains an outbound `X-DIAL-CLIENT-CHANNEL-ID` header.
- **Dependencies**: relies on `@epam/ai-dial-typescript-sdk`'s existing (PREVIEW) `subscribeClientChannel`/`reportClientChannel`/`unsubscribeClientChannel`/`interactClientChannel` operations — no new package needed.
- **Docs**: `docs/auth/` gains a note that toolset credential login and application OIDC login are separate flows; a new sequence diagram is added under `docs/auth/auth-diagrams/`.
