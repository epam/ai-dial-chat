## Context

### Current state (verified on `origin/development`, 2026-09-16)

`apps/chat/src/context/ClientChannelContext.tsx` (517 lines) owns the whole client-channel
lifecycle. Read as of `origin/development`; the relevant files are identical on the working
branch, so line references below are stable. Note that the 1.0.18 tag's provider is **not**
the right baseline to design against: `development` carries additional sign-in lifecycle
fixes (the pending-event pin across route changes, `resolvedIdsRef` clearing scoped to a new
completion, the effect-body teardown, `useLayoutEffect` ref sync) that this change must
preserve.

What the provider does today:

| Concern            | Implementation                                                                    | Line reference                    |
| ------------------ | --------------------------------------------------------------------------------- | --------------------------------- |
| Eligibility        | `isActive = isEnabled && isStreamingCapablePage` (`useMatch` on two routes)        | `ClientChannelContext.tsx:114-117` |
| Eligibility as ref | `useLayoutEffect` sync so a child's mount effect sees it in the same commit        | `:122-126`                        |
| Eager connect      | `useEffect([isActive, isEnabled])` calls `void connect()` when `isActive`           | `:407-425`                        |
| Route-leave        | Same effect body: `!isActive` disconnects unless flag-on-and-pending-events         | `:409-420`                        |
| Unmount            | Separate cleanup-only effect: `isStoppedRef = true`, unconditional `disconnect()`  | `:427-434`                        |
| Visibility         | `visibilitychange` to `visible` calls `ensureConnected()` while `isActive`          | `:436-447`                        |
| Connect            | Single-flight via `abortControllerRef`, reuses `channelIdRef` on reconnect          | `:248-278`                        |
| Backoff            | `RECONNECT_DELAYS_MS = [1000,2000,4000,8000,16000]`, gated on `isChannelWanted()`   | `:33`, `:236-246`                 |
| Wanted             | `isChannelWanted = () => isActiveRef.current \|\| hasPendingEvents()`               | `:199-202`                        |
| Idle disconnect    | 1000 ms timer, re-checks `hasActiveGeneration()` and `hasPendingEvents()` on fire   | `:36`, `:329-345`                 |
| Settle hook        | `notifyGenerationSettled` — no-op while generating; clears timer while pinned       | `:347-365`                        |
| Bounded wait       | `waitForChannel(timeoutMs = 40000)`, returns `null` when inactive/stopped           | `:368-392`                        |
| Report             | `reportEvent` on `channelIdRef`; resolving the last event resumes normal cleanup    | `:449-481`                        |

`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts` consumes a
narrow host capability (`ConversationStreamChannel`, `:99-106`): `channelId`,
`ensureConnected()`, `waitForChannel(timeoutMs?)`, optional `notifyGenerationSettled?()`. It
calls `ensureConnected()` when a stream starts (`:303`) and awaits
`waitForChannel(CHANNEL_WAIT_TIMEOUT_MS)` — 20 000 ms, `:37` — inside `send()` (`:437-456`)
before `transport.streamCompletion`.

Both call sites supply the identical capability object:
`apps/chat/src/pages/Conversation/Conversation.tsx:279-291` and
`apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx:174-189`. `SigninInterruptDialog` consumes
only `pendingEvents` / `reportEvent` (`SigninInterruptDialog.tsx:186`), so it is untouched.

### Constraints

- **Library isolation** (`AGENTS.md` §Library isolation): `libs/chat-hooks` may not learn about
  routes, flags, endpoint paths, auth, env, or client construction. Demand must stay behind the
  existing `waitForChannel`/`ensureConnected` callbacks — the lib must not gain a `acquire`/
  `release` vocabulary that encodes host lifecycle knowledge.
