## 1. Pin the channel while a sign-in event is unresolved

- [x] 1.1 In `apps/chat/src/context/ClientChannelContext.tsx`, add `hasPendingEvents()` (the event map's size) and `isChannelWanted()` (`isActiveRef.current || hasPendingEvents()`), with the comment explaining why an unresolved event is not an idle channel.
- [x] 1.2 Split the idle timer out of `notifyGenerationSettled` into `scheduleIdleDisconnect()`, and re-check `hasActiveGeneration() || hasPendingEvents()` inside the timer callback before disconnecting (design.md Decision 4).
- [x] 1.3 Make `notifyGenerationSettled` clear any armed timer and return when events are pending, instead of scheduling a disconnect (design.md Decision 1).
- [x] 1.4 Gate `connect()` and `scheduleReconnect()` on `isChannelWanted()` instead of `isActiveRef.current`, leaving `ensureConnected`/`waitForChannel` on the strict check (design.md Decision 6).

## 2. Keep the pin across route changes without leaking it

- [x] 2.1 Move the route/flag effect's teardown from its cleanup into the effect body, and add a separate `[]`-dependency effect (reading a `disconnectRef`) for the unmount-only teardown (design.md Decision 3).
- [x] 2.2 In the effect body, skip the teardown when `isEnabled && hasPendingEvents()`; add `isEnabled` to the effect's dependencies so a flag flip while already off-route still tears down (design.md Decision 2).
- [x] 2.3 In `reportEvent`, once the report succeeds and the map is empty, disconnect immediately if the route/flag is no longer active, otherwise arm the idle disconnect when nothing is generating (design.md Decision 5).

## 3. Tests

- [x] 3.1 Split the existing "unsubscribes and clears pending events when navigating off a streaming-capable route" case into a nothing-pending case (teardown unchanged) and "keeps the channel and the pending events when navigating off a streaming-capable route with an unresolved signin event".
- [x] 3.2 Add "tears the pinned channel down once the last event is resolved off-route" — report from `/files`, assert the report lands on the pinned channel id and the unsubscribe follows.
- [x] 3.3 Add "does not disconnect while a signin event is still unresolved" — event pending, generation settles, advance 5000ms, assert no unsubscribe and the event still listed.
- [x] 3.4 Add "cancels a scheduled disconnect when a signin event arrives inside the grace window" — settle, advance 500ms, push the event, advance past 1000ms.
- [x] 3.5 Add "resumes the idle countdown once the last event is resolved" — resolving on-route with nothing generating disconnects 1000ms later.
- [x] 3.6 Confirm the pre-existing cases still pass unchanged: flag-flip-off clears pending events, unmount fires no stray timer, idle disconnect/reconnect without events.

## 4. Docs and verification

- [x] 4.1 Update the teardown note in `docs/auth/auth-diagrams/08-toolset-signin-interrupt.mmd`, which listed only logout/tab-close/flag-off, to cover route-leave and idle disconnect plus the unresolved-event pin.
- [x] 4.2 `npm run test:file -- apps/chat/src/context/tests/ClientChannelContext.spec.tsx`
- [x] 4.3 `npm exec nx lint chat` and `npm run verify:changed`
