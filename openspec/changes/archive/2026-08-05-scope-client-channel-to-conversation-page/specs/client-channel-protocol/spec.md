## MODIFIED Requirements

### Requirement: `liveChatInteraction` feature flag gates the mechanism

The mechanism SHALL be gated by a feature flag key `liveChatInteraction`, read via the existing `AppConfigContext`/`useFeatureFlag` mechanism (server-supplied `features` map). When the flag is `false` or not yet `Ready`, the frontend SHALL NOT attempt to subscribe to the client channel and SHALL NOT attach a channel id to completion requests.

In addition, the frontend SHALL only hold an open client-channel subscription while the current route is a streaming-capable page — `ROUTES.Conversations` (`/conversations` and any sub-path, e.g. a specific `/conversations/<id>`) or `ROUTES.AppsEditor` (`/apps-editor`) — matching `useConversationStream`'s two call sites (`Conversation` and `AppPreviewChat`). `ROUTES.Root` (`/`, the pre-conversation composer/empty state rendered by `ConversationRoute`) SHALL NOT count as streaming-capable: it creates a new conversation via a plain REST call and navigates to `/conversations/<id>` before any stream can exist, so it never itself hosts a live stream. `ClientChannelProvider` SHALL derive this route condition using `react-router`'s `useMatch`, since the provider is mounted inside `BrowserRouter`. The connect/reconnect/visibility-resume logic SHALL require both the flag being enabled AND the route condition; leaving a streaming-capable route while the channel is open SHALL disconnect it (unsubscribe from Core, clear pending events) the same way disabling the flag does today, and returning to a streaming-capable route (flag still enabled) SHALL reconnect it.

The backend SHALL also enforce the flag server-side (defense in depth, so a restricted or fully-disabled user cannot bypass the frontend gate by calling the API directly): `POST /api/v1/client-channel/subscribe` and `POST /api/v1/client-channel/report` SHALL apply the existing `FeatureGuard`/`@RequireFeature(FeatureKey.LiveChatInteraction)` mechanism and return `403` when the flag resolves to `false` for the caller (including role-restricted denials via `LIVE_CHAT_INTERACTION_ENABLED_ROLES`). `POST /api/v1/client-channel/unsubscribe` SHALL NOT be gated by the flag, so a client that already holds an open channel can always tear it down (e.g. the flag flips off mid-session, the user's role no longer qualifies, or the user navigates off a streaming-capable route) regardless of the flag's current value for that user.

#### Scenario: Flag disabled

- **WHEN** `liveChatInteraction` resolves to `false`
- **THEN** no subscribe request is made and completions carry no channel id

#### Scenario: Flag flips to disabled while a channel is active

- **WHEN** the flag becomes `false` after a channel was already subscribed
- **THEN** the frontend calls unsubscribe for the active channel and clears any pending signin events from the dialog state

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

- **WHEN** the flag is enabled, a channel is currently open, and the user navigates from `/conversations` to `/files`
- **THEN** the frontend calls unsubscribe for the active channel, clears the channel id and any pending signin events, and does not attempt to reconnect while on `/files`

#### Scenario: Navigating back to a streaming-capable page reconnects

- **WHEN** the flag is enabled and the user navigates from a non-streaming-capable page back to `/conversations` or `/apps-editor`
- **THEN** the frontend opens a new client-channel subscription, same as the existing flag-enabled mount behavior

#### Scenario: Navigating between conversations keeps the channel open

- **WHEN** the user navigates from `/conversations` to a different conversation still under `/conversations/*`
- **THEN** the existing client-channel subscription is not torn down or reconnected
