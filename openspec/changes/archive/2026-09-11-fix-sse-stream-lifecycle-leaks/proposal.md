## Why

Production pod memory kept climbing after 1.0.15 (PR #8683's bounded Keyv
cache) shipped, and the new runtime gauges from PR #8738
(`dial_chat_process_memory`, `dial_chat_sse_active`,
`dial_chat_generations_active`) give us the instruments to see why but do not
themselves fix anything. Local reproduction against the exact 1.0.15 code
found two remaining retention paths in the SSE-serving controllers:

1. `ClientChannelController.subscribe` and `ConversationController.watchConversation`
   attach their `res.on('close', ...)` listener only after `await`ing the
   upstream DIAL Core subscribe call. A browser disconnect that happens during
   that await is invisible to the handler — the upstream fetch, its eventual
   reader, and (for watch) a keepalive timer are still started once the await
   resolves, with nothing left listening for the close that already happened.
2. Every SSE writer in these controllers (`res.write(value)`) ignores a
   `false` return, i.e. it never respects Node's backpressure signal. A
   reproduction using the real 1.0.15 `subscribe` method against a genuinely
   stalled `Writable` (1 KiB `highWaterMark`) accumulated ~16 MiB of buffered
   output for a single connection.

Both defects hold a connection's resources (upstream reader, timers, buffered
bytes) alive longer than the browser connection that justified them, which is
the retention shape a stalled/discarded client produces under real network
conditions (slow mobile networks, backgrounded tabs, proxies that hold sockets
half-open). Fixing them is the next concrete step after 1.0.15's cache fix,
using the observability PR #8738 just merged as the way to confirm the fix
actually reduces retained memory in production.

## What Changes

- Move each SSE handler's `res.on('close', ...)` registration to before the
  first `await` of upstream setup (client-channel subscribe, conversation
  watch), and make that early-close path actually abort the in-flight setup
  call rather than only being available for cleanup after the fact.
- Thread an `AbortSignal` into `ConversationStreamingService.watchConversation`
  and the underlying `subscribeToResources` call — today `watchConversation`
  accepts no signal at all, so a disconnect during its upstream await cannot
  cancel anything upstream.
- Add bounded SSE write backpressure handling shared by every SSE-writing
  handler (client-channel subscribe, conversation watch, completion delivery,
  generation attach): stop reading further upstream bytes / further chunks
  while `res.write()` returns `false`, wait for `'drain'` bounded by the
  connection closing, an upstream error, or a fixed timeout, and — for
  completion delivery and generation attach specifically, where the
  generation itself must keep running and persist regardless of a slow
  browser — detach the response (stop writing to it) once an explicit,
  documented buffered-byte/time limit is exceeded, without pausing or
  aborting the generation.
- Keep the existing runtime gauges (`dial_chat_sse_active`,
  `dial_chat_generations_active`) accurate under the new cleanup paths: a
  cancelled-during-setup subscription still settles its count exactly once,
  and a detached-for-backpressure completion/attach releases its listeners
  and timers the same way a normal close does.
- No change to SSE event framing, authentication, feature-flag gating, or the
  documented generation-independent-of-connection guarantee
  (`backend-owned-generation-persistence`) — a browser disconnecting or being
  detached for backpressure must not stop or corrupt generation or its
  eventual persistence.

## Capabilities

### New Capabilities

(none — this hardens existing SSE transport behavior; no new endpoint or
externally observable capability is introduced)

### Modified Capabilities

- `client-channel-protocol`: the "Browser disconnects mid-stream" behavior is
  tightened to cover a disconnect that happens *before* the upstream Core
  subscribe call resolves, and a new bounded-backpressure requirement is
  added for the relay loop.
- `conversation-watch-sse`: the "Client disconnect closes the DIAL Core
  subscription" behavior is tightened the same way, plus the previously
  unstated fact that upstream subscribe accepts no cancellation signal is
  fixed (an `AbortSignal` now flows from the controller through
  `ConversationService`/`ConversationStreamingService` to the DIAL Core SDK
  call), plus the same bounded-backpressure requirement.
- `generation-live-replay`: adds an explicit, documented buffered-output limit
  for a slow attach subscriber, past which the backend detaches that
  subscriber's response (stops writing, removes its listeners) without
  affecting the generation or other subscribers.
- `backend-owned-generation-persistence`: adds the same explicit backpressure
  limit for the primary completion-delivery response, clarifying that a
  detached-for-backpressure response is handled identically to a
  disconnected one — the generation and its final persistence proceed
  unaffected.

## Impact

- Code: `apps/chat-api/src/client-channel/client-channel.controller.ts`,
  `apps/chat-api/src/client-channel/client-channel.service.ts`,
  `apps/chat-api/src/conversations/conversation.controller.ts`,
  `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`,
  `apps/chat-api/src/conversations/conversation.service.ts` (facade
  passthrough for the new `watchConversation` signal parameter), and a new
  shared SSE-writing helper in `apps/chat-api/src/common/utils/sse.ts` used by
  all four handlers so the backpressure logic is not duplicated four times.
- Tests: new/updated specs under `apps/chat-api/src/client-channel/tests/`,
  `apps/chat-api/src/conversations/tests/`, and
  `apps/chat-api/src/common/utils/tests/`, plus the existing
  `apps/chat-api/src/telemetry/tests/sse-subscription-metrics.spec.ts` gains
  cases for the now-earlier abort and for backpressure-driven detachment.
- Docs: `apps/chat-api/README.md` (SSE handling section, if one documents the
  close/backpressure contract) and the four specs listed above.
- No frontend changes — SSE event formats, headers, and authentication are
  unchanged; this is purely backend resource-lifecycle hardening.
- No OpenAPI/DTO changes.
