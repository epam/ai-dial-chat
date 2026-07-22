## Context

DIAL Core added a generic **client-channel** RPC mechanism (`@epam/ai-dial-typescript-sdk` PREVIEW operations `subscribeClientChannel` / `interactClientChannel` / `reportClientChannel` / `unsubscribeClientChannel`, all under `POST /v1/ops/client-channel/*`). `subscribe` returns an SSE stream carrying a channel id in the `X-DIAL-CLIENT-CHANNEL-ID` response header; that id must then be sent with subsequent completion requests so Core can route an RPC event (e.g. `toolset/signin`) to the right subscriber and correlate the eventual `report` back to the right blocked tool call. None of this is used anywhere in `apps/chat-api` today — it is net-new wiring.

Chat already has full toolset login mechanics, but only reachable from two UI surfaces that are *not* completion-time:
- **Toolset Editor** (`openspec/specs/toolset-authentication/spec.md`) — auth-type/login-mode configuration and an OAuth popup/callback handshake, `USER`-level only.
- **Catalog details panel** (`openspec/specs/catalog-toolset-credentials/spec.md`) — a 4-state login/logout/manage UI keyed by admin+public, `USER`/`GLOBAL` levels, with `apps/chat/src/utils/toolsets.ts` holding the OAuth popup/BroadcastChannel mechanics and `CatalogView.tsx` (`handleLogin`, L293-408) holding the login orchestration including "logout first if current status is `FAILED`".

Neither surface is reachable *from inside an active conversation* while a completion is streaming. This change adds a third entry point — a global interrupt dialog — that reuses the same login primitives (`loginToolset`/`logoutToolset` REST calls, OAuth popup handshake) but is driven by Core-pushed events instead of user-initiated navigation.

The frontend completion path (`useConversationStream.ts`, `chat-stream.api.ts`, `GenerationContext.tsx`) already supports multiple concurrent per-conversation generations and survives route navigation because `GenerationProvider` is mounted once above the router in `main.tsx`. The client-channel subscription and the pending-events store need the same lifetime.

## Goals / Non-Goals

**Goals:**
- Let a user resolve a mid-completion toolset credential problem without losing the in-progress conversation or manually finding the toolset in Catalog.
- Reuse existing login primitives (API key REST call, OAuth popup/callback/BroadcastChannel handshake) behind one shared controller instead of forking a second implementation.
- Keep DIAL Core, BFF session, and client-channel protocol knowledge entirely inside `apps/chat-api` and app-level `apps/chat` code — never inside `libs/catalog` or another isolated lib.
- Make the mechanism opt-in via a feature flag so it can ship dark and be enabled per environment.

**Non-Goals:**
- Changing the Catalog/Editor login UX or requirements (`toolset-authentication`, `catalog-toolset-credentials` specs are unchanged).
- Implementing `interactClientChannel` (Core-initiated RPC *requests* sent *to* a channel) — this change only needs Core pushing events to the client and the client reporting responses back, i.e. `subscribe` + `report` + `unsubscribe`. `interact` is out of scope.
- Building a general-purpose pub/sub or notification center; this is scoped to `toolset/signin` events.
- Persisting any per-user toolset credential outside of what already exists server-side in DIAL Core.

## Decisions

### 1. One client-channel subscription per authenticated session, mounted with `GenerationProvider`

A new `ClientChannelProvider` is mounted in `main.tsx` alongside `GenerationProvider`, inside `RequireAuth`, outside per-conversation routing — mirroring the existing pattern that already proves subscriptions can survive route navigation and track multiple/background generations. One subscription is shared for the whole tab, not one per conversation, because `toolset/signin` events are correlated by the DIAL-assigned channel id + event id, not by conversation path.

**Alternative considered**: subscribe per conversation / per completion request. Rejected — Core's channel-id handshake is a connection-level concept (one SSE stream, reused across many completions), and per-conversation subscriptions would multiply reconnect/cleanup logic without a corresponding benefit, since a single browser tab only has one authenticated session.

### 2. Subscribe-before-completion is best-effort, not blocking

The provider starts subscribing as soon as it mounts (session established) and independently of any specific completion. When a completion request is issued, it attaches the current channel id if one is already available; if the subscription is still connecting, the completion proceeds **without** a channel id rather than blocking the send.

**Rationale**: blocking every completion on a channel handshake would add latency and a new failure mode to the core chat path for a feature that only matters when a toolset actually needs interactive login. A `toolset/signin` event simply cannot be delivered for that one request if the channel isn't ready yet, and the user falls back to today's behavior (this is a strict improvement, not a regression, when the flag is enabled but the channel is momentarily down).

