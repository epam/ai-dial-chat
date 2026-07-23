## MODIFIED Requirements

### Requirement: Sandbox exercises both ChatOverlay and ChatOverlayManager

The sandbox SHALL provide at least one case using `ChatOverlay` directly and at least one case using `ChatOverlayManager`, each demonstrating: `ready()` -> `getMessages()` -> `sendMessage()`; a `setOverlayOptions` call changing `theme` and `modelId` after initial load; `setInputContent`; `setSystemPrompt`; `setTemperature`; a `loaderHideEvent` override; and subscription to `GPT_START_GENERATING`/`GPT_END_GENERATING`/`STOP_GENERATING`/`SELECTED_CONVERSATION_LOADED`/`CONVERSATIONS_UPDATED`. The `ChatOverlayManager` case SHALL additionally demonstrate `position`, `showOverlay`/`hideOverlay`, `removeOverlay`, and fullscreen open (when `allowFullscreen` is set). The conversation-list methods (`getConversations`, `getSelectedConversations`, `selectConversation`, `createConversation`, `createLocalConversation`, `deleteConversation`, `renameConversation`) are demonstrated by the dedicated case added by this change (see below), not by these two existing cases — they stay chat-method-only.

#### Scenario: Direct ChatOverlay case demonstrates the v1 method surface

- **WHEN** the direct-overlay sandbox case is opened and its "Send message" and "Get messages" actions are used after `ready()` resolves
- **THEN** the sent message appears in the conversation and the retrieved messages include it

#### Scenario: ChatOverlayManager case demonstrates show/hide/remove

- **WHEN** the manager sandbox case's show, hide, and remove controls are used in sequence
- **THEN** the overlay becomes visible, then hidden, then its DOM is removed and its toggle button disappears

#### Scenario: Still-deferred methods are not presented anywhere in the sandbox

- **WHEN** the sandbox's case list and every case's controls are inspected
- **THEN** none of them presents an action for playback conversations, import/export, or custom message buttons — these remain out of scope for this change

## ADDED Requirements

### Requirement: A dedicated case exercises all seven conversation-list methods

The sandbox SHALL provide a case (or case section) — reachable from the case index alongside the existing "Direct ChatOverlay case" and "ChatOverlayManager case" entries — demonstrating all seven conversation-list methods through both a direct `ChatOverlay` instance and a `ChatOverlayManager`-managed overlay. At minimum it SHALL provide:

- A "Get conversations" action that logs the JSON response.
- A "Get selected conversations" action that logs the JSON response.
- A "Create conversation" action with an optional deployment-id input and an optional first-message input, calling `createConversation({ deploymentId, firstMessage })` with either field omitted when left blank — demonstrating both the persist-immediately path (first message provided) and the composer-opening path (first message left blank).
- A "Create local conversation" action calling `createLocalConversation()` with no inputs.
- A conversation-id input, populated/selectable from the most recent "Get conversations" result, used by the select/rename/delete actions below.
- A "Select conversation by id" action.
- A "Rename conversation by id" action with a new-name text input.
- A "Delete conversation by id" action.
- A "Refresh list" action that re-runs "Get conversations" and updates the sandbox's own local id list/selector.
- An event/response log using the existing `EventLog` component pattern, logging every request's JSON response including `error` fields when present.

Imports SHALL come from `@epam/ai-dial-chat-overlay`, matching the existing two cases — not a relative path into `libs/chat-overlay/src`.

#### Scenario: Case is reachable from the sandbox index

- **WHEN** the sandbox's landing page (`apps/chat-overlay-sandbox/src/app/app.tsx`) is inspected
- **THEN** it lists a case for conversation-list methods alongside "Direct ChatOverlay case" and "ChatOverlayManager case"

#### Scenario: Create with a first message persists and appears in a subsequent Get conversations call

- **WHEN** the case's "Create conversation" action is used with a first-message value filled in, followed by "Refresh list"
- **THEN** the newly created conversation appears in the refreshed list

#### Scenario: Create with no first message opens the composer without appearing in the list

- **WHEN** the case's "Create conversation" action is used with the first-message input left blank, followed by "Refresh list"
- **THEN** the embedded app navigates to its composer view, the response log shows `{ conversation: null }`, and the refreshed list is unchanged

#### Scenario: Delete/rename error responses are visible in the log

- **WHEN** "Delete conversation by id" or "Rename conversation by id" is used with an id that the case's own state no longer has access to (e.g. already deleted)
- **THEN** the event log shows the response's `error` field rather than the case silently doing nothing

#### Scenario: Both direct and manager paths are exercised

- **WHEN** the conversation-list case's Direct and Manager sections are each used to call `getConversations()`
- **THEN** both the plain `ChatOverlay` instance and the `ChatOverlayManager`-managed instance return a response, verifying the manager's `overlayId`-forwarding for all seven new methods

### Requirement: Case wiring for the new case is covered by automated component tests

The conversation-list case wrapper component(s) SHALL have a Vitest component test (co-located `tests/` folder) asserting that each of the seven actions invokes the corresponding `ChatOverlay`/`ChatOverlayManager` method with the expected arguments, using a mocked/faked overlay instance (no real iframe/network) — following the same pattern the existing `DirectOverlayCase`/`ManagerOverlayCase` tests already use for the v1 methods.

#### Scenario: Test asserts the create-with-firstMessage call shape

- **WHEN** the conversation-list case's Vitest test simulates filling in a first message and clicking "Create conversation"
- **THEN** it asserts the mocked `createConversation` was called with `{ deploymentId: ..., firstMessage: '...' }` matching the form's current values
