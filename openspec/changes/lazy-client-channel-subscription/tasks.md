**Slicing strategy: risk-first.** The two pre-existing defects that demand-driven subscribe
promotes from rare to routine (connection-ownership races, and sending a cancelled completion
after its channel wait resolves) land and are verified **before** the lifecycle inversion, in
separate commits. A regression in observable behavior can then be bisected to the lifecycle
slice rather than to a defect fix, and §Slice 1–2 are independently revertible if the
lifecycle change has to be rolled back on its own (`design.md` §Migration Plan, option 2).

Every slice is independently verifiable. Run the exact `npm run test:file` commands named in
each task's Verification; run `npm run verify:changed` once per completed slice, not per edit;
close the change with exactly one `npm run verify:full`. No `npm run build:quiet` (no bundling
surface changes) and no `npm run openapi` (no endpoint contract changes).

## 1. Connection ownership generations (risk-first, no lifecycle change)

- [ ] 1.1 Add a `connectionGenerationRef` to `ClientChannelProvider`
      (`apps/chat/src/context/ClientChannelContext.tsx`). Capture its value at `connect()` entry;
      increment it in `disconnect()`. Guard every post-`await` write in `connect()` — `attemptRef`,
      `channelIdRef`, `setChannelId`, `resolveChannelWaiters`, `scheduleReconnect()`, and the
      `abortControllerRef.current = null` assignments — on both a still-current generation and the
      existing `controller.signal.aborted` check. Move the `abortControllerRef.current = null`
      writes (currently unconditional at `ClientChannelContext.tsx:268` and `:272`) **inside** that
      guard, and additionally assert the ref still holds this connection's own controller before
      clearing it. Cancel the response body of a subscribe that resolves into a stale generation.
- [ ] 1.2 Add regression tests to `apps/chat/src/context/tests/ClientChannelContext.spec.tsx`:
      an aborted connect's late rejection does not clear a newer connection's controller and does
      not enable a duplicate subscribe; an aborted connect's late success does not install a stale
      channel id, does not resolve waiters with it, and does not read its stream; a superseded
      connection schedules no reconnect; repeated `disconnect()` leaves no timer, waiter, reader, or
      controller and does not throw; StrictMode double-mount leaves the first mount's work inert.
      Query by observable effects (mock call counts, exposed `channelId`), not internal refs.

      **Verification:** `npm run test:file -- apps/chat/src/context/tests/ClientChannelContext.spec.tsx`
      then `npm run verify:changed`.

## 2. Cancellation re-check in the completion hook (risk-first, no lifecycle change)

- [ ] 2.1 In `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`,
      inside `send()` (`:437-456`), re-check after the channel wait resolves and before calling
      `transport.streamCompletion`: return silently if `controller.signal.aborted` or
      `isSuperseded()`. Use only the `AbortController` returned by the host-supplied
      `startGeneration` (`:284`) and the existing `isSuperseded()` predicate (`:283`). Do **not**
      route the suppressed send through `completionOptions.onError` — Stop and re-submit already ran
      their own cleanup, and an error bubble would misreport a deliberate cancellation. Add a short
      block comment explaining why the re-check exists (the wait now suspends on a cold subscribe).
- [ ] 2.2 **Library isolation guard.** Confirm the change adds no host-owned knowledge to
      `libs/chat-hooks`: no `/api` path, no generated-client or `server-api` import, no app context,
      no auth/session/cookie/env read, no feature flag, no route or navigation knowledge, no
      analytics/telemetry/logging client, no storage key, and no new member on
      `ConversationStreamChannel` (`:99-106`) — demand stays behind the existing host-supplied
      `waitForChannel`/`ensureConnected` callbacks, so the lib never learns a channel is lazy,
      shared, or pinned.
- [ ] 2.3 Add tests to
      `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`:
      a completion stopped while its channel wait is outstanding is never sent once the wait
      resolves, and writes no stream-error message; a completion superseded by a re-submit while
      waiting is not sent while the newer generation's request is; a still-wanted completion is sent
      with the resolved channel id; the 20 000 ms `CHANNEL_WAIT_TIMEOUT_MS` is still what the hook
      passes; a `null` resolution still sends without a channel id.

      **Verification:** `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`
      then `npm run verify:changed`.

## 3. Demand registry, wired but not yet authoritative

- [ ] 3.1 Add the demand registry to `ClientChannelProvider`: a `demandRef` holding a counted set
      of opaque internal tokens, with internal `acquireDemand()` / `releaseDemand(token)` /
      `hasDemand()` helpers. Keep it strictly internal — do **not** add it to
      `ClientChannelContextValue` (`ClientChannelContext.tsx:38-54`), so the context surface and
      `libs/chat-hooks`'s `ConversationStreamChannel` shape are unchanged. Have `ensureConnected()`
      and `waitForChannel()` acquire demand when their existing flag-and-route check passes (and
      acquire none when it fails), and have `notifyGenerationSettled()` release it. Do **not** yet
      change what `connect()` requires — after this task the provider still connects eagerly, so
      the existing suite must stay green.
