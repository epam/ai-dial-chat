# client-channel-demand-lifecycle Specification

## Purpose

TBD - created by archiving change lazy-client-channel-subscription. Update Purpose after archive.

## Requirements

### Requirement: Connection demand is modeled explicitly and separately from route eligibility

`ClientChannelProvider` (`apps/chat/src/context/ClientChannelContext.tsx`) SHALL own an
internal **demand registry** — a counted collection of opaque demand tokens — and SHALL expose
`hasDemand()` internally as "the registry is non-empty". Demand SHALL NOT be exposed through
`ClientChannelContextValue`; the context surface (`channelId`, `pendingEvents`, `reportEvent`,
`ensureConnected`, `waitForChannel`, `notifyGenerationSettled`) SHALL be unchanged, so
`libs/chat-hooks`'s `ConversationStreamChannel` capability keeps its exact shape and learns
nothing about demand.

Route eligibility and the `liveChatInteraction` flag SHALL continue to decide whether a channel
**may** exist. Demand SHALL decide whether one **should**. The provider SHALL open a
subscription only when eligibility and demand hold together, or when a sign-in event is pending
(see `toolset-signin-interrupt`).

Demand SHALL be acquired only by `ensureConnected()` and `waitForChannel()` — the completion
path — and never by mounting, rendering, navigating, enabling the flag, or a tab visibility
change.

Demand SHALL be released when the generation that acquired it settles, driven by the existing
`notifyGenerationSettled()` notification which `useConversationStream` already invokes from both
its `onComplete` and `onError` terminal paths. `disconnect()` SHALL clear the registry outright,
so flag-disable, logout, and unmount cannot leak demand.

The registry SHALL be counted rather than boolean: with two concurrent completions, the first to
settle SHALL NOT release the second's demand.

#### Scenario: Demand registry is empty before any completion

- **WHEN** the provider is mounted on an eligible route with the flag enabled and no completion has been requested
- **THEN** `hasDemand()` is false and no subscription exists

#### Scenario: Two concurrent completions each hold their own demand

- **GIVEN** two completions were started and each acquired demand
- **WHEN** the first one settles and releases its demand
- **THEN** the registry is still non-empty, and no idle disconnect is scheduled while the second completion runs

#### Scenario: Demand is released on every terminal path

- **WHEN** a completion ends by completing, by erroring, or by being stopped by the user
- **THEN** the demand it acquired is released, and the registry is empty once no other completion holds demand

#### Scenario: Demand does not reach the library capability

- **WHEN** `libs/chat-hooks`'s `ConversationStreamChannel` capability object is inspected
- **THEN** it exposes only `channelId`, `ensureConnected`, `waitForChannel`, and the optional `notifyGenerationSettled` — no demand acquisition or release verb, and no route, flag, endpoint, auth, or transport knowledge

### Requirement: A completion request acquires or reuses one shared channel per application tab

Every actual completion request SHALL acquire demand and obtain a channel id before its
completion HTTP request is sent, so the id can be included. This SHALL apply to every way a
completion starts: normal send, message edit, regenerate, the automatic first-message start
after navigating to a conversation whose last message is from the user
(`apps/chat/src/pages/Conversation/Conversation.tsx`), and the QuickApps preview
(`apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx`).

The provider SHALL maintain at most one client-channel subscription per application tab.
Concurrent completion requests SHALL share it:

- If a subscription is already established, a new request SHALL reuse its channel id
  immediately without any subscribe call.
- If a subscribe is in flight, a new request SHALL join that in-flight attempt — registering as
  a waiter rather than issuing a second `subscribeClientChannel` call.
- The provider SHALL NOT open a channel per completion.

A completion request that arrives while the mechanism is ineligible (flag off, non-eligible
route) or the provider is stopped SHALL acquire no demand, SHALL receive `null`, and SHALL
proceed without a channel id.

#### Scenario: First completion after mount opens exactly one subscription

- **GIVEN** the provider is mounted on an eligible route with the flag enabled and no channel exists
- **WHEN** the user sends the first message
- **THEN** exactly one `subscribeClientChannel` call is made, and the completion request carries that channel's id

#### Scenario: Concurrent completions share one in-flight subscribe

- **GIVEN** no channel exists
- **WHEN** two completions are started before the subscribe round trip resolves
- **THEN** exactly one `subscribeClientChannel` call is made, and both completions carry the same channel id

#### Scenario: A later completion reuses the established channel

- **GIVEN** a channel is already established
- **WHEN** another completion is started
- **THEN** no new `subscribeClientChannel` call is made and the completion carries the existing channel id

#### Scenario: The automatic first-message start after navigation gets a channel

- **WHEN** navigating to a conversation whose last message is from the user causes the page's own load path to start a completion immediately
- **THEN** that completion acquires demand, the subscribe is initiated, and the completion carries the channel id once the bounded wait resolves

#### Scenario: QuickApps preview acquires a channel the same way

