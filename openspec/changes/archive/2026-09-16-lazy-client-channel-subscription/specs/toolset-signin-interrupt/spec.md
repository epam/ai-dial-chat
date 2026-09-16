## MODIFIED Requirements

### Requirement: `ClientChannelProvider` owns subscription lifecycle and pending events

A `ClientChannelProvider` (React Context, `apps/chat/src/context/ClientChannelContext.tsx`, consumer hook `useClientChannel`) SHALL be mounted once inside `RequireAuth` in `apps/chat/src/main.tsx`, at the same level as `GenerationProvider`, so it survives conversation route navigation. Its context value SHALL be wrapped in `useMemo`. It SHALL own: the current channel id (or none), connection status, a `Map<eventId, PendingSigninEvent>` of pending `toolset/signin` events parsed from the SSE stream, and the **connection demand registry** that decides whether a subscription should exist at all (see `client-channel-demand-lifecycle`). The consumer hook SHALL throw if used outside the provider, matching the `ThemeContext` reference pattern.

The demand registry SHALL remain internal to the provider: it SHALL NOT appear on `ClientChannelContextValue`, so consumers — `SigninInterruptDialog`, `Conversation`, and `AppPreviewChat` — see an unchanged context surface. Mounting the provider SHALL NOT itself create demand and SHALL NOT open a subscription.

#### Scenario: Provider survives conversation navigation
- **WHEN** the user navigates from one conversation to another while a channel subscription is active
- **THEN** the subscription, any pending signin events, and any outstanding demand remain intact, unaffected by the route change

#### Scenario: Consumer used outside provider
- **WHEN** `useClientChannel` is called from a component not wrapped by `ClientChannelProvider`
- **THEN** it throws a clear error identifying the missing provider

#### Scenario: Mounting the provider opens no subscription
- **WHEN** `ClientChannelProvider` mounts with the flag enabled on a streaming-capable route
- **THEN** it holds no subscription and no demand until a completion is requested

### Requirement: Reconnect with bounded retries

On stream error or close, the provider SHALL retry subscribing with capped exponential backoff (1s, 2s, 4s, 8s, 16s — 5 attempts), sending the previous channel id (if any) on each retry attempt. After 5 failed attempts it SHALL stop retrying automatically and resume only when a new completion is issued. Pending events already known to the dialog SHALL NOT be cleared merely because the connection dropped.

Retries SHALL be attempted only while the connection is still justified — that is, while the flag and route condition hold **and** connection demand is outstanding, or while a sign-in event is still unresolved. A dropped connection that nothing is waiting on SHALL NOT be retried: the retry timer SHALL be cleared and the provider SHALL settle into a disconnected state until the next completion requests a channel. An unresolved sign-in event SHALL keep reconnect available even when the route condition is false, so a stream error cannot leave that event permanently unreportable.

Tab visibility SHALL NOT resume retrying. The retry budget SHALL be reset when fresh demand is acquired for a new completion, which is what recovers a channel whose retries were exhausted; it SHALL NOT be reset by a `visibilitychange` event.

#### Scenario: Transient disconnect recovers
- **WHEN** the SSE connection drops while a completion still holds demand, and reconnects successfully within the retry window
- **THEN** the channel id is resumed (or a fresh one issued) and pending events remain visible in the dialog throughout

#### Scenario: Retries exhausted
- **WHEN** 5 consecutive reconnect attempts fail
- **THEN** the provider stops retrying and marks connection status as disconnected until a new completion acquires demand and triggers a fresh attempt

#### Scenario: A drop with nothing waiting is not retried
- **GIVEN** the channel dropped after every generation settled, with no pending sign-in event and no outstanding demand
- **WHEN** the stream close is observed
- **THEN** no reconnect is scheduled and no retry timer remains armed

#### Scenario: A pinned channel reconnects off-route
- **GIVEN** the sign-in dialog lists an unresolved event and the user has navigated to a non-streaming-capable route
- **WHEN** the pinned channel's stream drops
- **THEN** reconnect is still attempted under the capped backoff, reusing the existing channel id, so the event stays reportable

#### Scenario: Visibility does not resume exhausted retries
- **WHEN** the retry budget is exhausted with no demand outstanding and the tab is backgrounded and then made visible
- **THEN** no new subscribe attempt is made and the retry budget is not reset
