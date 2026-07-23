## MODIFIED Requirements

### Requirement: OverlayContext is the sole owner of overlay-mode state

`apps/chat/src/context/overlay/OverlayContext.tsx` SHALL own: whether overlay mode is active, the `window` `message` listener, the handshake state machine, the stored `hostDomain`, the active-conversation bridge registry (including the currently-registered bridge's conversation id), and the conversation-list bridge registry added by this change. It SHALL follow the `ThemeContext` pattern (`createContext<T | undefined>(undefined)`, `useMemo`-wrapped value, a `useOverlay` hook that throws when used outside the provider) and SHALL be mounted in `apps/chat/src/main.tsx` only when overlay mode is detected (Requirement below) — it MUST NOT mount its `message` listener when overlay mode is inactive.

**Feature flag:** Not gated by `ENABLED_FEATURES`; gated by the dedicated overlay runtime-config flag from `chat-overlay-security-config`. The seven conversation-list methods added by this change introduce no additional feature-flag or role gate: authorization is enforced entirely by the existing per-conversation backend permission checks the regular (non-overlay) UI already relies on.

#### Scenario: Provider is absent from the tree outside overlay mode

- **WHEN** the app runs in its normal (non-embedded) mode
- **THEN** no `message` event listener registered by `OverlayContext` is attached to `window`

#### Scenario: useOverlay throws outside the provider

- **WHEN** `useOverlay()` is called from a component not wrapped in `OverlayProvider`
- **THEN** it throws an `Error` with a descriptive message

### Requirement: Active-conversation bridge registration

`OverlayContext` SHALL expose `registerActiveConversationBridge(bridge: ActiveConversationBridge | null, conversationId: string | null)` where `ActiveConversationBridge` provides `getMessages`, `sendMessage`, `setInputContent`, `setSystemPrompt`, `setTemperature` backed by whichever conversation `ConversationPage` currently has mounted, and `conversationId` is that conversation's id (or `null` when no conversation is mounted, e.g. the composer route). `OverlayContext` SHALL track the most recently registered `conversationId` for use by `GET_SELECTED_CONVERSATIONS`, `SELECT_CONVERSATION`, and the persisted branch of `CREATE_CONVERSATION` (see the conversation-list requirements below). `ConversationPage` SHALL call this registration in overlay mode from an effect that re-registers on every change to its local conversation reference and unregisters (`registerActiveConversationBridge(null, null)`) on unmount. An overlay request for one of the active-conversation methods received while no bridge is registered SHALL remain pending until either a bridge registers (and answers it) or the request's own timeout elapses (`chat-overlay-protocol`) — the app SHALL NOT respond with an error immediately just because no conversation is mounted yet.

Trusted-host and expiry rules: an active-conversation request SHALL be accepted only after a valid `SET_OVERLAY_OPTIONS` has established the trusted host origin. If the request is queued while no bridge is registered, the app SHALL drop it when the request's `expiresAt` deadline passes (`chat-overlay-protocol`; default app-side cap `10000` ms when absent).

#### Scenario: Active request before host validation is ignored

- **WHEN** `SEND_MESSAGE` is received before any valid `SET_OVERLAY_OPTIONS`
- **THEN** no active conversation method is invoked
- **AND** no response is posted for that request

#### Scenario: Request answered once a conversation mounts

- **WHEN** `GET_MESSAGES` is received before any `ConversationPage` instance has registered a bridge, and a bridge registers 200ms later
- **THEN** the request is answered using that bridge once it registers, within the request's timeout

#### Scenario: Queued request expires before a conversation mounts

- **WHEN** `GET_MESSAGES` is received from the trusted host while no bridge is registered
- **AND** the request's `expiresAt` time passes before any bridge registers
- **THEN** the request is dropped
- **AND** registering a bridge later does not invoke `getMessages` for that expired request

#### Scenario: Bridge re-registers on conversation change

- **WHEN** the user navigates from one conversation to another while overlay mode is active
- **THEN** `registerActiveConversationBridge` is called again with a bridge and `conversationId` backed by the newly displayed conversation, and a subsequent `sendMessage` request is answered using the new conversation, not the previous one

#### Scenario: Unregister on unmount leaves no stale bridge

- **WHEN** `ConversationPage` unmounts (e.g. navigating to `/catalog`)
- **THEN** `registerActiveConversationBridge(null, null)` is called, and a subsequent active-conversation request stays pending rather than resolving against a stale conversation

#### Scenario: Tracked conversationId updates with the bridge

- **WHEN** `registerActiveConversationBridge(bridge, 'conv-2')` is called after a previous `registerActiveConversationBridge(bridge, 'conv-1')`
- **THEN** `OverlayContext`'s internally tracked current conversation id is `'conv-2'`, used by any subsequently-handled `GET_SELECTED_CONVERSATIONS` request

### Requirement: Chat and generation events are emitted from existing hooks

The app SHALL emit, only in overlay mode: `GPT_START_GENERATING` when `useConversationStream`'s `startStream` begins a generation for the active conversation; `GPT_END_GENERATING` on that generation's `onComplete`; `STOP_GENERATING` when the user (or host, via a future method) stops an active generation; `SELECTED_CONVERSATION_LOADED` whenever `ConversationPage` finishes loading a conversation (including the initial `overlayConversationId` load and any subsequent navigation, and navigation performed on behalf of `SELECT_CONVERSATION` or a persisted `CREATE_CONVERSATION` request); `CONVERSATIONS_UPDATED` whenever `ConversationsContext`'s conversation list changes (including changes made through the conversation-list bridge's `createConversation`/`deleteConversation`/`renameConversation`). Emission SHALL be additive — none of these hooks change behavior for non-overlay mode.