**Alternative considered**: delay `sendCompletion` until the channel id is available (with a short timeout). Rejected for the same latency/failure-mode reason; revisit only if product wants the interrupt guaranteed for every completion.

### 3. Reconnect policy

On stream error/close, the provider retries with capped exponential backoff (e.g. 1s → 2s → 4s → 8s, max 5 attempts, then stop until the next completion is issued or the tab regains focus/visibility). Pending events already surfaced in the dialog are **not** discarded on reconnect — the dialog reflects last-known state until either the user resolves them or a fresh event/duplicate arrives. On successful reconnect, Core is expected to replay any events still awaiting a report (see Open Questions — this depends on Core's actual replay semantics, which are not yet confirmed).

### 4. Correlate strictly by event `id`, never by `toolsetId`

The legacy Redux-based reference implementation resolved pending events by matching `toolsetId` and only ever resolved the *first* matching event, silently leaving any additional pending event for the same toolset unresolved. This design keeps a `Map<eventId, PendingSigninEvent>` and requires every login/decline action to carry the specific `eventId` it resolves. A single successful login **may** optimistically resolve *other* pending events for the same `toolsetId` client-side (report `success` for all of them) since a fresh signin for a toolset is genuinely valid for every blocked call waiting on that same toolset — but this resolves each one with its own `report` call, not just the first.

### 5. Shared `useToolsetLogin` controller extracted from `CatalogView`

Move the OAuth/API-key orchestration currently inline in `CatalogView.tsx` (`handleLogin`, logout-before-relogin-on-`FAILED`, notifications) into an app-level hook in `apps/chat/src/hooks/` that both `CatalogView` and the new `ToolsetSigninDialog` call. The hook accepts a `forceStale?: boolean` flag; when true (always the case for a Core-driven signin event, since the event itself is proof that Core-side credentials are invalid even if the local cache says `SIGNED_IN`), it runs `logoutToolset` for the target level before `loginToolset`, exactly like the existing `FAILED`-status branch does today, so the two code paths stay unified rather than duplicating the "clear stale credentials" rule.

**Alternative considered**: have the dialog write a local `FAILED` override into `DeploymentsContext`'s toolset cache before calling the existing hook unmodified. Rejected — mutating shared cache state to fake a status the UI hasn't actually observed is more surprising than passing an explicit intent flag through the controller.

### 6. Global dialog owns queueing UI, not per-conversation UI

`toolset/signin` events are rendered in one global, non-dismissible modal (mounted at the same authenticated-app level as other global surfaces), not inline in the conversation that triggered them — because the triggering conversation may be in the background (per Decision 1, the channel is tab-wide) and the user may need to resolve it before returning to that conversation. The dialog lists all pending events (potentially across multiple toolsets/conversations) as rows; only the row currently being processed is disabled, the rest remain actionable, so one slow OAuth popup doesn't block declining an unrelated event.

### 7. BFF client-channel module structure

New `apps/chat-api/src/client-channel/` domain (no `modules/` wrapper, per `apps/chat-api/AGENTS.md`):
- `client-channel.controller.ts` — thin controller: `POST /api/v1/client-channel/subscribe` (SSE relay), `POST /api/v1/client-channel/report`, `POST /api/v1/client-channel/unsubscribe`. Versioned like other business endpoints.
- `client-channel.service.ts` — calls the SDK's `subscribeClientChannel`/`reportClientChannel`/`unsubscribeClientChannel` with the session's bearer token; relays the SSE body directly to the browser response without buffering; propagates `X-DIAL-CLIENT-CHANNEL-ID` both directions; cancels the upstream reader on `req.on('close')`.
- `dto/` — `ReportClientChannelDto` (validated `RpcResponse` shape: event `id` + `result: 'success' | 'denied'`), channel id validated as a DTO-level `@Matches` allowlist string (Core-issued opaque id, treat as untrusted input).
- `ConversationService.streamCompletion` gains an optional `clientChannelId` passed through from the controller and forwarded as `X-DIAL-CLIENT-CHANNEL-ID` on the upstream completion call — additive parameter, no change to today's documented completion persistence requirements (`backend-owned-generation-persistence` spec is unaffected).

This mirrors the existing thin-controller/service/DTO pattern already used by `themes` and `toolsets`.

### 8. Feature flag: `liveChatInteraction`

Read via `useFeatureFlag('liveChatInteraction')` against `AppConfigContext`'s server-supplied `features` map (same mechanism as existing flags — no new registry). Default `false` until explicitly enabled per environment. Gates: (a) whether `ClientChannelProvider` even attempts to subscribe, (b) whether the completion request attaches a channel id, (c) whether the dialog can render. If the flag flips to `false` while a channel is active (e.g. config hot-reload), the provider unsubscribes and clears pending events; any in-flight completion that already sent a channel id is unaffected (Core will simply get no report and should time out/fail that tool call per its own policy).

The backend also enforces this flag as defense in depth: `subscribe` and `report` are guarded by the existing `FeatureGuard`/`@RequireFeature(FeatureKey.LiveChatInteraction)` mechanism and return `403` when the flag resolves to `false` for the caller (a frontend-only gate would let a role-restricted or fully-disabled user reach the API directly). `unsubscribe` is deliberately left unguarded so a client that already holds a channel can always tear it down — including the exact "flag flips to false while a channel is active" cleanup call this design already relies on.

The legacy reference implementation gated this only by the feature flag and passed the channel id for all application-type deployments, without checking `deployment.features.tools` — the current deployment listing DTO does not expose a per-deployment "supports tools" signal, so this design **keeps that behavior**: the flag is the only gate, and the real authority on whether a signin is ever needed is the `toolset/signin` event itself arriving or not.

## Risks / Trade-offs

- **[Risk] SSE relay without buffering can leak a response stream if the browser disconnects mid-relay.** → Mitigation: `client-channel.service.ts` must register `req.on('close')`/`res.on('close')` to abort the upstream fetch/reader; covered explicitly in backend test tasks.
- **[Risk] `interactClientChannel`/`reportClientChannel` accept an opaque Core-issued channel id and event id; treating these as trusted without validation risks header/log injection.** → Mitigation: DTO-level allowlist validation on both ids before they're logged or forwarded; never log full RPC payloads, only ids and toolset refs (matches the existing `loginToolset`/`logoutToolset` logging discipline).
- **[Risk] A completion whose channel id arrives after the request was already sent leaves that specific tool call unable to receive a signin prompt.** → Mitigation: accepted per Decision 2; document as a known gap rather than adding latency to every completion. Revisit if product wants a stronger guarantee.
- **[Risk] Reusing the Catalog OAuth popup/BroadcastChannel mechanism from a global (non-Catalog-page) dialog changes the popup's opener context.** → Mitigation: the mechanism already only depends on `window.open` + `sessionStorage` + `BroadcastChannel`, none of which depend on the Catalog route being mounted; verify with a task specifically exercising the dialog from a non-Catalog route.
- **[Risk] Optimistically resolving multiple pending events for the same toolset (Decision 4) could report `success` for an event whose specific blocked tool call actually needs different credentials/scope.** → Mitigation: only apply this when the same `credentialsLevel` was used for the login that generated the successful report; otherwise leave other events pending. Flagged in Open Questions for product confirmation.

## Migration Plan

- No data migration. Ships behind `liveChatInteraction` (default off).
- Rollout: enable in a lower environment first, verify via the sequence in the proposal's Documentation section, then enable more broadly per the existing environment-config process (not a schema change).
- Rollback: disabling the flag fully disables subscription attempts and dialog rendering; no persisted state needs cleanup since nothing is written to storage beyond the existing per-toolset OAuth `sessionStorage` key (already scoped to the popup and already cleared on use).

## Open Questions

1. Does DIAL Core replay undelivered/unresolved `toolset/signin` events on reconnect with the same channel id, or does a dropped connection lose them until the next tool call attempt? This determines whether "resume pending events across reconnect" (Decision 3) needs additional client-side persistence or is purely a Core-side guarantee.
2. Should the current deployment listing DTO be extended with a tool-capability signal so the frontend can pre-gate channel subscription by `deployment.features.tools`, or is keeping only the feature-flag gate (Decision 8, matching legacy behavior) acceptable long-term?
3. For `Decline all` partial failures (some `report` calls fail), should the dialog retry automatically, or surface a per-row error and require the user to retry each one explicitly?
4. Should a successful login for one pending event auto-resolve other pending events for the *same toolset and same credentials level* (Decision 4), or should every event always require its own explicit user action even when they're for the same toolset?
5. Should `/api/v1/client-channel/*` endpoints be part of the generated OpenAPI client, or does the SSE `subscribe` endpoint require a raw frontend `fetch` (like `chat-stream.api.ts` does today) with only `report`/`unsubscribe` going through the generated client?
6. Is a 5-attempt capped-backoff reconnect policy (Decision 3) acceptable, or does product want indefinite retry with a visible "reconnecting" indicator?