- [ ] 3.2 Extract a shared test helper in
      `apps/chat/src/context/tests/ClientChannelContext.spec.tsx` that creates demand the way a
      completion does (calling `waitForChannel`/`ensureConnected` through the exposed context),
      and convert the existing cases that currently rely on eager subscribe *incidentally* — event
      parsing (`:143`, `:166`, `:193`, `:215`), dedup (`:247`), report success/failure (`:266`,
      `:293`, `:319`), backoff (`:556`), and the idle-disconnect group (`:588`-`:891`) — to obtain
      their channel through that helper rather than through mount. Keep every assertion's intent
      intact; this task changes only how each test gets a channel, so it must pass both before and
      after Slice 4.

      **Verification:** `npm run test:file -- apps/chat/src/context/tests/ClientChannelContext.spec.tsx`
      then `npm run verify:changed`.

## 4. Invert the lifecycle: demand triggers, eligibility gates

- [ ] 4.1 Redefine `isChannelWanted()` (`ClientChannelContext.tsx:199-202`) as
      `(isActiveRef.current && hasDemand()) || hasPendingEvents()`, so the pending-event term still
      permits reconnect off-route. Apply it in `connect()`'s entry guard (`:249`) and
      `scheduleReconnect()` (`:237`). Reset `attemptRef` when fresh demand is acquired, so a
      completion after an exhausted retry budget starts a clean attempt.
- [ ] 4.2 Remove the connect half of the route/flag effect (`:422-423`), keeping its teardown half
      (`:409-420`) byte-for-byte: `!isActive` still disconnects unless the flag is on and events are
      pending. Keep the `useLayoutEffect` eligibility-ref sync (`:122-126`) — a child page's mount
      effect calling `waitForChannel` in the same commit as the route becoming eligible must not
      read a stale `false`. Keep the cleanup-only unmount effect (`:427-434`) unconditional.
- [ ] 4.3 Remove the `visibilitychange` effect (`:436-447`) entirely. It is the only remaining path
      that resurrects an idle channel, and it also clears `resolvedIdsRef` (`:297`) on every tab
      focus, resetting sign-in dedup state. Confirm `resolvedIdsRef` is still cleared where it
      should be — at the start of a new completion inside `ensureConnected()` (`:288-297`) — and that
      the reason comment there survives the edit.
- [ ] 4.4 Add `hasDemand()` to `scheduleIdleDisconnect()`'s fire-time re-check (`:337`), so it reads
      `hasActiveGeneration() || hasPendingEvents() || hasDemand()`. Leave
      `IDLE_DISCONNECT_DELAY_MS` at 1000 (`:36`) and leave `ensureConnected()`'s
      `clearIdleDisconnectTimeout()` as its first step (`:285`). Add the same demand term to the
      post-report resume path in `reportEvent` (`:462-472`), so resolving the last event does not
      schedule a disconnect while a completion still holds demand.
- [ ] 4.5 Have `disconnect()` clear the demand registry (alongside `eventsMapRef` and
      `resolvedIdsRef`, `:318-319`), so flag-disable, logout, and unmount cannot leak demand into a
      pinned-open channel.

      **Verification:** `npm run test:file -- apps/chat/src/context/tests/ClientChannelContext.spec.tsx`
      then `npm run verify:changed`.

## 5. Provider behavioral coverage for the new lifecycle

- [ ] 5.1 Rewrite the two cases that assert eager subscribe into their inverses in
      `apps/chat/src/context/tests/ClientChannelContext.spec.tsx`: "subscribes and exposes the
      channel id when the flag is enabled" (`:133`) becomes mount-with-flag-enabled produces zero
      `subscribeClientChannel` calls, followed by demand-then-connect; "reconnects when navigating
      back to a streaming-capable route" (`:504`) becomes navigating back produces zero subscribes
      until a completion is requested. Keep the route-eligibility assertions themselves — they are
      what keeps the `design.md` §Migration Plan option-1 fallback path exercised.
- [ ] 5.2 Add the new-behavior cases: zero subscribes on mount, on navigation between eligible
      conversations, on flag resolving to enabled, and on a `visibilitychange` to `visible` (both
      for a never-connected and an idle-disconnected channel, asserting `resolvedIdsRef` dedup state
      is not reset); one subscribe on first demand; two concurrent demands share one in-flight
      subscribe and both receive the same id; demand while connected reuses the id with no new
      subscribe; demand created inside the idle grace window survives the timer firing; a drop with
      nothing waiting schedules no reconnect; a pinned channel still reconnects off-route with the
      existing channel id; a backgrounded tab mid-generation keeps retrying.
