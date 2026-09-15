## Context

`ClientChannelProvider` (`apps/chat/src/context/ClientChannelContext.tsx`) owns
three things at once: the Core subscription, the channel id, and the
`Map<eventId, PendingSigninEvent>` that `SigninInterruptDialog` renders. Every
teardown path in it does all three — `disconnect()` aborts the stream,
unsubscribes, nulls the channel id, and clears the event map.

That coupling is why two independently-reasonable requirements collide. The
lifecycle requirements were written about the *subscription* ("don't hold an
idle socket"), the dialog requirement about the *event list* ("the user must
resolve every event"), and `disconnect()` is where the two meet.

Timeline of how it got here, since it matters for which requirement yields:

| Date     | Change                                 | Added                                                    |
| -------- | -------------------------------------- | -------------------------------------------------------- |
| Jul 2026 | `interactive-toolset-login-chat`       | non-dismissible dialog, pending-event map                |
| Aug 2026 | `scope-client-channel-to-conversation` | route-leave disconnects and clears pending events        |
| Sep 2026 | `client-channel-idle-disconnect`       | 1000ms idle disconnect after the last generation settles |

The two later changes never revisited the July requirement, and the
`toolset-signin-interrupt` scenarios only exercise Escape and outside-click —
they never asserted the dialog survives a channel teardown, so nothing failed.

## Goals / Non-Goals

Goals:

- The dialog can only be dismissed by resolving every listed event, including
  against the idle timer and route changes.
- An unresolved event remains reportable — that requires a live channel id.
- Idle disconnect keeps doing its job (not holding a subscription open across a
  user's whole session on a conversation page) whenever nothing is pending.

Non-Goals:

- Making the dialog work without a channel (e.g. queueing reports for a later
  subscription). A report is addressed to a channel id Core is waiting on;
  reconnecting under a fresh id would not deliver it.
- Changing DIAL Core's timeout behaviour, or the completion stream's lifetime.
- Touching `libs/chat-hooks` — `notifyGenerationSettled` stays a plain "a
  generation settled" signal, with the policy entirely on the app side.

## Decisions

### Decision 1: The dialog wins; an unresolved event pins the channel open

A channel with an unresolved event is not idle — Core is blocked on it. So
`hasPendingEvents()` (the event map's size) becomes a precondition of every
*voluntary* teardown: the idle timer and the route-leave path.

Rejected alternative: let the disconnect win and make the dialog dismissible
once the channel is gone. It resolves the contradiction on paper and leaves the
user with a tool call that silently never completes — and Core still holds the
blocked tool call until its own timeout.

Rejected alternative: keep the events but drop the channel, then report over a
fresh subscription. Report is `{channelId, eventId}`-addressed; a new channel
id is a different conversation partner as far as Core is concerned.

### Decision 2: Involuntary teardowns still clear everything

Two paths are not "the channel is idle" but "the mechanism is gone", and they
keep clearing pending events:

- **Feature flag off.** `liveChatInteraction` going false disables the whole
  mechanism, which the existing spec already spells out. Keeping a dialog alive
  for a disabled feature would be worse than losing the event.
- **Unmount.** The provider unmounting means logout or app teardown; there is
  nobody left to resolve anything.

So the pin is conditioned on `isEnabled && hasPendingEvents()` for the
route-leave path, and not consulted at all on unmount.

### Decision 3: Teardown moves from the effect's cleanup into its body

The route/flag effect used its cleanup for teardown:

```tsx
useEffect(() => {
  if (!isActive) { disconnect(); return undefined; }
  void connect();
  return () => { isStoppedRef.current = true; disconnect(); };
}, [isActive]);
```

A cleanup runs both on a dependency change and on unmount, with no way to tell
them apart — so a route change ran the unconditional `disconnect()` in the
cleanup *before* the re-run could honour the pin. The effect body now owns the
inactive-route teardown, and a separate `[]`-dependency effect owns the
unmount-only teardown (through a `disconnectRef`, so the empty dependency list
doesn't capture a stale callback). The net behaviour for every previously
covered case is identical; only the pinned case differs.

### Decision 4: The idle timer re-checks at fire time

Suppressing the timer only where it is scheduled leaves a 1000ms hole: the
generation settles, the timer is armed, and *then* the event arrives on the
still-open stream. `scheduleIdleDisconnect`'s callback therefore re-reads both
`hasActiveGeneration()` and `hasPendingEvents()` before disconnecting, which
also covers a generation that starts inside the window.

### Decision 5: Resolving the last event resumes the normal lifecycle

Without this, the pin would leak: an event resolved while off-route would leave
a subscription nobody tears down, and an event resolved on-route would hold the
channel until the next generation settled. After a successful report that
empties the map:

- route/flag no longer active → `disconnect()` now;
- otherwise, nothing generating → arm the idle disconnect;
- otherwise (a generation is still streaming) → leave it alone; its own settle
  will arm the timer.

### Decision 6: Reconnect stays available while pinned

`connect()`/`scheduleReconnect()` gated on `isActiveRef.current`, which is false
on a pinned off-route channel — a stream error there would have left the event
permanently unreportable. Both now use
`isChannelWanted() = isActiveRef.current || hasPendingEvents()`.
`ensureConnected()`/`waitForChannel()` deliberately keep the strict check: they
are the completion path, and a completion only ever starts on a
streaming-capable route.

## Risks / Trade-offs

- **A pinned channel outlives its route.** Bounded in practice: the dialog is
  modal with the rest of the app `inert`, so the user cannot navigate while it
  is open; only programmatic navigation reaches this state. The pin ends the
  moment the last event is resolved (Decision 5), and unmount always wins.
- **A never-resolved event holds a subscription.** That is the intended product
  behaviour — the dialog blocks the app until resolved. The pre-existing
  5-attempt reconnect cap still applies, so a permanently failing stream stops
  retrying rather than looping.
- **`isEnabled` joins the lifecycle effect's dependencies.** It only ever
  changes in lockstep with `isActive` today; adding it makes the "flag flipped
  off while already off-route" case tear down rather than silently keep a
  pinned channel.

## Migration Plan

None — a frontend behaviour fix inside one provider, with no stored state,
protocol, or API surface involved.

## Open Questions

- Should an unresolved event also survive a full page reload (Core replays it
  on resubscribe with the previous channel id)? Out of scope here: today the
  reconnect path already forwards the previous channel id, and whether Core
  replays an unreported event is a Core-side question this change does not
  touch.