#### Scenario: Generation lifecycle events fire in order

- **WHEN** the active conversation's stream starts and later completes
- **THEN** `GPT_START_GENERATING` fires before `GPT_END_GENERATING`, and no `GPT_END_GENERATING` fires without a preceding `GPT_START_GENERATING` for the same generation

#### Scenario: Stop emits STOP_GENERATING, not GPT_END_GENERATING

- **WHEN** the user stops an in-flight generation
- **THEN** `STOP_GENERATING` fires
- **AND** `GPT_END_GENERATING` does not also fire for that same generation

#### Scenario: Non-overlay mode is unaffected

- **WHEN** the app is not in overlay mode and a generation starts/completes
- **THEN** no `@DIAL_OVERLAY` message is posted anywhere

#### Scenario: CONVERSATIONS_UPDATED fires for conversation-list mutations

- **WHEN** an overlay host calls `deleteConversation`, `renameConversation`, or a persisted (`firstMessage`-bearing) `createConversation`
- **THEN** `CONVERSATIONS_UPDATED` fires exactly once the corresponding `ConversationsContext` state settles, through the same list-changed effect that already fires it for in-app pin/delete/rename actions — no second, bridge-specific emission path is added

#### Scenario: SELECTED_CONVERSATION_LOADED fires after selectConversation navigates

- **WHEN** an overlay host calls `selectConversation(id)` for an accessible conversation
- **THEN** the app navigates to that conversation, `ConversationPage` mounts and loads it, and `SELECTED_CONVERSATION_LOADED` fires through the existing `notifyConversationLoaded()` call — no separate event is introduced for this method

## ADDED Requirements

### Requirement: Conversation-list bridge registration

`OverlayContext` SHALL expose `registerConversationListBridge(bridge: ConversationListBridge | null)`, structurally parallel to `registerActiveConversationBridge`, where `ConversationListBridge` provides `getConversations`, `createConversation`, `deleteConversation`, `renameConversation`, and `selectConversation`, backed by `ConversationsContext`/`DeploymentsContext`/navigation. A new hook mounted once inside the app tree — below `ConversationsProvider` and `DeploymentsProvider`, so both are reachable — SHALL register this bridge on mount/dependency-change and unregister it on unmount, following the same effect-cleanup pattern as `useActiveConversationBridge`. `GET_CONVERSATIONS`, `CREATE_CONVERSATION`, `CREATE_LOCAL_CONVERSATION`, `DELETE_CONVERSATION`, and `RENAME_CONVERSATION` requests received while no conversation-list bridge is registered SHALL remain pending until either the bridge registers (and answers them) or the request's own `expiresAt` deadline passes — the same queue-and-expire mechanism already used for active-conversation requests, not a new timer construct.

#### Scenario: Bridge answers a request once registered

- **WHEN** `GET_CONVERSATIONS` is received before the conversation-list bridge has registered, and it registers 100ms later
- **THEN** the request is answered using that bridge once it registers, within the request's timeout

#### Scenario: Queued conversation-list request expires if the bridge never registers

- **WHEN** `DELETE_CONVERSATION` is received from the trusted host while no conversation-list bridge is registered
- **AND** the request's `expiresAt` time passes before the bridge registers
- **THEN** the request is dropped and produces no response

