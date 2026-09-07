## ADDED Requirements

### Requirement: The channel disconnects after a short idle period once nothing is generating

In addition to the existing route-scoped connect/disconnect lifecycle (mount on a streaming-capable route, disconnect on route-leave/flag-disable/unmount), `ClientChannelProvider` (`apps/chat/src/context/ClientChannelContext.tsx`) SHALL also disconnect the active client-channel subscription after a short idle grace period once no generation is active anywhere in the app, so an open subscription is not held for the entire time a user remains on a streaming-capable route without actually streaming anything.

`useConversationStream` (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`)'s `ConversationStreamChannel` capability interface SHALL expose an optional `notifyGenerationSettled?: () => void` callback, invoked once from both the `onComplete` and `onError` cleanup paths of `startStream`, after the existing generation-ending cleanup (mirroring the existing `overlay?.notifyGenerationStart?.()`/`overlay?.notifyGenerationEnd?.()` pattern already in that function). `GenerationContext` (`apps/chat/src/context/GenerationContext.tsx`) SHALL expose `hasActiveGeneration(): boolean`, true iff any entry in its registry currently has status `Active`.

On `notifyGenerationSettled()`, `ClientChannelProvider` SHALL:
- Do nothing if `hasActiveGeneration()` is `true` (another conversation, in this same browser tab, is still streaming).
- Otherwise schedule a disconnect after an idle grace delay of 1000ms, canceling any previously scheduled idle-disconnect timer first.

`ensureConnected()` (already called at the start of every completion) SHALL cancel any pending idle-disconnect timer as its first step, so a new completion started within the grace window keeps the existing channel instead of tearing it down and reopening it.

This mechanism is scoped to generations tracked by this browser tab's own `GenerationContext` instance; it has no visibility into generations happening in a different tab or window.

#### Scenario: Idle disconnect after the only active generation completes

- **GIVEN** a client-channel subscription is open and exactly one generation is active
- **WHEN** that generation completes (or errors) and no other generation is active
- **THEN** the channel remains open for 1000ms, then disconnects (unsubscribes from Core, clears the channel id)

#### Scenario: A new completion within the grace window cancels the pending disconnect

- **GIVEN** a generation has just completed and an idle-disconnect has been scheduled
- **WHEN** a new completion starts (calling `ensureConnected()`) before the 1000ms grace window elapses
- **THEN** the pending disconnect is canceled and the existing channel subscription is kept, with no unsubscribe/resubscribe round trip

#### Scenario: Another active generation suppresses the idle disconnect

- **GIVEN** two conversations are generating (e.g. the user navigated from a still-streaming conversation to a different one and started a second completion there)
- **WHEN** one of the two generations completes
- **THEN** no disconnect is scheduled, since `hasActiveGeneration()` still reports `true` for the other one

#### Scenario: A completion started after an idle disconnect reconnects transparently

- **GIVEN** the channel was disconnected after an idle period
- **WHEN** the user sends a new completion
- **THEN** `ensureConnected()` opens a fresh subscription the same way it does on initial mount, and `waitForChannel`'s existing bounded wait covers the round trip before the completion's channel id is needed
