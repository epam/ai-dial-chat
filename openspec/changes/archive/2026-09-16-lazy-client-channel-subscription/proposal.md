## Why

`ClientChannelProvider` subscribes to the DIAL Core client-channel SSE relay as soon as a
streaming-capable route mounts, before the user has asked for anything. The connect is driven
purely by route eligibility (`apps/chat/src/context/ClientChannelContext.tsx:407-425`:
`isActive = isEnabled && isStreamingCapablePage` then `void connect()`), so simply opening or
reading a conversation, opening AppsEditor, returning to an eligible route, having the
`liveChatInteraction` flag turned on, or making a background tab visible
(`ClientChannelContext.tsx:436-447`) each opens a long-lived SSE connection that carries a
BFF relay handler, an upstream Core subscription, an `AbortController`, a
`TextDecoder`/reader loop, and a `dial_chat_sse_active{kind="client_channel"}` gauge
contribution — for a tab that may never send a completion.

This is the follow-up the idle-disconnect change explicitly deferred:
`openspec/changes/archive/2026-09-07-client-channel-idle-disconnect/design.md:17` states that
change "deliberately keeps today's mount-time eager connect ... A future change can revisit
this if idle-disconnect alone doesn't sufficiently reduce open-connection counts." Production
observations on 1.0.18 (see Evidence below) indicate it did not, so this change is that
revisit.

Only a completion actually needs a channel: the channel exists so Core can push a
`toolset/signin` / `external-service/signin` RPC event for a tool call blocked inside a
completion, and so the frontend can `report` the resolution back. No completion means no event
is possible. Making the subscription demand-driven removes connections that can carry no
traffic, without changing what a completion can do.

### Evidence (for reviewers without the local investigation notes)

Confirmed from repository history and source:

| Fact                                                                                        | Source                                                    |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Chat 1.0 moved subscribe from initialization to completion start                            | legacy PR #7419, commit `48689c5da8`, 2026-06-25          |
| The rewritten `ClientChannelProvider` reintroduced eager, mount-time subscribe              | PR #7948, commit `c46a4d0da8`, 2026-07-22                 |
| Eager subscribe was narrowed to `/conversations/*` and `/apps-editor` only                  | PR #8179                                                  |
| `waitForChannel` added so a completion can await an in-flight subscribe                     | PR #8542, released in 1.0.5                               |
| A 1000 ms idle disconnect after generation settlement was added, eager subscribe retained    | PR #8645, released in 1.0.14                              |
| `apps/chat/src/context/ClientChannelContext.tsx` is identical between tags 1.0.14 and 1.0.18 | `git diff 1.0.14 1.0.18 -- <path>` reports no differences |

Production observation (not proof of causation): in roughly the first 15 minutes after a
1.0.18 deployment, `dial_chat_sse_active{kind="client_channel"}` reached about 170 and 195 on
two pods while generation counts fluctuated, with RSS settling around 550–600 MiB after
startup. The number of open browser tabs at the time is unknown. These numbers are consistent
with connection counts tracking open eligible tabs rather than actual generations, but they do
**not** establish that client-channel subscriptions caused a memory leak, and this change is
**not** presented as a proven memory-leak fix. It removes a category of connections that
cannot carry traffic; whether all memory growth is explained is a separate, still-open
question (see `design.md` §Open Questions).

Defects found in the current source while designing this change — independent of the
eager/lazy question, but made materially more reachable once a subscribe happens on the
completion path:

1. **Connection ownership race.** `connect()` writes `abortControllerRef.current = null`
   unconditionally in its `catch` (`ClientChannelContext.tsx:272`) and after `readStream`
   returns, _before_ checking `controller.signal.aborted`. An aborted connection whose
   `subscribeClientChannel` promise rejects later therefore clears a _newer_ connection's
   controller, after which the `if (abortControllerRef.current) return` guard at
   `ClientChannelContext.tsx:250` no longer suppresses a duplicate connect. React StrictMode's
   double-invoke drives exactly this sequence.
2. **Late setup response overwrites live state.** The success path assigns
   `channelIdRef.current`, `setChannelId`, and `resolveChannelWaiters` at
   `ClientChannelContext.tsx:260-263` with no aborted/ownership check, so a subscribe that
   resolves after its own teardown can install a stale channel id and hand it to waiters.
