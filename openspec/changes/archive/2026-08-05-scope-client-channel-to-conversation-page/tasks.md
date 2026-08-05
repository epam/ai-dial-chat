## 1. Route-scope the client channel connection

- [x] 1.1 In `apps/chat/src/context/ClientChannelContext.tsx`, add `useMatch` calls (from `react-router`) for `` `${ROUTES.Conversations}/*` `` and `ROUTES.AppsEditor` (deliberately excluding `ROUTES.Root`, which never itself hosts a live stream), combined into a single `isStreamingCapablePage` boolean, importing `ROUTES` from `apps/chat/src/types/routes.ts`.
- [x] 1.2 Derive `isActive = isEnabled && isStreamingCapablePage` and replace `isEnabled`/`isEnabledRef` with `isActive`/`isActiveRef` at every gating site: the ref-sync effect (lines 94–97), `scheduleReconnect` (line 174), `connect` (line 186), `ensureConnected` (line 220), the mount connect/disconnect effect (lines 256–271), and the `visibilitychange` resume effect (lines 273–284).
- [x] 1.3 Verify the mount effect's dependency array and cleanup still disconnect correctly when `isActive` flips to `false` for either reason (flag disabled OR route no longer streaming-capable).

## 2. Tests

- [x] 2.1 Add/update tests in `apps/chat/src/context/tests/ClientChannelContext.spec.tsx` (or equivalent existing test file) covering: flag enabled + non-streaming route (including bare `/`) → no subscribe; flag enabled + `/conversations` or `/apps-editor` → subscribes; navigating from a streaming-capable route to a non-streaming-capable route → unsubscribes and clears pending events; navigating back → reconnects; navigating between `/conversations/*` sub-paths → no disconnect/reconnect churn.
- [x] 2.2 Update `apps/chat/src/hooks/conversation/useConversationStream.spec.ts` if the `ensureConnected` mock/expectations assume the channel is always connected regardless of route. (No change needed — this spec already mocks `useClientChannel` directly, bypassing route derivation entirely.)

## 3. Verification

- [x] 3.1 `npm exec nx test chat`
- [x] 3.2 `npm exec nx lint chat`
- [x] 3.3 `npm exec nx build chat`
- [x] 3.4 Manually verify in the running app: open `/`, `/files`, or `/catalog` with `liveChatInteraction` enabled and confirm no client-channel SSE request fires in the network tab; navigate into an actual conversation under `/conversations/<id>` and confirm it does.
