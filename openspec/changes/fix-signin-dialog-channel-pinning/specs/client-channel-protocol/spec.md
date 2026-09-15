## MODIFIED Requirements

### Requirement: `liveChatInteraction` feature flag gates the mechanism

The mechanism SHALL be gated by a feature flag key `liveChatInteraction`, read via the existing `AppConfigContext`/`useFeatureFlag` mechanism (server-supplied `features` map). When the flag is `false` or not yet `Ready`, the frontend SHALL NOT attempt to subscribe to the client channel and SHALL NOT attach a channel id to completion requests.

In addition, the frontend SHALL only hold an open client-channel subscription while the current route is a streaming-capable page — `ROUTES.Conversations` (`/conversations` and any sub-path, e.g. a specific `/conversations/<id>`) or `ROUTES.AppsEditor` (`/apps-editor`) — matching `useConversationStream`'s two call sites (`Conversation` and `AppPreviewChat`). `ROUTES.Root` (`/`, the pre-conversation composer/empty state rendered by `ConversationRoute`) SHALL NOT count as streaming-capable: it creates a new conversation via a plain REST call and navigates to `/conversations/<id>` before any stream can exist, so it never itself hosts a live stream. `ClientChannelProvider` SHALL derive this route condition using `react-router`'s `useMatch`, since the provider is mounted inside `BrowserRouter`. The connect/reconnect/visibility-resume logic SHALL require both the flag being enabled AND the route condition; leaving a streaming-capable route while the channel is open SHALL disconnect it (unsubscribe from Core, clear pending events) the same way disabling the flag does today, and returning to a streaming-capable route (flag still enabled) SHALL reconnect it.