3. **A cancelled or superseded completion is still sent.** `useConversationStream`'s `send()`
   awaits `waitForChannel` and then calls `transport.streamCompletion` with no re-check of
   `controller.signal.aborted` or `isSuperseded()`
   (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts:437-456`).
   Today `channel?.channelId` is usually already populated by the eager subscribe, so that
   await rarely suspends; under demand-driven subscribe it suspends for the cold round trip on
   every first completion, turning a latent bug into a routine one.

## What Changes

- **Model connection demand explicitly, separately from route eligibility.** The provider
  gains an internal demand registry (a counted set of demand holders). Route eligibility and
  the feature flag continue to decide whether a channel _may_ exist; demand decides whether
  one _should_. Mounting an eligible route creates eligibility but **no demand**.
- **Subscribe when a completion is requested, not on mount.** `waitForChannel` /
  `ensureConnected` become the only paths that create demand. They are already called at the
  start of every completion from `useConversationStream.startStream`
  (`useConversationStream.ts:303`, `:443`), which covers normal send, edit, regenerate, the
  automatic first-message start after navigation
  (`apps/chat/src/pages/Conversation/Conversation.tsx:447-460`), and the QuickApps preview
  (`apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx:264`).
- **One shared channel per application tab, with in-flight sharing.** Concurrent completions
  join the single in-flight subscribe instead of opening a second connection. No
  per-completion channel.
- **BREAKING (spec-level, not API-level): eager mount, route-return, and visibility subscribe
  are removed.** `openspec/specs/client-channel-protocol/spec.md`'s "returning to a
  streaming-capable route ... SHALL reconnect it" and the visibility-resume connect trigger are
  replaced by demand-driven connect. No HTTP contract, DTO, generated-client operation, or
  metric changes: the same three endpoints are called the same way, just later and less often.
- **Fix the three defects above in the same change**, because demand-driven subscribe makes
  each of them a routine path: an ownership generation guard on `connect`, an
  aborted/ownership check before installing setup results, and a cancellation/supersession
  re-check between `waitForChannel` resolving and `streamCompletion` being called.
- **Preserve every existing protection unchanged**: the 20 000 ms hook-side wait and the
  40 000 ms provider-side default; a subscribe failure never becoming a failure of ordinary
  completion; the pending-sign-in pin that keeps the channel and the global dialog alive past
  generation end and past a route change; capped backoff with channel-id reuse; the 1000 ms
  idle grace period with a re-check at fire time; unconditional teardown on flag-disable,
  logout, and unmount; and the current route-leave policy (no pending events means disconnect
  on leaving an eligible route), which is documented explicitly rather than broadened.
- **No change to backend-owned generation and persistence**: `conversation_watch`,
  `generation_attach`, the backend SSE relay, cache behavior, API contracts, and
  `dial_chat_sse_active` semantics are all out of scope.

## Capabilities

### New Capabilities

- `client-channel-demand-lifecycle`: the explicit demand model that decides when a
  client-channel subscription exists — demand acquisition and release by actual completion
  requests, a shared in-flight subscribe for concurrent requests, connection-ownership
  generations that make late or aborted setup results inert, StrictMode-safe teardown, and the
  cancellation re-check that stops a superseded completion from being sent after its channel
  wait resolves.

### Modified Capabilities

- `client-channel-protocol`: the `liveChatInteraction` gate requirement stops treating "on an
  eligible route" as a reason to connect and requires demand instead; tab-visibility resume is
  removed as a connect trigger; the channel-id-propagation requirement adds the cancellation
  re-check before send; the idle-disconnect requirement re-checks demand (not only active
  generations and pending events) when its timer fires.
- `toolset-signin-interrupt`: the bounded-retry reconnect requirement's "is this still wanted"
  condition becomes demand-or-pending-events rather than route-or-pending-events, and the
  provider-lifecycle requirement records that the provider owns the demand registry.

## Impact

**Frontend (app edge — owns routes, flags, auth, transport, channel ownership):**

- `apps/chat/src/context/ClientChannelContext.tsx` — demand registry, demand-driven
  connect/reconnect, ownership generation guard, visibility connect trigger removed, idle timer
  re-checks demand.
- `apps/chat/src/context/GenerationContext.tsx` — behaviorally unchanged; `hasActiveGeneration`
  (`GenerationContext.tsx:76-81`) remains the idle-disconnect input.
- `apps/chat/src/pages/Conversation/Conversation.tsx`,
  `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx` — no new wiring; both already pass the
  full `ConversationStreamChannel` capability (`Conversation.tsx:279-291`,
  `AppPreviewChat.tsx:174-189`). The existing `loadConversationRef` indirection
  (`Conversation.tsx:512-522`) that shields the mount-load effect from `channelId` churn stays,
  and gains a regression test.
- `apps/chat/src/components/SigninInterruptDialog/SigninInterruptDialog.tsx` — unchanged; it
  consumes `pendingEvents` / `reportEvent` only (`SigninInterruptDialog.tsx:186`).
- `apps/chat/src/server-api/client-channel.ts` — unchanged.

**Library (`libs/chat-hooks`, host-agnostic):**

- `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts` — the
  `ConversationStreamChannel` capability keeps its shape (`channelId`, `ensureConnected`,
  `waitForChannel`, optional `notifyGenerationSettled`); the only change is the hook's own
  cancellation re-check between the channel wait and `streamCompletion`, using the
  `AbortController` the host-supplied `generation` lifecycle already returned plus the hook's
  existing `isSuperseded()`. **Library isolation:** no route, flag, endpoint-path,
  auth/session, env, storage, or client knowledge is added — demand semantics stay behind the
  host-supplied `waitForChannel`/`ensureConnected` callbacks, so the lib never learns that a
  channel is lazy, shared, or pinned.

**Backend:** none. No controller, DTO, OpenAPI, generated-client, throttle, cache, or metric
change; `npm run openapi` / `npm run openapi:check` are unaffected.

**Docs:** `docs/architecture.md` (the `ClientChannelContext` row at `docs/architecture.md:230`
and the SSE note at `:284`), `docs/auth/auth-bff-encrypted-cookie.md` §5.5 (`:201`, `:204`),
`docs/auth/auth-diagrams/08-toolset-signin-interrupt.mmd` plus its rendered `.svg` (the
diagram currently shows subscribe _before_ the user's first message, which becomes wrong), and
`libs/chat-hooks/README.md` if its documented `ConversationStreamChannel` contract text
changes. `npm run validate:docs` closes this out.

**i18n:** no new user-visible strings. **RTL:** none — no UI surface changes.
**Feature flag:** unchanged (`liveChatInteraction`, including
`LIVE_CHAT_INTERACTION_ENABLED_ROLES`); this change alters when the flag's mechanism connects,
not who may use it.

## Non-Goals

- Proving that client-channel subscriptions caused a memory leak, or that this change resolves
  all memory growth. This change reduces connections that cannot carry traffic; the memory
  question stays open and is measured, not asserted.
- Changing the route-leave policy. Without pending sign-in events, leaving an eligible route
  still disconnects. Channel retention is not broadened across all routes as a side effect.
- Changing either timeout (20 000 ms hook wait, 40 000 ms provider default), or making a
  subscribe failure fail an ordinary completion.
- Any backend change: `conversation_watch`, `generation_attach`, the SSE relay, cache
  behavior, API contracts, and `dial_chat_sse_active` semantics stay as they are.
- A separate channel per completion, or a second global context for connection demand (see
  Alternatives 3 and 4).
- Reworking `GenerationContext`'s missing `useMemo` on its context value
  (`GenerationContext.tsx:84-91`) — a real but unrelated finding, recorded as a follow-up in
  `tasks.md` rather than fixed here.

## Alternatives Considered

1. **Conservative baseline — keep eager subscribe, tune only the idle window.** Shorten the
   1000 ms idle grace or add a longer inactivity timeout on top of it. Lowest risk and no
   behavioral surface change, but it does not address the connection that exists _before_ any
   generation, which is precisely the population the 1.0.18 metrics point at: an idle tab that
   never generates still holds a connection for as long as it sits on an eligible route.
   Rejected as insufficient, though it remains the rollback target (`design.md` §Migration
   Plan).
2. **Demand-driven subscribe on the existing provider (chosen).** Extend
   `ClientChannelProvider` and its existing narrow `ConversationStreamChannel` capability with
   an explicit demand registry. Reuses `waitForChannel`'s already-specified bounded wait and
   fallback, touches one provider plus one guard in one hook, keeps a single channel per tab,
   and is revertible by treating route eligibility as standing demand. Costs a cold-subscribe
   round trip on the first completion after an idle period (quantified in `design.md` §Risks).
3. **A second global context owning connection demand.** Cleaner separation on paper, but it
   adds a provider to `main.tsx`, splits the channel lifecycle across two contexts that must
   agree about pending sign-in events, and duplicates the pending-event pin logic that today
   lives in exactly one place. Rejected as scope creep for no correctness gain —
   `openspec/config.yaml`'s proposal rules call out precisely this "does it need a new context"
   question.
4. **One channel per completion.** Maximum isolation and the simplest demand accounting, but it
   multiplies connections for concurrent completions (the opposite of the goal), forces
   `reportEvent` to route by completion rather than by channel, and would change the
   `X-DIAL-CLIENT-CHANNEL-ID` reuse contract with Core. Rejected.

## Rollback / Backward Compatibility

Not breaking at any contract boundary: no HTTP, DTO, OpenAPI, generated-client, metric,
feature-flag, or i18n change, so a mixed fleet of old and new frontends talks to the same
unchanged backend. Old frontends keep subscribing eagerly, new ones subscribe on demand; the
backend cannot tell the difference beyond call volume.

Rollback is a frontend-only revert of this change's commits. If a partial rollback is needed
without giving up the defect fixes, the demand model degrades to today's behavior by seeding
standing demand while an eligible route is mounted — one code path, kept exercised by the
route-eligibility test retained for exactly this purpose.

## Scope Creep Flags

- Touches a **global provider** (`ClientChannelProvider`) that every authenticated route sits
  under, and one **shared lib hook** (`useConversationStream`) consumed by both `Conversation`
  and `AppPreviewChat`. Both are called out deliberately; the lib change is one guard inside an
  existing function, with no capability-surface change.
- Fixes three pre-existing defects alongside the lifecycle change. Justified because
  demand-driven subscribe converts each from rare to routine; each is independently verifiable
  and lands in its own risk-first slice (`tasks.md` §1–§2) ahead of the lifecycle change.

## Acceptance Criteria

1. Mounting `/conversations/<id>` or `/apps-editor` with the flag enabled, reading the
   conversation, navigating between eligible conversations, leaving and returning to an
   eligible route, and toggling tab visibility produce **zero** `subscribeClientChannel` calls.
2. The first completion (send, edit, regenerate, automatic first-message start after
   navigation, or QuickApps preview) opens exactly one subscription, and the completion request
   carries that channel's `clientChannelId`.
3. Two completions started concurrently share one subscription — exactly one
   `subscribeClientChannel` call, both completions carrying the same channel id.
4. The bounded wait is unchanged: 20 000 ms at the hook, 40 000 ms provider default. A
   subscribe that fails, is unavailable, or times out leaves the completion to proceed with no
   channel id and no new user-visible error.
5. A completion cancelled or superseded while its channel wait is outstanding is never sent
   once that wait resolves.
6. An unresolved `toolset/signin` or `external-service/signin` event keeps the channel and the
   global dialog alive after the generation ends and after the user leaves the eligible route;
   a failed report retains the event for retry; a successful report of the last event resumes
   normal cleanup. Zero active generations alone never disconnects.
7. Reconnect happens only while demand or a pending event justifies it, with the existing
   capped backoff (1/2/4/8/16 s, 5 attempts) and channel-id reuse; a pending event still
   permits reconnect off-route; visibility changes neither resurrect an idle channel nor clear
   resolved-id dedup state.
8. The 1000 ms idle grace period is unchanged and re-checks active generations, pending events,
   and demand when it fires; demand created inside the window prevents the stale cleanup from
   closing the channel.
9. Flag-disable, logout, and provider unmount disconnect unconditionally; no retry timer, idle
   timer, waiter, reader, or `AbortController` survives teardown; repeated teardown is inert.
10. An aborted or superseded connection's late resolution or rejection cannot clear or
    overwrite a newer connection's controller, channel id, or waiter state, including under
    React StrictMode double-invoke.
11. `Conversation` does not re-fetch the conversation or re-enter its loading state because
    `channelId` changed.
12. The existing suites named in `design.md` §Verification all pass, `npm run verify:full` is
    clean, and `npm run validate:docs` passes with `docs/architecture.md`,
    `docs/auth/auth-bff-encrypted-cookie.md`, and diagram 08 (`.mmd` plus regenerated `.svg`)
    updated in the same change.
13. Controlled verification on a quiet environment records: no additional
    `dial_chat_sse_active{kind="client_channel"}` operations from idle browsing; the gauge
    returning to baseline after repeated send/finish/error/cancel cycles once cleanup and one
    scrape have elapsed, except for legitimately active or pending-sign-in work; no duplicate
    subscriptions and no lost interactive sign-in flows; a measured cold completion-start
    latency delta; and per-pod `heap_used`, `heap_total`, `external`, `array_buffers`, RSS, SSE
    operations, and generation counts over a longer load/idle window. A reduced subscription
    count alone is explicitly **not** accepted as evidence that memory growth is resolved.