- [ ] 5.3 Add teardown and pin coverage: unresolved sign-in event keeps the channel and the pending
      list after the generation settles and after leaving the eligible route; a failed report retains
      the event and rethrows; a successful report of the last event resumes normal cleanup
      (immediate disconnect off-route, 1000 ms countdown on-route); zero active generations alone
      never disconnects; flag-disable, logout, and unmount disconnect unconditionally and leave no
      timer, waiter, reader, or controller outstanding.

      **Verification:** `npm run test:file -- apps/chat/src/context/tests/ClientChannelContext.spec.tsx`
      then `npm run verify:changed`.

## 6. Page-level regression coverage

- [ ] 6.1 In `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`: opening a conversation
      and reading it makes zero `subscribeClientChannel` calls; the automatic first-message start
      after navigating to a conversation whose last message is from the user
      (`Conversation.tsx:447-460`) does subscribe once and sends the completion with the channel id;
      a `channelId` transition (null → id → null) causes no conversation re-fetch and no return to
      the loading state, proving the `loadConversationRef` indirection
      (`Conversation.tsx:512-522`) still holds.
- [ ] 6.2 In `apps/chat/src/pages/AppsEditor/tests/AppPreviewChat.spec.tsx`: opening AppsEditor
      makes zero subscribe calls; a preview send (`AppPreviewChat.tsx:264`) subscribes exactly once
      and carries the channel id.
- [ ] 6.3 In `apps/chat/src/components/SigninInterruptDialog/tests/SigninInterruptDialog.spec.tsx`:
      the dialog still appears on the first pending event, stays listed and actionable after the
      carrying generation ends and after a route change, and reports successfully on the pinned
      channel id.

      **Verification:**
      `npm run test:file -- apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`,
      `npm run test:file -- apps/chat/src/pages/AppsEditor/tests/AppPreviewChat.spec.tsx`,
      `npm run test:file -- apps/chat/src/components/SigninInterruptDialog/tests/SigninInterruptDialog.spec.tsx`,
      then `npm run verify:changed`.

## 7. Documentation

- [ ] 7.1 Update `docs/architecture.md`: the `ClientChannelContext` row (`:230`) to say the channel
      is opened by a completion request rather than by mounting a streaming-capable route, and the
      SSE note (`:284`) where it explains `waitForChannel` blocking before the completion request —
      that wait is now the normal cold-start path, not an edge case. Leave `ApiEndpoints`, the
      endpoint tables (`:443-451`), and the domain-folder list unchanged; no endpoint changed.
- [ ] 7.2 Update `docs/auth/auth-bff-encrypted-cookie.md` §5.5: `:201` currently reads "The SPA
      subscribes once per session" — replace with subscribe-on-completion-request, one shared
      channel per tab; `:204` lists the teardown triggers — keep logout, tab close, and flag-off, and
      state that returning to a route or focusing a tab no longer subscribes. Preserve the §5.5
      contrast with the proactive Scheduled Tasks flow at `:230`.
- [ ] 7.3 Update `docs/auth/auth-diagrams/08-toolset-signin-interrupt.mmd`: move the
      `POST /api/v1/client-channel/subscribe` exchange to **after** "Sends a chat message", so the
      diagram shows the completion request driving the subscribe and then carrying the id; update the
      closing `Note over SPA,CORE` teardown list to drop route-return/visibility resubscription and
      keep the pending-event pin. Regenerate the committed SVG with the command in
      `docs/auth/auth-diagrams/README.md` §Generating SVGs
      (`npx -y @mermaid-js/mermaid-cli -i docs/auth/auth-diagrams/08-toolset-signin-interrupt.mmd -o docs/auth/auth-diagrams/08-toolset-signin-interrupt.svg -b transparent`)
      and commit both files together.
- [ ] 7.4 Check `libs/chat-hooks/README.md` for documented `ConversationStreamChannel` /
      `useConversationStream` behavior. The capability's public shape does not change, so update only
      if its prose describes when the host connects, or if a code fence would now teach the wrong
      call shape. Treat every fence as type-checked: names, required props, and owning packages must
      match source.

      **Verification:** `npm run validate:docs`.

## 8. Local investigation notes (git-excluded, not part of the tracked change)

- [ ] 8.1 Update the local `memory-leak-analysis-1.0.14.md` investigation report. **It is absent
      from this working tree and absent from `.git/info/exclude`** as of this change's authoring, so
      recreate it locally if still missing and add it to `.git/info/exclude` to preserve its intended
      untracked status. Never `git add -f` it and never move it into `.gitignore` or the index — the
      tracked OpenSpec artifacts carry the reviewer-facing evidence (`proposal.md` §Evidence).
