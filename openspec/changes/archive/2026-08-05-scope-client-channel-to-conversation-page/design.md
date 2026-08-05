## Context

`ClientChannelProvider` (`apps/chat/src/context/ClientChannelContext.tsx`) is mounted once at the
app root in `apps/chat/src/main.tsx` (inside `RequireAuth`, wrapping every non-login route). Its
connect/disconnect effect (lines 256–271) is keyed only on `isEnabled` (`useFeatureFlag`
`liveChatInteraction`). Once the flag is on, the provider opens an SSE fetch via
`subscribeClientChannel` and keeps it alive — with capped exponential-backoff reconnect
(`RECONNECT_DELAYS_MS`) and a `visibilitychange` resume listener — for the entire authenticated
session, on every page (Catalog, FileManager, ToolsetEditor, ScheduledTasks, CustomAppEditor, etc.).

`toolset/signin`/`external_service/signin` RPC events, however, are only ever pushed by DIAL Core
while a completion is streaming and a tool/app calls an external service requiring interactive
auth. Streaming only happens from two call sites of `useConversationStream`
(`apps/chat/src/hooks/conversation/useConversationStream.ts`):
`apps/chat/src/pages/Conversation/Conversation.tsx` (mounted only at `ROUTES.Conversations` =
`/conversations/*`) and `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx` (route
`ROUTES.AppsEditor` = `/apps-editor`, the custom-app test-chat preview). `ROUTES.Root` (`/`) is
**not** streaming-capable: it renders `ConversationRoute`/`NewConversationComposer` — the
pre-conversation empty state — which creates a new conversation via a plain REST call and
navigates to `/conversations/<id>` *before* any stream starts, so it never itself hosts a live
stream. This matches the
legacy Redux epics behavior on `development`: `ChatEventsActions.init()` in
`settings.epics.ts` was dispatched only for `PageType.Chat` and `PageType.AppsEditor`, and the
actual subscribe/unsubscribe lifecycle in `conversations.epics.ts` was driven per-send
(`sendMessageEpic`'s `shouldSubscribe`) and torn down ~1s after idle (`unsubscribeWhenIdleEpic`).

`ClientChannelProvider` is mounted inside `BrowserRouter` already (see `main.tsx`), so it can call
router hooks (`useMatch`, `useLocation`) directly without needing route params passed down from a
`<Route element>`. `apps/chat/src/app/app.tsx` (lines 213–215) computes a related but broader
`isConversationRoute` via `useMatch(ROUTES.Root)` / `useMatch(\`${ROUTES.Conversations}/*\`)` for a
different purpose (whether to show the sources/attachment side panel, which is also wanted on the
pre-conversation composer at `/`) — this design reuses the `useMatch` mechanism but intentionally
excludes `ROUTES.Root` from its own boolean, since `/` never streams.

## Goals / Non-Goals

**Goals:**

- The client-channel SSE connection is only open while the user is on a streaming-capable page
  (`/conversations/*` or `/apps-editor`) AND the `liveChatInteraction` flag is enabled.
- Navigating away from a streaming-capable page disconnects the channel (calls
  `unsubscribeClientChannel`, clears pending events) exactly like the existing flag-disabled path
  already does.
- Navigating back to a streaming-capable page (flag still enabled) reconnects, same as today's
  flag-enabled mount behavior.
- No change to reconnect/backoff timing, RPC parsing, or the `report`/`unsubscribe` BFF contract.

**Non-Goals:**

- Not replicating the legacy's per-send-triggered subscribe or the 1-second idle-teardown timer.
  Gating on page presence (a coarser, simpler condition than "is a stream literally in flight") is
  sufficient: it already excludes every non-streaming-capable page, and within a streaming-capable
  page `ensureConnected()` still nudges a reconnect right before each `streamCompletion` call.
- Not touching `apps/chat-api` — this is a frontend-only lifecycle change.
- Not changing which pages exist or adding a new `PageType`-style enum; reusing route matching is
  sufficient and keeps this change additive to `ClientChannelContext.tsx` only.

## Decisions

**Gate via `useMatch` inside `ClientChannelProvider`, not a new prop from `main.tsx`.**
`ClientChannelProvider` already sits inside `BrowserRouter` (`main.tsx` lines 47–97), so it can
call `` useMatch(`${ROUTES.Conversations}/*`) `` and `useMatch(ROUTES.AppsEditor)` directly,
combining them into a single `isStreamingCapablePage` boolean, using the same `useMatch` mechanism
`app.tsx`'s `isConversationRoute` uses (without reusing its exact boolean, since that one also
includes `ROUTES.Root` for an unrelated side-panel purpose). This avoids threading a new prop
through `main.tsx`'s provider stack and avoids depending on `apps/chat/src/app/app.tsx` (a
sibling/descendant component) for gating logic used before `App` even renders.