#### Scenario: Bridge unregisters on unmount

- **WHEN** the component owning the conversation-list bridge unmounts
- **THEN** `registerConversationListBridge(null)` is called, and a subsequent conversation-list request stays pending rather than resolving against a stale bridge

### Requirement: getConversations returns the current in-memory list, no forced refresh

`GET_CONVERSATIONS` SHALL be answered with `{ conversations: <ConversationsContext.conversations mapped to OverlayConversation[]> }` using whatever is currently loaded in `ConversationsContext` at the time the request is handled — it SHALL NOT trigger a `refreshConversations()` call, and SHALL NOT attempt pagination beyond `ConversationsContext`'s existing single-page (`limit: 1000`) load.

#### Scenario: Reflects the currently loaded list

- **WHEN** `GET_CONVERSATIONS` is received after `ConversationsContext` has finished its initial load
- **THEN** the response's `conversations` array matches `ConversationsContext.conversations` at that moment, mapped field-for-field into `OverlayConversation`

#### Scenario: Empty before the initial load resolves

- **WHEN** `GET_CONVERSATIONS` is received before `ConversationsContext`'s initial `listConversations()` call has resolved
- **THEN** the response's `conversations` array is empty, reflecting the context's current (not-yet-loaded) state rather than blocking for the load to finish

### Requirement: getSelectedConversations reflects the currently displayed conversation