- **Pending-sign-in pin is a hard contract**, not an optimization:
  `openspec/specs/toolset-signin-interrupt/spec.md` ("Global non-dismissible toolset sign-in
  dialog") states that any teardown clearing the pending-event map dismisses the dialog on the
  user's behalf, and that the report is addressed to the channel id Core is blocked on.
- **Provider mount point is fixed**: once inside `RequireAuth` in `apps/chat/src/main.tsx`,
  alongside `GenerationProvider`, so it survives conversation navigation.
- **`channelId` is a context value that flows into `startStream`'s identity**, which flows into
  `loadConversation`'s identity. `Conversation.tsx:512-522` already shields the mount-load
  effect behind `loadConversationRef` for this exact reason; that mitigation must survive.

### Stakeholders

Frontend chat (provider + hook), platform/SRE (SSE gauge and pod memory), and the toolset /
external-service sign-in feature owners (whose interactive flow rides this channel).

## Goals / Non-Goals

**Goals:**

- No client-channel subscription exists until a completion is actually requested.
- Exactly one shared channel per application tab; concurrent completions share one in-flight
  subscribe.
- Every existing protection preserved verbatim: both timeouts, non-blocking fallback,
  pending-sign-in pin, capped backoff with channel-id reuse, 1000 ms idle grace with fire-time
  re-check, unconditional teardown on flag-disable/logout/unmount, and the current
  route-leave policy.
- Close the three ownership/cancellation defects that demand-driven subscribe promotes from
  rare to routine.
- Leave a measurable, falsifiable verification plan behind — including what would _disprove_
  the memory hypothesis.

**Non-Goals:**

- Claiming a proven memory-leak fix. See §Open Questions.
- Broadening channel retention across non-eligible routes.
- Changing either timeout, the `dial_chat_sse_active` semantics, the three HTTP contracts, the
  generated client, or the feature flag's gating.
- Any backend change; `conversation_watch` / `generation_attach` / backend SSE / cache
  behavior are untouched.
- A second global context, or a channel per completion.
- Fixing `GenerationContext`'s un-memoized context value (`GenerationContext.tsx:84-91`) —
  real, unrelated, recorded as a follow-up.

## Decisions

### D1. Demand is a counted registry of opaque tokens, owned by the provider

A `demandRef: Set<symbol>` (plus a `demandCountRef` is unnecessary — set size is the count)
inside `ClientChannelProvider`. `hasDemand()` is `demandRef.current.size > 0`.

`ensureConnected()` and `waitForChannel()` acquire demand; demand is released when the
generation that created it settles, via the existing `notifyGenerationSettled()` path, and on
teardown. The token is internal — it never crosses the context boundary, so
`ClientChannelContextValue`'s shape is unchanged and `libs/chat-hooks` sees nothing new.

**Why a counted set rather than a boolean**: two concurrent completions must not have the
first one to settle release the second one's demand. A boolean loses that. A counted set also
makes "new demand inside the idle grace window" trivially correct: the idle timer's fire-time
re-check reads `hasDemand()`.

**Why not release demand from the hook explicitly** (e.g. a `releaseChannel()` callback added
to `ConversationStreamChannel`): it would add a lifecycle verb to the lib's capability
surface, and the hook already reports settlement through `notifyGenerationSettled?.()` from
both `onComplete` and `onError` (`useConversationStream.ts:356`, `:406`). Reusing that keeps
the lib contract identical. The provider derives release from settlement plus
`hasActiveGeneration()`, which it already consults.

**Alternative rejected**: deriving demand from `hasActiveGeneration()` alone. It is not
sufficient — demand must exist _before_ `startGeneration` has produced a tracked entry that
the provider can observe, and must persist across the window where the channel wait is
outstanding but the stream has not started. A separate registry is what makes "acquire before
sending" expressible.

### D2. Eligibility gates, demand triggers

`isActive` (flag AND eligible route) is retained exactly as computed today, including the
`useLayoutEffect` ref sync (`:122-126`) that requirement 9 depends on — a child page's mount
effect that immediately calls `waitForChannel` in the same commit as the route becoming
eligible must not read a stale `false`.

What changes is only the consequence: `isActive` becoming true no longer calls `connect()`.
The route/flag effect keeps its teardown half (`!isActive` disconnects unless pinned) and
drops its connect half.

`connect()`'s own guard becomes `isStopped || !(isEligible && (hasDemand() || hasPendingEvents()))`
— the pending-event term is what lets a pinned channel reconnect off-route, preserved from
`isChannelWanted()` (`:199-202`). Concretely, `isChannelWanted()` is redefined as
`(isActiveRef.current && hasDemand()) || hasPendingEvents()`.

### D3. Visibility stops being a connect trigger

The `visibilitychange` listener (`:436-447`) is removed rather than reworked. Its stated
purpose in `openspec/specs/toolset-signin-interrupt/spec.md` ("Reconnect with bounded
retries") is to resume after the 5 retries are exhausted. Under demand-driven subscribe there
are two cases and neither needs it:

- **No demand and nothing pending**: there is nothing to resume. Reconnecting here is exactly
  the behavior this change exists to remove — and today it also clears `resolvedIdsRef`
  (`:297`), silently resetting sign-in dedup state on every tab focus.
- **Demand or a pending event exists**: the next `waitForChannel`/`ensureConnected` call
  (which happens for any new completion) resumes, and a pinned channel's retry budget is reset
  by the pin path rather than by focus.

A backgrounded tab mid-generation is unaffected: its demand is still held, so retries continue
under the existing backoff while hidden.

**Alternative considered**: keep the listener but guard it on `hasDemand() || hasPendingEvents()`
and stop it from clearing `resolvedIdsRef`. Functionally acceptable, but it retains an event
listener whose only remaining effect is a reconnect the next completion would trigger anyway.
Removing it is less code and one fewer way to resurrect an idle channel. If the retry-exhaustion
case turns out to need a focus-driven nudge for pinned channels specifically, that is a
follow-up with its own evidence.

### D4. Connection ownership generations

`connect()` takes a monotonically increasing `connectionGenerationRef` value captured at entry.
Every post-`await` write — `attemptRef`, `channelIdRef`, `setChannelId`,
`resolveChannelWaiters`, `abortControllerRef = null`, `scheduleReconnect()` — is guarded by
`if (myGeneration !== connectionGenerationRef.current) return;` _in addition to_ the existing
`controller.signal.aborted` check, and the `abortControllerRef.current = null` writes move
_inside_ that guard.

`disconnect()` bumps the generation. This makes an old connect's late rejection, late
resolution, and `finally` work inert: it can neither null a newer controller (defect 1) nor
install a stale channel id (defect 2).

**Why a generation counter rather than comparing the controller identity**
(`if (abortControllerRef.current !== controller) return;`): controller-identity comparison
handles the overwrite case but not the "ref was already nulled, so `!==` is true and we bail —
but a third connect has since stored its own controller" ordering. A monotonic generation is
unambiguous regardless of how many teardown/reconnect cycles interleave, and it reads the same
way under StrictMode's synthetic double-invoke. Controller identity is additionally checked
where nulling occurs, as a belt-and-braces assertion that we only clear our own.

### D5. The hook re-checks cancellation after the channel wait

In `useConversationStream`'s `send()` (`:437-456`), between `await ... waitForChannel(...)` and
`transport.streamCompletion(...)`, add:

```ts
if (controller.signal.aborted || isSuperseded()) return;
```

`controller` is the `AbortController` the host's `startGeneration` already returned
(`:284`), and `isSuperseded()` is the hook's existing predicate (`:283`). No new capability,
no new parameter, no host knowledge — this is the minimum-surface fix, and it is the reason
the lib is touched at all.

Returning silently (rather than routing through `completionOptions.onError`) is deliberate:
Stop and re-submit already ran their own cleanup through `handleStop` / the superseding
generation, and synthesizing an error here would paint an error bubble on a message the user
deliberately cancelled.

### D6. The idle timer re-checks demand alongside its existing conditions

`scheduleIdleDisconnect`'s fire-time check becomes
`if (hasActiveGeneration() || hasPendingEvents() || hasDemand()) return;`. The 1000 ms constant
(`IDLE_DISCONNECT_DELAY_MS`, `:36`) is unchanged.

This is what makes requirement 6 hold under the new model: a completion that acquires demand
inside the grace window is protected even in the window _before_ its `startGeneration` entry
exists, which `hasActiveGeneration()` alone would miss.

`ensureConnected()` keeps clearing the idle timer as its first step (`:285`), so the common
"new completion inside the grace window" case still avoids an unsubscribe/resubscribe round
trip entirely.

### D7. Route-leave policy is documented, not changed

Today: leaving an eligible route with nothing pending disconnects; with a pending event, the
channel survives. That stays exactly as is, and the delta spec says so explicitly so that a
future reader cannot mistake the demand model for "the channel now follows demand everywhere."

A background generation started on conversation A and still streaming while the user navigates
to `/files` is unaffected in the way that matters: its demand is still held, but eligibility is
false, so the route-leave teardown applies — identical to today. If Core needs to push a
sign-in event for that generation after the user has left, it cannot, today or after this
change. That is a pre-existing limitation, called out here rather than silently inherited, and
it is out of scope (fixing it means making eligibility follow demand, which is the broadening
this change refuses to do as a side effect).

## Lifecycle / State Transitions

States: **Idle** (no controller, no channel id) · **Connecting** (controller set, no channel
id) · **Connected** (controller set, channel id set) · **Retrying** (no controller, retry timer
armed) · **IdlePending** (Connected with an idle-disconnect timer armed) · **Pinned**
(Connected or Retrying with `pendingEvents` non-empty).

| # | Trigger | Precondition | Action | Next state |
| - | ------- | ------------ | ------ | ---------- |
| 1 | Eligible route mounts / returns; flag turns on; tab becomes visible | any | **Nothing.** Eligibility is recorded; no connect. | unchanged |
| 2 | `ensureConnected()` / `waitForChannel()` (completion requested) | Idle, eligible | acquire demand; clear idle timer; reset `attemptRef`; clear retry timer; `connect()` | Connecting |
| 3 | Same, while Connecting | eligible | acquire demand; **join** the in-flight subscribe (guard `abortControllerRef.current` returns early); `waitForChannel` registers a waiter | Connecting |
| 4 | Same, while Connected | eligible | acquire demand; clear idle timer; `waitForChannel` resolves immediately from `channelIdRef` | Connected |
| 5 | Same, while not eligible or stopped | — | **no demand acquired**; `waitForChannel` resolves `null`; completion proceeds without a channel id | unchanged |
| 6 | Subscribe resolves | generation still current, not aborted | set `channelIdRef`/`setChannelId`; `attemptRef = 0`; resolve all waiters with the id; start `readStream` | Connected |
| 7 | Subscribe resolves | generation stale **or** aborted | **inert**: no ref writes, no waiter resolution, no reconnect; the response body is cancelled | unchanged |
| 8 | Subscribe rejects / stream errors or closes | generation current, not aborted | clear own controller; resolve waiters `null` (reject path); `scheduleReconnect()` if still wanted | Retrying or Idle |
| 9 | Subscribe rejects | generation stale **or** aborted | **inert** — must not null a newer controller (defect 1) | unchanged |
| 10 | Retry timer fires | still wanted (demand or pinned) | `connect()` | Connecting |
| 11 | Retry budget exhausted (5 attempts) | — | stop; wait for the next `ensureConnected`/`waitForChannel` | Idle |
| 12 | `toolset/signin` / `external-service/signin` event parsed | not already known/resolved | add to `eventsMapRef`; `syncPendingEvents()`; clear any armed idle timer | Pinned |
| 13 | `notifyGenerationSettled()` | another generation active | release this generation's demand; no timer | unchanged |
| 14 | `notifyGenerationSettled()` | pending events exist | release demand; **clear** the idle timer (never schedule) | Pinned |
| 15 | `notifyGenerationSettled()` | no active generation, nothing pending | release demand; arm the 1000 ms idle timer | IdlePending |
| 16 | Idle timer fires | `hasActiveGeneration() \|\| hasPendingEvents() \|\| hasDemand()` | **skip** the disconnect; leave the channel open | Connected |
| 17 | Idle timer fires | none of the three hold | `disconnect()` (bump generation, abort, unsubscribe, clear events + resolved ids, resolve waiters `null`) | Idle |
| 18 | Completion cancelled/superseded while its wait is outstanding | — | wait resolves normally; the hook's re-check (D5) suppresses the send; demand released on settle | unchanged |
| 19 | `reportEvent` succeeds, events remain | — | remove the event; stay pinned | Pinned |
| 20 | `reportEvent` succeeds, last event | not eligible | `disconnect()` immediately | Idle |
| 21 | `reportEvent` succeeds, last event | eligible, nothing generating, no demand | arm the 1000 ms idle timer | IdlePending |
| 22 | `reportEvent` fails | — | **retain** the event for retry; rethrow to the dialog; channel stays pinned | Pinned |
| 23 | Leave eligible route | nothing pending | `disconnect()` | Idle |
| 24 | Leave eligible route | pending events, flag on | keep everything; reconnect stays permitted via the pending-event term | Pinned |
| 25 | Flag flips off | any | `disconnect()` unconditionally (clears pending events too) | Idle |
| 26 | Provider unmount (logout / app teardown) | any | `isStoppedRef = true`; `disconnect()` unconditionally | Idle (terminal) |
| 27 | StrictMode remount | — | unmount cleanup bumps the generation, so the first mount's in-flight connect is inert (rows 7/9); the second mount starts from Idle with `isStoppedRef = false` and **no** demand, so it does not connect | Idle |

Rows 1, 16, 18, 27 are the behavioral deltas. Rows 12, 14, 19–22, 24–26 are today's behavior,
restated so the delta spec can assert they are unchanged.

## Risks / Trade-offs

**R1. Cold-subscribe latency on the first completion.** Under eager subscribe the channel is
usually already up when `send()` runs, so `channel?.channelId` short-circuits the await. Now
every first completion after mount or after an idle disconnect pays one BFF-to-Core subscribe
round trip before the completion request is sent.
→ Mitigation: this path is already specified and implemented — `waitForChannel` exists for
exactly it (PR #8542, `client-channel-protocol` "Completion sent while the subscribe round
trip is still in flight"), and the 1000 ms idle grace already produces the same cold start
today for the second message after a pause. The added latency equals one subscribe round trip
against the same BFF the completion is about to hit anyway. It is **measured, not assumed**:
§Verification requires a recorded cold completion-start latency delta, and the number is a
release-gate input, not a footnote. If the delta is material, the conservative fallback in
§Migration Plan (standing demand while eligible) restores today's warm path without reverting
the defect fixes.

**R2. Sign-in events become impossible for a completion whose channel never came up.** Only
in the case where subscribe fails or times out, which is already the specified and
tested fallback ("Completion sent while the feature flag is off or the wait times out" →
completion proceeds without the header). Risk is unchanged in kind, higher in frequency only
to the extent that cold subscribes fail more often than warm ones.
→ Mitigation: capped backoff is retained, `attemptRef` is reset on each fresh demand
acquisition, and the fallback is explicitly a non-failure of the completion.

**R3. A demand leak pins the channel open forever.** If a generation neither completes nor
errors, its demand is never released and the idle timer's `hasDemand()` check (D6) keeps the
channel alive — the mirror image of the bug being fixed.
→ Mitigation: demand release is driven by the same `notifyGenerationSettled` call that
`onComplete` and `onError` both already make unconditionally on every terminal path
(`useConversationStream.ts:356`, `:406`), and `disconnect()` clears the registry outright, so
flag-disable/logout/unmount cannot leak. A dedicated test asserts the registry is empty after
a stop and after an error.

**R4. The retained route-eligibility tests no longer describe the shipped behavior.** Several
existing `ClientChannelContext.spec.tsx` cases assert eager subscribe (`:133`, `:504`) and
many others rely on it incidentally to get a channel up before exercising parsing, reporting,
or backoff.
→ Mitigation: the test-migration task (`tasks.md` §3.1) converts incidental reliance to an
explicit demand-creating step via a shared helper, and rewrites the two intentional
eager-subscribe assertions into their inverse (mount produces zero subscribes) plus a
demand-then-connect assertion. Nothing is deleted without a replacement asserting the new
behavior.

**R5. Fewer subscriptions gets mistaken for "the leak is fixed."**
→ Mitigation: stated as a non-goal in the proposal, encoded in acceptance criterion 13, and
carried into the investigation notes as an explicitly open hypothesis. §Verification requires
heap/RSS observation over a longer window independent of the subscription count.

**R6. `channelId` churn causing a conversation reload or spinner regression.** `channelId` now
transitions null → id → null around every generation, changing `startStream`'s identity, which
changes `loadConversation`'s identity.
→ Mitigation: `Conversation.tsx:512-522` already reads `loadConversation` through a ref for
this reason. Net churn actually _decreases_ (no null → id transition on mere mount). A
regression test asserts no re-fetch and no spinner on a `channelId` transition.

## Migration Plan

Frontend-only, no data migration, no coordinated backend deploy. Ships as one PR built from the
risk-first slices in `tasks.md`: the ownership-generation guard and the hook cancellation
re-check land and are verified _before_ the lifecycle inversion, so a regression in the
observable behavior can be bisected to the lifecycle slice rather than to a defect fix.

Deploy to a quiet environment first and run §Verification before promoting.

**Rollback, in increasing order of reach:**

1. **Restore the warm path only** (if R1's measured latency is unacceptable but behavior is
   otherwise good): seed standing demand while `isActive` holds — a single acquisition in the
   route/flag effect, released on route-leave. Restores today's connection profile while
   keeping the defect fixes and the demand plumbing. This is the conservative baseline from
   `proposal.md` §Alternatives 1, reachable in one small commit.
2. **Revert the lifecycle slice**, keeping the defect fixes (§1–§2 slices are independent
   commits for this reason).
3. **Revert the whole change.** No contract, storage, or backend state to unwind.

## Verification

### Existing suites, extended (no new spec files)

| Suite | Coverage this change adds |
| ----- | ------------------------- |
| `apps/chat/src/context/tests/ClientChannelContext.spec.tsx` | zero subscribes on mount / route-return / visibility; demand-then-connect; shared in-flight subscribe for concurrent demand; reuse while Connected; demand release on settle; idle-timer race with new demand; ownership generation (late reject, late resolve, StrictMode); pinned reconnect off-route; failed vs. successful report; flag-disable; unmount |
| `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts` | 20 000 ms wait preserved; `null` fallback still sends without a channel id; cancelled-during-wait and superseded-during-wait are not sent; `notifyGenerationSettled` still fires from both terminal paths |
| `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx` | opening a conversation subscribes zero times; the automatic first-message start after navigation does subscribe and carries the id; no re-fetch or spinner from a `channelId` transition |
| `apps/chat/src/pages/AppsEditor/tests/AppPreviewChat.spec.tsx` | opening AppsEditor subscribes zero times; preview send subscribes once and carries the id |
| `apps/chat/src/components/SigninInterruptDialog/tests/SigninInterruptDialog.spec.tsx` | dialog still appears, stays actionable after the generation ends and after a route change, and reports on the pinned channel |

Commands per slice: `npm run test:file -- <path>`; once per completed slice:
`npm run verify:changed`; once at the end: `npm run verify:full` and `npm run validate:docs`.
No `npm run build:quiet` is needed — no bundling surface changes. No `npm run openapi` — no
endpoint contract changes.

### Controlled verification on a quiet environment

Run with a single known number of browser tabs, recorded alongside the results.

1. **Idle browsing.** Log in; open a conversation; read it; navigate between conversations;
   open AppsEditor; leave to `/files` and back; background and foreground the tab. Scrape
   `dial_chat_sse_active{kind="client_channel"}` before and after.
   **Expected:** no increase from baseline.
2. **Cycle test.** 20 iterations of send → finish, plus 5 each of send → backend error and
   send → user cancel. After cleanup plus one scrape interval, the gauge returns to baseline,
   except for legitimately active generations or pending sign-in work.
   **Expected:** baseline, no monotonic climb across iterations.
3. **No duplicates, no lost sign-in.** Two concurrent completions in one tab produce exactly
   one subscribe. A toolset requiring sign-in still raises the dialog, and login and decline
   both report successfully — including after the generation ends and after navigating to a
   non-eligible route.
4. **Cold latency.** Measure the time from send-click to the first completion byte, warm
   (channel already up) vs. cold (after an idle disconnect), n ≥ 20 each. Record median and
   p95. This is R1's gate.
5. **Longer window.** Over a load/idle cycle of at least an hour, record per-pod `heap_used`,
   `heap_total`, `external`, `array_buffers`, RSS, `dial_chat_sse_active` per `kind`, and
   generation counts.

**Interpretation rule, stated in advance:** a lower subscription count is the _expected_
outcome of this change and is not evidence about memory. Only the §5 heap/RSS series over the
longer window speaks to the memory hypothesis, and a flat subscription count with continued
heap growth is a valid, reportable result that leaves the hypothesis open.

## Open Questions

1. **Does any part of the observed 1.0.18 memory growth actually come from client-channel
   subscriptions?** Unresolved. The tab count during the observation window is unknown, so
   even the "connections track tabs, not generations" reading is inference. This change is
   justified on the narrower ground that connections which cannot carry traffic should not
   exist; the memory question is answered only by the §Verification §5 series.
2. **Does the retry-exhaustion case need a focus-driven nudge for pinned channels?** D3 removes
   the visibility listener on the argument that the next completion resumes. A channel pinned
   by an unresolved event with its retry budget exhausted has no "next completion" to resume
   it, and would rely on the user's report attempt failing loudly. Left as-is (matching
   today's behavior once retries are exhausted) rather than designed speculatively; a
   `reportEvent`-triggered reconnect would be the fix if it is observed.
3. **Should a background generation keep the channel alive off-route?** Deliberately not
   changed (§D7). Answering "yes" means eligibility follows demand, which is the broadening
   this change refuses to do as a side effect.
4. **Is one shared channel per tab still right for many concurrent completions?** Unchanged
   from today and not re-litigated; the shared-channel contract is what `reportEvent`'s
   channel-addressed report depends on.