*Alternative considered:* move `ClientChannelProvider` down into `App`/`Conversation`'s route
tree so it only mounts on the conversation page. Rejected — `AppPreviewChat` (AppsEditor) is a
separate route subtree from `Conversation`, so the provider would need to be duplicated or lifted
to a common ancestor anyway; and unmounting/remounting the whole provider on every navigation
would drop `pendingEvents` state and force a fresh `channelId` more aggressively than the existing
flag-toggle teardown does. Keeping the provider mounted once and gating its *connection* (not its
mount) reuses the already-correct disconnect/reconnect machinery (lines 239–271) with one extra
condition.

**Combine the page check into the same `isEnabled`-shaped condition, not a parallel effect.**
Rename the internal `isEnabled` boolean's usage sites minimally: introduce
`isActive = isEnabled && isStreamingCapablePage` and use `isActive` everywhere `isEnabled`
currently gates connect/disconnect/reconnect/visibility-resume (`isEnabledRef`, the mount effect at
line 256, `scheduleReconnect`, `ensureConnected`, the `visibilitychange` listener at line 273).
This keeps a single source of truth for "should the channel be open" instead of adding a second
independent effect that could race with the flag-driven one.

*Alternative considered:* keep `isEnabled` as-is and add a second `useEffect` that calls
`disconnect()`/`connect()` based on the route. Rejected — two effects independently calling
`connect`/`disconnect` on the same refs is exactly the kind of race the existing single-effect
design (with `isStoppedRef`/`abortControllerRef` guards) was built to avoid; one derived boolean is
simpler and safer.

**Streaming-capable routes = `Conversations` (`/conversations/*`) and `AppsEditor`
(`/apps-editor`) only — `Root` (`/`) is deliberately excluded.** These are exactly the two current
call sites of `useConversationStream`, and match the legacy `PageType.Chat`/`PageType.AppsEditor`
scoping. `ROUTES.Root` renders `ConversationRoute`, the pre-conversation composer/empty state; it
creates a new conversation via a plain REST call (`apiCreateConversation`/`saveConversation`) and
navigates to `/conversations/<id>` *before* any stream exists — so `/` itself never hosts a live
stream and including it would open a channel with no possible event to receive. `ToolsetEditor`,
`CustomAppEditor`, `Catalog`, `FileManager`, `ScheduledTasks`, etc. are excluded for the same
reason: none of them stream completions.

## Risks / Trade-offs

- **[Risk]** A completion in flight when the user navigates away mid-stream (e.g. clicking to
  another conversation route that still matches `Conversations`, or navigating fully off the
  streaming-capable routes while a background stream continues) could have its channel torn down
  before a late `toolset/signin` event arrives. → **Mitigation:** `Conversations` is matched with
  a wildcard (`/conversations/*`), so switching between conversations keeps the channel open;
  fully leaving the app's chat/editor surface while a stream is still active is an edge case the
  legacy implementation also did not special-case beyond its 1s idle grace window, and is
  acceptable per the proposal's scope (page-level gating, not per-stream tracking).
- **[Risk]** Rapid navigation across streaming-capable routes (e.g. React Router transitioning
  through intermediate matches) could cause disconnect/reconnect churn. → **Mitigation:** the
  existing `connect()` guard (`if (abortControllerRef.current) return;`) and `disconnect()`
  idempotency already tolerate rapid toggles; no new debouncing is introduced since `isEnabled`
  toggles (feature flag flips) already exercise this same path today.

## Migration Plan

Frontend-only, no data migration. Ship behind the existing `liveChatInteraction` flag (no new
flag). Rollback is a plain revert of the `ClientChannelContext.tsx` change.