`GET_SELECTED_CONVERSATIONS` SHALL be answered by `OverlayContext` using its tracked active-conversation id (set by `registerActiveConversationBridge`'s `conversationId` argument): if a conversation is currently mounted, the response is `{ conversations: [<that conversation's OverlayConversation projection>] }`, looked up from the conversation-list bridge's current snapshot (or, if not yet present in that snapshot, built directly from the active conversation's own known id/title so a conversation created moments ago is still reported). If no conversation is currently mounted (e.g. the composer route is active, or nothing has loaded yet), the response is `{ conversations: [] }`.

#### Scenario: Returns the one active conversation

- **WHEN** `ConversationPage` has a conversation mounted and `GET_SELECTED_CONVERSATIONS` is received
- **THEN** the response's `conversations` array has exactly one item matching that conversation's id

#### Scenario: Returns an empty array when the composer is active

- **WHEN** the composer route (`ConversationRoute`, no conversation selected) is the currently displayed view and `GET_SELECTED_CONVERSATIONS` is received
- **THEN** the response's `conversations` array is empty

#### Scenario: Reflects a just-created conversation not yet in the list snapshot

- **WHEN** a conversation was created moments ago (its `ConversationPage` has registered as the active bridge) but `ConversationsContext.conversations` has not yet been refreshed to include it
- **THEN** `GET_SELECTED_CONVERSATIONS` still returns that conversation, built from the active bridge's own known id/title rather than omitting it

### Requirement: selectConversation navigates and waits for that conversation to load

`SELECT_CONVERSATION` SHALL navigate to `getConversationRoute(payload.id)` and wait for `OverlayContext`'s tracked active-conversation id to equal `payload.id` before responding `{ conversation: <projection> }`. If the id never resolves before the request's `expiresAt`, the request is dropped (no response is sent) — the same timeout-based failure mode as an unanswered active-conversation request, accepted as a known limitation for ids that fail to load (see `design.md` Risks) rather than requiring a synchronous existence pre-check.

#### Scenario: Selecting an accessible conversation resolves with its projection

- **WHEN** `SELECT_CONVERSATION` is received with `{ id: 'conv-1' }` for an id the current user can access
- **THEN** the app navigates to `conv-1`, `ConversationPage` mounts and registers as the active bridge with `conversationId: 'conv-1'`, and the app responds `{ conversation: { id: 'conv-1', ... } }`

#### Scenario: Selecting an inaccessible conversation times out rather than erroring

- **WHEN** `SELECT_CONVERSATION` is received with an id the current user cannot access
- **THEN** the app navigates but no `ConversationPage` ever registers with that id, and the request is dropped once `expiresAt` passes, matching this change's documented asymmetry with delete/rename's explicit error responses

### Requirement: createConversation persists immediately when firstMessage is present, otherwise opens the composer

`CREATE_CONVERSATION` SHALL be handled as follows: when `payload.firstMessage` is a non-blank string, the app resolves `deploymentId` (payload value, else `DeploymentsContext.selectedItemId`), creates and saves the conversation using the same API calls `ConversationRoute.handleCreateConversation` already uses, navigates to its route, and responds `{ conversation: <projection> }` once the conversation is created (not waiting for `ConversationPage` to finish mounting — the projection is built directly from the create response, which is always `isPinned: false`, `isReadonly: false`, `sharedWithMe: false`, `publishedWithMe: false` for a freshly created conversation). When `payload.firstMessage` is absent or blank, the app navigates to the composer route (`ROUTES.Root`), passing `payload.deploymentId` (if present) as router state for the composer to pre-select, and responds immediately with `{ conversation: null }` — nothing is persisted until a message is later sent through the composer or the overlay's active-conversation `sendMessage`, at which point ordinary `CONVERSATIONS_UPDATED`/`SELECTED_CONVERSATION_LOADED` emission applies exactly as it would for a manually-typed first message.

`CREATE_LOCAL_CONVERSATION` SHALL be handled identically to `CREATE_CONVERSATION` with no `deploymentId` and no `firstMessage` — the app applies its normal default-deployment resolution and responds `{ conversation: null }` via the same composer-navigation path.

#### Scenario: createConversation with firstMessage persists and resolves with a real conversation

- **WHEN** `CREATE_CONVERSATION` is received with `{ deploymentId: 'gpt-4o', firstMessage: 'Hello' }`
- **THEN** a conversation is created via the existing create+save flow, the app navigates to it, and the response is `{ conversation: { id: '...', title: '...', ... } }`

#### Scenario: createConversation without firstMessage opens the composer without persisting

- **WHEN** `CREATE_CONVERSATION` is received with `{ deploymentId: 'gpt-4o' }` and no `firstMessage`
- **THEN** the app navigates to the composer route with `gpt-4o` pre-selected, no conversation is created, and the response is `{ conversation: null }`

#### Scenario: createLocalConversation matches createConversation with firstMessage omitted

- **WHEN** `CREATE_LOCAL_CONVERSATION` is received
- **THEN** the app's handling is identical to `CREATE_CONVERSATION` with no `deploymentId` and no `firstMessage`: it navigates to the composer with the default deployment and responds `{ conversation: null }`

### Requirement: deleteConversation and renameConversation reuse ConversationsContext and map failures to explicit errors

`DELETE_CONVERSATION` SHALL call `ConversationsContext.deleteConversation(payload.id)`; `RENAME_CONVERSATION` SHALL call `ConversationsContext.renameConversation(payload.id, payload.newName)` after rejecting a blank/whitespace-only `newName` with `{ error: { code: 'INVALID_ARGUMENT', message: '...' } }` before any network call. Both calls already optimistically update `ConversationsContext`'s state and revert on failure (existing behavior, unchanged). A thrown error from either call SHALL be mapped to `OverlayConversationError` using the existing HTTP-status pattern (`apps/chat/src/server-api/api-error.ts`): status `404` → `code: 'NOT_FOUND'`, status `403` → `code: 'FORBIDDEN'`, any other failure → the closest matching code with the API's own error message where available. On success, `DELETE_CONVERSATION` responds with no `error` field; `RENAME_CONVERSATION` responds with `{ conversation: <updated projection> }`.

#### Scenario: Deleting a read-only shared conversation is rejected explicitly

- **WHEN** `DELETE_CONVERSATION` is received for a conversation the current user has only read access to (backend returns 403)
- **THEN** the response is `{ error: { code: 'FORBIDDEN', message: '...' } }`, and `ConversationsContext`'s optimistic removal is reverted exactly as it already is for an in-app delete failure

#### Scenario: Renaming an unknown id is rejected explicitly

- **WHEN** `RENAME_CONVERSATION` is received for an id that does not exist (backend returns 404)
- **THEN** the response is `{ error: { code: 'NOT_FOUND', message: '...' } }`

#### Scenario: Blank newName is rejected before any network call

- **WHEN** `RENAME_CONVERSATION` is received with `{ id: 'conv-1', newName: '   ' }`
- **THEN** the response is `{ error: { code: 'INVALID_ARGUMENT', message: '...' } }` and no rename request reaches the backend

#### Scenario: Successful delete/rename produce no error field

- **WHEN** `DELETE_CONVERSATION`/`RENAME_CONVERSATION` succeed against the backend
- **THEN** their responses carry no `error` field, and (for rename) the response's `conversation` reflects the new title