- [ ] 8.2 Preserve all existing historical sections and keep the report's findings separated under
      explicit headings, so a later reader cannot mistake one class for another: **confirmed source
      behavior** (the provider's current lifecycle, with line references); **reproduced defects**
      (the three from `proposal.md`, each with the sequence that triggers it); **production
      observations** (the ~15-minute 1.0.18 window: ~170 and ~195 `client_channel` on two pods, RSS
      550–600 MiB, tab count unknown); **hypotheses** (that eager subscriptions contribute to memory
      growth — still unproven); **planned changes** (the demand-driven lifecycle and the
      `design.md` transition table); and **measured results after implementation/deployment** (left
      empty until Slice 10 runs). Do not describe this change as an implemented or proven
      memory-leak fix.

## 9. Close-out

- [ ] 9.1 Run the five-axis quality review per `.claude/skills/code-review-and-quality/SKILL.md`.
      Pay specific attention to: the demand registry having exactly one release path per acquisition
      (R3 in `design.md` — a demand leak pins the channel open, the mirror image of the bug being
      fixed); no `useEffect` in the provider left without cleanup; the context value still wrapped in
      `useMemo`; the `libs/chat-hooks` isolation guard from task 2.2; and no physical-direction
      Tailwind classes or untranslated `aria-label`s introduced (none expected — no UI surface
      changes).
- [ ] 9.2 Run `npm run verify:full` and `npm run validate:docs` once, and confirm every acceptance
      criterion in `proposal.md` §Acceptance Criteria 1–12 is demonstrably met by a named test or a
      named doc change. Criterion 13 is Slice 10.

## 10. Controlled verification on a quiet environment (post-deploy)

- [ ] 10.1 Deploy to a quiet environment and record the number of open browser tabs alongside every
      measurement. Run the **idle browsing** pass from `design.md` §Verification: log in, open a
      conversation, read it, navigate between conversations, open AppsEditor, leave to `/files` and
      back, background and foreground the tab. Scrape
      `dial_chat_sse_active{kind="client_channel"}` before and after; expect no increase from
      baseline.
- [ ] 10.2 Run the **cycle** pass: 20 × send→finish, 5 × send→backend error, 5 × send→user cancel.
      After cleanup plus one scrape interval, confirm the gauge returns to baseline except for
      legitimately active generations or pending sign-in work, with no monotonic climb across
      iterations.
- [ ] 10.3 Confirm **no duplicates and no lost sign-in**: two concurrent completions in one tab
      produce exactly one subscribe; a toolset requiring sign-in still raises the dialog and both
      login and decline report successfully, including after the generation ends and after
      navigating to a non-eligible route.
- [ ] 10.4 Measure **cold completion-start latency**: send-click to first completion byte, warm
      (channel already up) vs. cold (after an idle disconnect), n ≥ 20 each, recording median and
      p95. This is `design.md` R1's gate; if the delta is unacceptable, apply Migration Plan option 1
      (seed standing demand while eligible) rather than reverting the defect fixes.
- [ ] 10.5 Observe a **longer load/idle window** of at least an hour, recording per-pod `heap_used`,
      `heap_total`, `external`, `array_buffers`, RSS, `dial_chat_sse_active` per `kind`, and
      generation counts. Write the results into the local report's "measured results" section
      (task 8.2). Apply the interpretation rule fixed in advance: a lower subscription count is the
      *expected* outcome and is **not** evidence about memory; only this heap/RSS series speaks to
      the memory hypothesis, and a flat subscription count with continued heap growth is a valid,
      reportable result that leaves the hypothesis open.

## 11. Out-of-scope findings (follow-ups, do not fix here)

- [ ] 11.1 `GenerationContext`'s context value is not wrapped in `useMemo`
      (`apps/chat/src/context/GenerationContext.tsx:84-91`), so every consumer re-renders on each
      provider render — a violation of the repo's own context rule in `openspec/config.yaml`
      §design. Real but unrelated to this change; record as a separate change rather than a drive-by
      edit.
- [ ] 11.2 A channel pinned open by an unresolved sign-in event whose retry budget is exhausted has
      no "next completion" to resume it, now that visibility no longer nudges reconnect
      (`design.md` §Open Questions 2). Consider a `reportEvent`-triggered reconnect **if observed in
      practice** — not designed speculatively here.
- [ ] 11.3 A background generation that is still streaming after the user leaves the eligible route
      cannot receive a sign-in event, today and after this change (`design.md` §D7). Fixing it means
      making eligibility follow demand, which this change deliberately refuses to do as a side
      effect.
