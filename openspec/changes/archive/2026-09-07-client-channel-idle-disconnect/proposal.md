## Why

`ClientChannelContext`'s SSE subscription to DIAL Core's client-channel (proxied through `apps/chat-api`'s `/api/v1/client-channel/subscribe`) stays open for the entire time a user is on a streaming-capable route, whether or not a completion is actually in flight — a user reading an old conversation for 20 minutes without sending anything still holds one open backend-proxied SSE connection the whole time. Chat 1.0 hit the same "one long-living stream" problem (Issue #7418) and fixed it by tearing the subscription down again once idle. Porting the idle half of that fix reduces needless concurrent open connections through the backend, independent of the unrelated generation-registry memory leak already fixed in PR #8640.

## What Changes

- `GenerationContext` gains a `hasActiveGeneration(): boolean` query over its existing per-path registry, so callers can synchronously ask "is any generation active anywhere in the app right now."
- `useConversationStream`'s `ConversationStreamChannel` capability interface (in `libs/chat-hooks`) gains one new optional callback, `notifyGenerationSettled?: () => void`, invoked from the hook's existing `onComplete`/`onError` cleanup paths — the same places that already call `completeGeneration`. Host-agnostic: the hook only calls an optional prop, exactly like its existing `ensureConnected`/`overlay?.notifyGenerationEnd?.()` calls.
- `ClientChannelContext` implements `notifyGenerationSettled`: when called, if `hasActiveGeneration()` is false, it schedules a disconnect after a short idle grace delay (mirroring chat 1.0's 1000ms); a new generation starting before the timer fires cancels the pending disconnect. If another generation is still active, it does nothing.
- The existing route-leave/flag-disable disconnect and the mount-time eager connect are **not** changed — this adds one additional, earlier disconnect trigger on top of the existing route-scoped lifecycle. Reconnection continues to go through the existing `ensureConnected()` call already made at the start of every completion.

### Modified Capabilities

- `client-channel-protocol`: adds a requirement documenting that the channel is also torn down after a short idle period once no generation is active anywhere in the app (not only on route-leave/flag-disable), and reconnects transparently when a new completion starts.

## Impact

- `apps/chat/src/context/GenerationContext.tsx` — new `hasActiveGeneration()` method.
- `apps/chat/src/context/ClientChannelContext.tsx` — new idle-disconnect timer, wired to `notifyGenerationSettled`.
- `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts` — new optional field on `ConversationStreamChannel`, two new call sites in existing cleanup paths.
- No backend, DTO, or OpenAPI changes. No new HTTP endpoints.