- **WHEN** a completion is started from the AppsEditor preview
- **THEN** it acquires demand and carries the channel id exactly as a completion started from the conversation page does

#### Scenario: Completion requested while ineligible

- **WHEN** a completion is requested while the flag is off, the route is not eligible, or the provider is stopped
- **THEN** no demand is acquired, no subscribe is attempted, and the completion is sent without a channel id

### Requirement: Connection ownership generations make late and aborted setup results inert

`connect()` SHALL capture a monotonically increasing connection-generation value at entry, and
`disconnect()` SHALL increment that generation. Every write that `connect()` performs after an
`await` — the retry-attempt counter, the channel id ref, the channel id state, waiter
resolution, clearing its own `AbortController` reference, and scheduling a reconnect — SHALL be
guarded by both a still-current generation check and the existing abort-signal check, and the
clearing of the `AbortController` reference SHALL happen inside that guard rather than
unconditionally.

Consequently:

- An aborted or superseded connection whose subscribe call rejects later SHALL NOT clear or
  overwrite a newer connection's `AbortController` reference, channel id, or waiter state.
- An aborted or superseded connection whose subscribe call resolves later SHALL NOT install its
  channel id, SHALL NOT resolve waiters with it, and SHALL NOT begin reading its stream; its
  response body SHALL be released.
- A stale connection SHALL NOT schedule a reconnect.

Teardown SHALL be idempotent: repeated `disconnect()` calls SHALL leave no retry timer, idle
timer, registered waiter, stream reader, or `AbortController` outstanding, and SHALL NOT throw.
This SHALL hold under React StrictMode's double mount/unmount, where the first mount's in-flight
connect is torn down before the second mount runs.

#### Scenario: An aborted connection's late rejection does not clear a newer controller

- **GIVEN** a connect attempt is in flight and is then aborted by a teardown, after which a new connect attempt starts and stores its own controller
- **WHEN** the first attempt's subscribe call finally rejects
- **THEN** the newer attempt's controller, channel id, and waiter state are untouched, and no duplicate subscribe is issued afterwards

#### Scenario: An aborted connection's late success does not install a stale channel id

- **GIVEN** a connect attempt is aborted by a teardown while its subscribe call is still pending
- **WHEN** that subscribe call resolves afterwards with a channel id
- **THEN** the channel id is not stored, waiters are not resolved with it, its stream is not read, and its response body is released

#### Scenario: A stale connection does not schedule a reconnect

- **WHEN** a superseded connection's stream closes or errors
- **THEN** it schedules no reconnect, leaving reconnect scheduling to the current connection

#### Scenario: StrictMode double mount leaves no duplicate connection

- **WHEN** the provider is mounted under React StrictMode, so its effects run, are cleaned up, and run again
- **THEN** the first mount's work is fully inert after cleanup, and — with no demand acquired — the second mount holds no subscription at all

#### Scenario: Repeated teardown is inert

- **WHEN** `disconnect()` runs twice in a row, or runs after the provider has already stopped
- **THEN** it does not throw, and no timer, waiter, reader, or `AbortController` remains outstanding

### Requirement: A cancelled or superseded completion is not sent after its channel wait resolves

`useConversationStream` SHALL re-check, between its channel wait resolving and calling
`transport.streamCompletion`, whether the generation is still wanted: it SHALL NOT send the
completion if the generation's `AbortController` signal is already aborted, or if a newer
generation has superseded it on the same conversation path. The hook lives at
`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`.

The re-check SHALL use only values the hook already holds — the `AbortController` returned by
the host-supplied `startGeneration` and the hook's existing supersession predicate — and SHALL
NOT add any parameter or capability to the hook's public surface.

A suppressed send SHALL return silently rather than being routed through the error path, because
Stop and re-submit have already run their own cleanup and an error bubble would misreport a
deliberate cancellation. Because nothing was ever sent, the suppressed path SHALL still perform
the same settlement bookkeeping the terminal `onComplete`/`onError` paths perform — releasing the
generation's connection demand, closing out the tracked generation entry, and clearing the
per-path streaming state — so neither the client channel nor the "is generating" state is left
stuck.

#### Scenario: Stop while the channel wait is outstanding

- **GIVEN** a completion is waiting for a channel id
- **WHEN** the user stops the generation and the channel wait then resolves
- **THEN** no completion request is sent, no stream-error message is written onto the message, and the generation's demand and tracked state are settled as if it had ended normally

#### Scenario: Re-submit while the channel wait is outstanding

- **GIVEN** a completion is waiting for a channel id
- **WHEN** the user stops it and immediately submits again, so a newer generation owns the path, and the first wait then resolves
- **THEN** the superseded completion is not sent, and only the newer generation's request reaches the transport

#### Scenario: A still-wanted completion is sent normally

- **WHEN** the channel wait resolves and the generation is neither aborted nor superseded
- **THEN** the completion is sent with the resolved channel id, exactly as before