The one exception to the route-leave teardown is an unresolved sign-in event: while `pendingEvents` is non-empty and the flag is still enabled, leaving a streaming-capable route SHALL keep the subscription instead of tearing it down, because the global dialog that lists those events is application-level, outlives the route that spawned it, and its `report` calls are addressed to this channel id (see `toolset-signin-interrupt`'s non-dismissible-dialog requirement). A flag flip to `false` and provider unmount SHALL still disconnect and clear pending events unconditionally — those end the mechanism or the session rather than merely idling it. Because a React effect cleanup cannot distinguish a dependency change from an unmount, the route/flag teardown SHALL live in the effect body, with a separate cleanup-only effect owning the unconditional unmount teardown.

While a channel is pinned open by an unresolved event, the reconnect path SHALL remain available even though the route condition is false — the capped-backoff reconnect and the `connect` guard SHALL treat "an event is pending" as equivalent to the route condition holding — so a stream error cannot leave an event permanently unreportable. `ensureConnected`/`waitForChannel` SHALL keep the strict flag-and-route check: they are the completion path, and a completion only ever starts on a streaming-capable route.

The active flag/route condition SHALL be available to `ensureConnected`/`waitForChannel` synchronously as of the render that computes it, not only after `ClientChannelProvider`'s own effect commits. Syncing the underlying ref inside a `useEffect` leaves a one-commit window, on the render that first makes a page streaming-capable, where a *child* page's own mount effect (e.g. `Conversation` auto-starting its first completion, which React runs before an ancestor provider's effect in the same commit) observes a stale "inactive" value and gives up without attempting to connect or wait.

#### Scenario: A newly streaming-capable page's own mount effect needs the channel immediately
- **WHEN** navigation makes the current route streaming-capable (e.g. a brand-new conversation created from `/` navigates to `/conversations/<id>`) and, in that same render, the page's own mount effect immediately calls `ensureConnected`/`waitForChannel`
- **THEN** the active flag already reflects the new route for that call — it does not read a stale value left over from the previous route

The backend SHALL also enforce the flag server-side (defense in depth, so a restricted or fully-disabled user cannot bypass the frontend gate by calling the API directly): `POST /api/v1/client-channel/subscribe` and `POST /api/v1/client-channel/report` SHALL apply the existing `FeatureGuard`/`@RequireFeature(FeatureKey.LiveChatInteraction)` mechanism and return `403` when the flag resolves to `false` for the caller (including role-restricted denials via `LIVE_CHAT_INTERACTION_ENABLED_ROLES`). `POST /api/v1/client-channel/unsubscribe` SHALL NOT be gated by the flag, so a client that already holds an open channel can always tear it down (e.g. the flag flips off mid-session, the user's role no longer qualifies, or the user navigates off a streaming-capable route) regardless of the flag's current value for that user.

#### Scenario: Flag disabled

- **WHEN** `liveChatInteraction` resolves to `false`
- **THEN** no subscribe request is made and completions carry no channel id

#### Scenario: Flag flips to disabled while a channel is active

- **WHEN** the flag becomes `false` after a channel was already subscribed
- **THEN** the frontend calls unsubscribe for the active channel and clears any pending signin events from the dialog state

#### Scenario: Flag flips to disabled while an event is still unresolved

- **WHEN** the flag becomes `false` while the sign-in dialog still lists a pending event, whether or not the current route is streaming-capable
- **THEN** the frontend unsubscribes and clears the pending events — the pin does not survive the mechanism being disabled

#### Scenario: Backend rejects subscribe for a user the flag resolves false for

- **WHEN** a caller with a valid session calls `POST /api/v1/client-channel/subscribe` while `liveChatInteraction` resolves to `false` for that user (globally disabled or excluded by `LIVE_CHAT_INTERACTION_ENABLED_ROLES`)
- **THEN** the backend returns `403` without contacting DIAL Core

#### Scenario: Backend rejects report for a user the flag resolves false for

- **WHEN** a caller calls `POST /api/v1/client-channel/report` while the flag resolves to `false` for that user
- **THEN** the backend returns `403` without forwarding the report to DIAL Core

#### Scenario: Unsubscribe is never blocked by the flag

- **WHEN** a caller calls `POST /api/v1/client-channel/unsubscribe` while the flag resolves to `false` for that user
- **THEN** the backend still processes the unsubscribe normally

#### Scenario: Flag enabled but user is on a non-streaming-capable page

- **WHEN** `liveChatInteraction` resolves to `true` but the current route is not `/conversations/*` or `/apps-editor` (e.g. `/`, `/catalog`, `/files`, `/toolset-editor`, `/scheduled-tasks`, `/custom-app-editor`)
- **THEN** the frontend does not open a client-channel subscription

#### Scenario: Flag enabled but user is on the pre-conversation home page

- **WHEN** `liveChatInteraction` resolves to `true` and the current route is bare `/` (no conversation selected yet)
- **THEN** the frontend does not open a client-channel subscription, since `/` never itself hosts a live stream

#### Scenario: Navigating from the conversation page to a non-streaming-capable page disconnects the channel

- **WHEN** the flag is enabled, a channel is currently open with no pending signin events, and the user navigates from `/conversations` to `/files`
- **THEN** the frontend calls unsubscribe for the active channel, clears the channel id, and does not attempt to reconnect while on `/files`

#### Scenario: Navigating away with an unresolved signin event keeps the channel

- **WHEN** the flag is enabled, the sign-in dialog lists at least one unresolved event, and the route becomes non-streaming-capable (e.g. a programmatic navigation to `/files`)
- **THEN** the subscription, the channel id, and the pending events all survive the navigation, and no unsubscribe is sent

#### Scenario: Resolving the last event off-route tears the channel down

- **WHEN** the last pending event is resolved (login or decline reported successfully) while the current route is not streaming-capable
- **THEN** the report is sent on the pinned channel id and the frontend then unsubscribes immediately, rather than waiting for a route change or another idle period

#### Scenario: Navigating back to a streaming-capable page reconnects

- **WHEN** the flag is enabled and the user navigates from a non-streaming-capable page back to `/conversations` or `/apps-editor`
- **THEN** the frontend opens a new client-channel subscription, same as the existing flag-enabled mount behavior

#### Scenario: Navigating between conversations keeps the channel open

- **WHEN** the user navigates from `/conversations` to a different conversation still under `/conversations/*`
- **THEN** the existing client-channel subscription is not torn down or reconnected

### Requirement: The channel disconnects after a short idle period once nothing is generating

In addition to the existing route-scoped connect/disconnect lifecycle (mount on a streaming-capable route, disconnect on route-leave/flag-disable/unmount), `ClientChannelProvider` (`apps/chat/src/context/ClientChannelContext.tsx`) SHALL also disconnect the active client-channel subscription after a short idle grace period once no generation is active anywhere in the app, so an open subscription is not held for the entire time a user remains on a streaming-capable route without actually streaming anything.

`useConversationStream` (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`)'s `ConversationStreamChannel` capability interface SHALL expose an optional `notifyGenerationSettled?: () => void` callback, invoked once from both the `onComplete` and `onError` cleanup paths of `startStream`, after the existing generation-ending cleanup (mirroring the existing `overlay?.notifyGenerationStart?.()`/`overlay?.notifyGenerationEnd?.()` pattern already in that function). `GenerationContext` (`apps/chat/src/context/GenerationContext.tsx`) SHALL expose `hasActiveGeneration(): boolean`, true iff any entry in its registry currently has status `Active`.

On `notifyGenerationSettled()`, `ClientChannelProvider` SHALL:
- Do nothing if `hasActiveGeneration()` is `true` (another conversation, in this same browser tab, is still streaming).
- Do nothing except cancel any already-scheduled idle-disconnect timer if any sign-in event is still unresolved (`pendingEvents` is non-empty). A channel carrying an event DIAL Core is blocked on is not idle, and tearing it down would clear the pending events — dismissing the dialog that `toolset-signin-interrupt` requires to be dismissible only by resolving every listed event, and stranding Core's request unreported. This is the expected state whenever Core ends (or errors out of) the completion while it waits for the report.
- Otherwise schedule a disconnect after an idle grace delay of 1000ms, canceling any previously scheduled idle-disconnect timer first.

The scheduled timer SHALL re-evaluate both conditions when it fires and skip the disconnect if either now blocks it, since a generation can start and a sign-in event can arrive inside the grace window.

Once the last pending event is resolved (its report succeeds and the pending map becomes empty), the provider SHALL resume the normal lifecycle rather than leaving the channel pinned: disconnect immediately if the flag/route condition no longer holds, otherwise schedule the same 1000ms idle disconnect when nothing is generating, otherwise leave the still-active generation's own settle to schedule it.

`ensureConnected()` (already called at the start of every completion) SHALL cancel any pending idle-disconnect timer as its first step, so a new completion started within the grace window keeps the existing channel instead of tearing it down and reopening it.

This mechanism is scoped to generations tracked by this browser tab's own `GenerationContext` instance; it has no visibility into generations happening in a different tab or window.

#### Scenario: Idle disconnect after the only active generation completes

- **GIVEN** a client-channel subscription is open, exactly one generation is active, and no sign-in event is pending
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

#### Scenario: An unresolved sign-in event suppresses the idle disconnect

- **GIVEN** the sign-in dialog lists a pending event and no generation is active, because Core ended the completion while waiting for the report
- **WHEN** `notifyGenerationSettled()` is called and time passes well beyond the grace window
- **THEN** no disconnect happens: the subscription, the channel id, and the listed event all survive, so the user can still log in or decline

#### Scenario: An event arriving inside the grace window cancels the scheduled disconnect

- **GIVEN** a generation has settled with nothing pending and the 1000ms idle disconnect has been scheduled
- **WHEN** a `toolset/signin` event arrives on the still-open stream before the timer fires
- **THEN** the timer fires without disconnecting, and the channel stays open for the new event's report

#### Scenario: Resolving the last event resumes the idle countdown

- **GIVEN** the channel is pinned open by a single pending event, the route is still streaming-capable, and nothing is generating
- **WHEN** the user resolves that event (login or decline) and the report succeeds
- **THEN** the 1000ms idle countdown starts from that point and the channel disconnects when it elapses

#### Scenario: A completion started after an idle disconnect reconnects transparently

- **GIVEN** the channel was disconnected after an idle period
- **WHEN** the user sends a new completion
- **THEN** `ensureConnected()` opens a fresh subscription the same way it does on initial mount, and `waitForChannel`'s existing bounded wait covers the round trip before the completion's channel id is needed
