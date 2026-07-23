## Why

The `chat-overlay` change shipped a chat-only v1 method surface (`getMessages`, `sendMessage`, `setInputContent`, `setSystemPrompt`, `setTemperature`) and explicitly deferred every conversation-list mutation method. A host embedding `@epam/ai-dial-chat-overlay` today can talk to whichever single conversation is already displayed, but cannot list a user's conversations, switch between them, start a new one, or rename/delete one — the widget can only ever show the one conversation the app happened to load. That gap blocks the most basic "chat widget with a conversation switcher" integration pattern partner teams ask for.

## What Changes

- Add seven new `@DIAL_OVERLAY` request types and their payload/response types to the pure protocol module in `libs/chat-shared`: `GET_CONVERSATIONS`, `GET_SELECTED_CONVERSATIONS`, `SELECT_CONVERSATION`, `CREATE_CONVERSATION`, `CREATE_LOCAL_CONVERSATION`, `DELETE_CONVERSATION`, `RENAME_CONVERSATION`. Define a new host-agnostic `OverlayConversation` projection (id, title, updatedAt, isPinned, isReadonly, sharedWithMe, publishedWithMe) — a hand-written pure type, not an import of any generated `@epam/chat-api-client` DTO.
- Add an explicit, in-payload error signal (`OverlayConversationError` with `code`/`message`) for these seven methods only, so invalid ids, forbidden mutations, and invalid values reject with a clear reason instead of silently timing out — v1's existing chat methods are unaffected and keep their current timeout-only failure mode.
- Add the matching public methods to `ChatOverlay` (`getConversations`, `getSelectedConversations`, `selectConversation`, `createConversation`, `createLocalConversation`, `deleteConversation`, `renameConversation`) and their `overlayId`-forwarding equivalents on `ChatOverlayManager`, in `libs/chat-overlay`.
- **BREAKING (protocol-shape, pre-GA)**: `createConversation`'s new signature is `createConversation(options?: { deploymentId?: string; firstMessage?: string })`, replacing the old positional `(parentPath?, local?)` shape. `parentPath` has no equivalent — this app never creates conversations inside a folder — and is dropped rather than silently ignored. The old `local` boolean is replaced by omitting `firstMessage`: calling `createConversation()` with no `firstMessage` is defined to behave identically to `createLocalConversation()`.
- Add app-side handling in `apps/chat`: a new conversation-list bridge (mirroring the existing active-conversation bridge pattern), registered once `ConversationsContext`/`DeploymentsContext` are mounted, that backs `getConversations`/`getSelectedConversations`/`createConversation`/`createLocalConversation`/`deleteConversation`/`renameConversation`/`selectConversation` using the app's existing conversation-list state, navigation, and permission-enforcing REST calls — no new backend endpoints.
- Add a dedicated new sandbox case (`apps/chat-overlay-sandbox`) exercising all seven methods against both `ChatOverlay` and `ChatOverlayManager`, since the old reference sandbox had no dedicated page for these methods either and the current sandbox's two existing cases stay chat-only.

**Deferred (still out of scope):** playback conversations, import/export, custom message buttons, and any client-settable UI-section feature-toggle concept — unchanged from the previous change's Non-Goals.

## Capabilities

### New Capabilities

(none — this change extends the four capabilities the previous `chat-overlay` change introduced)

### Modified Capabilities

- `chat-overlay-protocol`: adds the seven new `OverlayRequestType` members, their payload/response types, the new `OverlayConversation` projection type, and the new conversation-method error-signal shape, plus scenarios for their request/response and error behavior.
- `chat-overlay-library`: adds the seven new `ChatOverlay` methods and their `ChatOverlayManager` `overlayId`-keyed equivalents, exported types, README updates, and unit tests. Documents the `createConversation` signature change as a compatibility break.
- `chat-overlay-app-mode`: adds a new conversation-list bridge (registration pattern, request routing, permission/error mapping) alongside the existing active-conversation bridge, and specifies how `CONVERSATIONS_UPDATED`/`SELECTED_CONVERSATION_LOADED` fire as a result of these methods.
- `chat-overlay-sandbox`: adds a new case demonstrating all seven methods through both `ChatOverlay` and `ChatOverlayManager`, replacing the previous spec's requirement that these methods NOT be presented as available.

## Impact

- **Affected code**: `libs/chat-shared/src/types/overlay/overlay-protocol.ts` (and its tests/exports), `libs/chat-overlay/src/lib/ChatOverlay.ts`, `libs/chat-overlay/src/lib/ChatOverlayManager.ts`, `libs/chat-overlay/src/index.ts`, `libs/chat-overlay/README.md`, `apps/chat/src/context/overlay/OverlayContext.tsx`, a new conversation-list bridge hook under `apps/chat/src/hooks/conversation/` (or `apps/chat/src/context/overlay/`), `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` (registers a lightweight compose-time hook for the local/draft path), `apps/chat-overlay-sandbox/src/cases/**` (new case), `apps/chat-overlay-sandbox/src/app/app.tsx` (new case-index entry).
- **Dependencies**: none new. No backend/OpenAPI changes — every new app-side behavior is implemented by composing `ConversationsContext`'s and `DeploymentsContext`'s existing methods and the existing `apps/chat/src/server-api/conversations.api.ts` wrappers, which already enforce ownership/permission via the normal REST calls a signed-in user's own UI actions already use.
- **Security**: no new trust boundary — these requests are gated by the same trusted-host-origin check `chat-overlay-protocol`/`chat-overlay-security-config` already enforce for active-conversation requests; per-conversation authorization (can this user rename/delete this conversation?) is enforced by the existing backend endpoints, not re-implemented here.
- **Scope-creep flags**: no backend endpoint changes, no `libs/chat-api-client` regeneration, no new `client-config` fields. This change stays inside the four capabilities listed above.
- **i18n/RTL/a11y**: none of this is user-facing chat-app UI; it is a background protocol/bridge addition. The new sandbox case follows the same plain-HTML, no-i18n-dependency pattern as the existing two sandbox cases.
- **Docs**: `libs/chat-overlay/README.md` gains the seven new methods and the `createConversation` compatibility-break note.
