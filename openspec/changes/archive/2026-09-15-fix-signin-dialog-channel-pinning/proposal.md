## Why

Two shipped requirements contradict each other, and the contradiction is
visible in the product as the sign-in dialog dismissing itself.

`toolset-signin-interrupt` (July 2026) says of the global sign-in dialog:

> The dialog SHALL NOT be dismissible by clicking outside, pressing Escape, or
> any action other than resolving every listed event (login or decline).

`client-channel-protocol` gained two later requirements that do exactly that,
because the dialog renders `ClientChannelProvider`'s pending-event list and
every teardown path clears it:

- the route-scoping requirement (August 2026) — "leaving a streaming-capable
  route while the channel is open SHALL disconnect it (unsubscribe from Core,
  clear pending events)";
- the idle-disconnect requirement (September 2026) — once nothing is
  generating, "the channel remains open for 1000ms, then disconnects
  (unsubscribes from Core, clears the channel id)".

Neither was checked against the older "not dismissible" requirement. The
idle-disconnect one is the actively broken path: DIAL Core ends the completion
while it waits for the report (or the completion errors out), the frontend's
`onComplete`/`onError` calls `notifyGenerationSettled()`, nothing is generating
any more, and 1000ms later the provider unsubscribes and clears the pending
events — so the dialog vanishes on its own roughly a second after it appears,
with no user action, and the event Core is blocked on is never reported. The
same teardown is what produces the repeated subscribe/unsubscribe churn
observed on that channel.

Resolving the conflict in favour of the dialog is the only coherent direction:
an unresolved event means DIAL Core is blocked waiting for a report, and
`reportEvent` needs that very channel id to deliver it. A channel with an
unresolved event on it is not idle.

## What Changes

- An unresolved sign-in event pins the channel open: `notifyGenerationSettled()`
  schedules no idle disconnect while `pendingEvents` is non-empty, and the
  already-armed timer re-checks at fire time (an event can arrive inside the
  1000ms grace window).
- Leaving a streaming-capable route with an unresolved event keeps the
  subscription instead of tearing it down. The dialog is application-level and
  outlives the route that spawned it; its report calls still need the channel.
- Resolving the last pending event hands the channel back to the normal
  lifecycle: disconnect at once if the route no longer wants a channel,
  otherwise fall back to the idle grace period.
- Reconnect (stream error/close, capped backoff) stays available while an
  event is pending, even off-route, so a dropped stream cannot strand an
  unresolvable event.
- Feature-flag-off and unmount are unchanged: both still tear the channel down
  and clear pending events, pin or not — the mechanism (or the session) is gone
  in those cases, not merely idle.
- The route/flag lifecycle teardown moves out of its effect's cleanup into the
  effect body, with unmount handled by a dedicated cleanup-only effect. A
  cleanup cannot distinguish a dependency change from an unmount, so the pin
  could not otherwise be honoured on a route change.

## Capabilities

### New Capabilities

(none — this resolves a contradiction between two existing requirements; no new
endpoint or externally observable capability is introduced)

### Modified Capabilities

- `client-channel-protocol`: the idle-disconnect requirement now states that an
  unresolved sign-in event suppresses the idle disconnect (both at scheduling
  and at fire time) and that resolving the last event resumes the countdown;
  the route-scoping requirement now states that route-leave keeps the channel
  while an event is unresolved, and that a flag flip and unmount still clear
  everything.
- `toolset-signin-interrupt`: the "Global non-dismissible toolset sign-in
  dialog" requirement now says explicitly what "not dismissible" implies for
  the transport — the channel is pinned open while the dialog lists anything,
  so no lifecycle timer or navigation can dismiss it on the user's behalf.

## Impact

- Code: `apps/chat/src/context/ClientChannelContext.tsx` only.
- Tests: `apps/chat/src/context/tests/ClientChannelContext.spec.tsx` — the
  route-leave case splits into a nothing-pending case (teardown, unchanged) and
  pinned cases; three new idle-disconnect cases.
- Docs: `docs/auth/auth-diagrams/08-toolset-signin-interrupt.mmd`'s teardown
  note, which listed only logout/tab-close/flag-off.
- No backend, OpenAPI, or DTO changes. `libs/*` untouched — the
  `ConversationStreamChannel` capability interface keeps the same
  `notifyGenerationSettled?: () => void` shape; only the app-side provider's
  reaction to it changes.
