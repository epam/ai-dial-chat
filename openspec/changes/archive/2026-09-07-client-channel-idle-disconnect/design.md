## Context

`ClientChannelContext` (`apps/chat/src/context/ClientChannelContext.tsx`) opens an SSE subscription to DIAL Core's client-channel (proxied through `apps/chat-api`'s `ClientChannelController`) whenever the current route is streaming-capable (`/conversations/*` or `/apps-editor`) and the `liveChatInteraction` flag is enabled. It stays connected for the entire time the user remains on such a route — including long stretches where the user is only reading a past conversation, not sending anything — and only tears down on route-leave, flag-disable, or unmount (`client-channel-protocol` spec, "liveChatInteraction feature flag gates the mechanism" requirement).

Chat 1.0 hit an equivalent problem (Issue #7418) and fixed it with a per-completion subscribe plus an idle-unsubscribe grace window (`unsubscribeWhenIdleEpic`, 1000ms after `streamMessageSuccess`, cancelable if another stream starts, gated on no conversation anywhere still streaming). This change ports only the idle-teardown half: an additional disconnect trigger that fires once nothing is generating anywhere in the app, layered on top of the existing route-scoped connect/disconnect lifecycle (which is left unchanged).

The frontend already has an app-wide, cross-navigation generation registry — `GenerationContext` (`apps/chat/src/context/GenerationContext.tsx`), a `Map<string, GenerationEntry>` keyed by conversation path with `Active`/`Done` status, mounted in `apps/chat/src/main.tsx` as the parent of `ClientChannelProvider`. This is the natural source of truth for "is anything streaming right now," reachable from `ClientChannelProvider` via `useGeneration()`.

## Goals / Non-Goals

**Goals:**
- Disconnect the client-channel subscription after a short idle grace period once no generation is active anywhere in the app, reducing the number of concurrently open, unused SSE connections proxied through `apps/chat-api`.
- Reconnect transparently and correctly the next time a completion starts, with no user-visible behavior change (toolset sign-in events still reach the dialog, `waitForChannel`'s bounded wait already tolerates a fresh subscribe).
- Keep `libs/chat-hooks` host-agnostic: `useConversationStream` only gains one new optional callback on the existing `ConversationStreamChannel` interface, mirroring the existing `ensureConnected`/`overlay?.notifyGenerationEnd?.()` pattern already in that file.

**Non-Goals:**
- Changing the eager connect-on-mount behavior (subscribing as soon as a streaming-capable route mounts, before any completion is sent). Chat 1.0's fix also made subscribe itself lazy (per-completion); this change deliberately keeps today's mount-time eager connect, since it is covered by an existing spec requirement and passing tests, and folding both changes together increases risk for less-clear benefit. A future change can revisit this if idle-disconnect alone doesn't sufficiently reduce open-connection counts.
- Any change to the backend (`apps/chat-api/src/client-channel/**`), the SSE relay/proxy behavior, or the `client-channel-protocol` request/response contracts.
- Any change to the reconnect-with-backoff logic for a *failed* connection attempt (`RECONNECT_DELAYS_MS`) — idle-disconnect is a clean, voluntary teardown of a healthy connection, not a failure path.
- Cross-tab/cross-window coordination — `hasActiveGeneration()` only sees generations started by this same browser tab's React tree (this matches `GenerationContext`'s existing scope; it is not a multi-tab registry).

## Decisions

**1. Source the "is anything streaming" signal from `GenerationContext`, not a new parallel registry.**

`GenerationContext.hasActiveGeneration(): boolean` iterates the existing `registryRef.current` map and returns true iff any entry has `status === ClientGenerationStatus.Active`. This reuses the exact registry that already tracks generation lifecycle across navigation (the reason the doc comment on `ConversationGenerationLifecycle` calls it "cross-navigation `AbortController` ownership") instead of introducing a second source of truth that could drift from it.

*Alternative considered:* have `ClientChannelContext` independently track "is a completion active" via its own boolean state, set/cleared by callers. Rejected — `GenerationContext` already exists as the shared, app-wide, cross-navigation-safe answer to this exact question; duplicating it invites the two to disagree.

**2. Notify via a new optional `ConversationStreamChannel.notifyGenerationSettled` callback, called from `useConversationStream`'s existing `onComplete`/`onError` paths — not a `useEffect` watching `GenerationContext` from inside `ClientChannelContext`.**

`GenerationContext`'s registry is a plain ref (`useRef`), not reactive state — it does not re-render subscribers when an entry's status changes, so there is nothing for a `useEffect` in `ClientChannelContext` to depend on. The generation-ending event is only observable at the point `useConversationStream` itself calls `completeGeneration`/handles the error — so that hook calls the new optional `channel?.notifyGenerationSettled?.()` once, right after its existing cleanup, in both `onComplete` and `onError`. This mirrors the existing `overlay?.notifyGenerationStart?.()`/`overlay?.notifyGenerationEnd?.()` calls already in the same function for the same reason (host-agnostic, optional, called at a well-defined lifecycle point).

*Alternative considered:* make `GenerationContext`'s registry emit change events (e.g. an internal `EventTarget`/callback list) that `ClientChannelContext` subscribes to. Rejected as unnecessary indirection — `useConversationStream` already sits at exactly the right point in the call stack and already threads a `channel` capability object through for this class of notification; adding a second, registry-level pub/sub mechanism duplicates that wiring for no added correctness.

**3. `ClientChannelContext` schedules the idle-disconnect internally, gated by `hasActiveGeneration()`, with a cancelable `setTimeout` mirroring chat 1.0's 1000ms grace window.**

On `notifyGenerationSettled()`:
- If `useGeneration().hasActiveGeneration()` is `true`, do nothing (another conversation/path is still streaming — most relevant when the user has navigated away from a still-generating conversation to a different one, per `GenerationContext`'s cross-navigation design).
- Otherwise, clear any existing idle-disconnect timer and schedule a new one (`IDLE_DISCONNECT_DELAY_MS = 1000`, a module constant named and valued the same as chat 1.0's `UNSUBSCRIBE_IDLE_DELAY_MS` for continuity) that calls the existing internal `disconnect()`.
- `ensureConnected()` (already called at the start of every completion) clears any pending idle-disconnect timer as its first step, so a new completion starting inside the grace window cancels the scheduled teardown — the same effect as chat 1.0's `takeUntil(streamMessage)`.

Reconnection after an idle-disconnect needs no new code: `disconnect()` already resets `abortControllerRef.current`/`channelIdRef.current` to `null`, which is exactly the state `ensureConnected()`'s existing guard (`if (abortControllerRef.current || channelIdRef.current) return;`) requires to proceed to `connect()`. This was verified by tracing the existing implementation rather than assumed.

**4. The idle timer is a new ref (`idleDisconnectTimeoutRef`), cleared in the same places `retryTimeoutRef` already is: on `ensureConnected`, on `disconnect`, and in the main lifecycle effect's unmount/route-change cleanup.**

Keeps the new timer's lifecycle symmetric with the existing backoff-retry timer already in this file, rather than inventing a different cleanup convention.

## Risks / Trade-offs

- **[Risk]** A completion that finishes and is immediately followed (just past the 1000ms grace) by another completion pays a fresh subscribe round-trip instead of reusing a warm channel. → **Mitigation**: this is the same trade-off chat 1.0 already accepted and shipped; `waitForChannel`'s existing bounded wait (20s) already tolerates a completion starting before its channel is ready, so the user-visible cost is, at most, a `toolset/signin` event arriving slightly later within an already-tolerated window — not a dropped event.
- **[Risk]** `hasActiveGeneration()` only reflects this tab's own `GenerationContext` — if the same account is generating in a second browser tab, this tab's idle-disconnect logic has no visibility into that and may still disconnect its own channel. → **Mitigation**: acceptable — each tab holds its own independent client-channel subscription today (channel ids are not shared across tabs), so this matches the existing per-tab scope of the whole mechanism; it is not a regression.
- **[Trade-off]** Adds one more optional capability to the already-multi-capability `ConversationStreamChannel`/`useConversationStream` surface. Kept minimal (one method, called from two existing call sites) to limit the added surface area.
- **[Risk — discovered during implementation]** `Conversation.tsx` memoizes its `channel` object on `channelId` (among other fields), which flows into `useConversationStream`'s `startStream` (whose `useCallback` deps include `channel?.channelId`/`channel?.notifyGenerationSettled`), which flows into `loadConversation`'s own `useCallback` deps (it calls `startStream` to auto-resume an awaiting generation). Before this change, `channelId` rarely changed after initial mount, so `loadConversation`'s identity was effectively stable. With idle-disconnect now cycling `channelId` (null → id → null) around every message, `loadConversation` is recreated on that same cadence — and `Conversation.tsx`'s mount-load effect was keyed on `[conversationId, loadConversation]`, so it refired on every cycle, re-fetching the conversation from the server (visible as a spinner before/after every message — a full reload, not just a re-render). → **Mitigation**: the mount-load effect now depends only on `[conversationId]` and calls the latest `loadConversation` through a ref (updated in its own zero-dependency effect each render), the standard "latest callback via ref" pattern — it no longer re-runs for churn in any of `loadConversation`'s other dependencies, channel-related or not. Audited the rest of `Conversation.tsx`'s effects for the same shape (an effect keyed on a callback that transitively depends on `channel`/`startStream`); none of the others do (`AppPreviewChat.tsx` has no equivalent mount-load effect either).

## Migration Plan

No data migration; purely client-side behavioral change behind existing `liveChatInteraction` feature flag gating (unaffected — the flag still gates whether the mechanism runs at all). Rollback is a plain revert. No coordination needed with the backend or other apps.

## Open Questions

None — the reconnect path was verified against the existing implementation rather than assumed, and the idle delay value is a direct, intentional port of chat 1.0's already-proven constant.
