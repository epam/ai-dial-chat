## Context

User message bubbles display an edit button (in `libs/conversation-messages`) that is currently wired to nothing. The `Input` component in `libs/conversation-input` already handles textarea editing, attachment management (add/remove/retry), file drag-drop, and paste-to-attach — making it the natural base for the edit UI. The app uses hook-based state (`useConversationHandlers`) with no external state manager.

## Goals / Non-Goals

**Goals:**
- Make the edit button functional on desktop and mobile (inline, in-place).
- Reuse `Input` for the edit area with minimal forking.
- On submit: update the message, truncate all subsequent messages, re-run the AI.
- Allow multiple messages in edit mode simultaneously; submitting one silently cancels the rest.
- Disable the edit button during streaming.

**Non-Goals:**
- Edit of assistant messages.
- Optimistic backend persistence of the edited message before AI responds.
- Undo / redo of edits.
- Conflict resolution if the same conversation is open in another tab.

## Decisions

### D1 — Extend `Input` with `renderFooterActions` and `initialAttachments` rather than forking

`Input`'s action bar (send/stop buttons) is currently inline JSX with no slot. Adding two optional props avoids duplicating the attachment management, auto-grow textarea, file drop, and paste logic:

- `initialAttachments?: Attachment[]` — sets the initial attachment state on mount.
- `renderFooterActions?: (helpers: { canSend: boolean; onSend: () => void }) => ReactNode` — when provided, replaces the send/stop/model-selector area with the caller's content. The render prop exposes `canSend` (message non-empty) and `onSend` (the same internal send handler) so callers can build buttons that slot naturally into the existing flow.

**Alternative considered:** Extract a `BaseInput` component (textarea + attachments only) and wrap it in both `Input` and `EditMessageInput`. Rejected because it requires a larger refactor of an already-stable component before the feature even starts, with no additional benefit for this use case.

### D2 — `EditMessageInput` lives in `libs/conversation-input`

The component is a thin wrapper over `Input` that pre-populates content and swaps the footer. It carries no app knowledge (no API URLs, no routing, no i18n keys hardcoded). All strings come in as props with English defaults (lib convention). Placing it in `libs/conversation-input` keeps attachment and input concerns co-located and keeps the app layer thin.

### D3 — Edit state lives in `useConversationHandlers` as a `Set<string>`

`editingMessageIds: Set<string>` tracks which message IDs are currently in edit mode. This is pure UI state with a bounded lifecycle (lives and dies with the conversation view), so local hook state is correct — no context or global store needed.

### D4 — `handleEditMessage` mirrors `handleRegenerateMessage`

The submit flow is:
1. `attachmentsToDtos(attachments)` — convert `Attachment[]` to DTOs (same as `handleSend`).
2. Update `messages[idx]` with new content and attachments in place.
3. Slice the message array to `[0..idx+1]` — drop everything after the edited user message.
4. Create a fresh empty assistant message placeholder (same as `handleSend`).
5. `setConversation([...sliced, newAssistantMessage])`.
6. `saveConversation(path, updated)` — persist the truncated conversation.
7. `startStream(path, message, newAssistantId, model, { attachments })`.
8. Clear `editingMessageIds` entirely (submitting one cancels all others silently).

### D5 — `ConversationView` owns the switch between display and edit mode

`UserMessageBubble` stays display-only. `ConversationView` conditionally renders either `<UserMessageBubble>` or `<EditMessageInput>` for each message based on whether its ID is in `editingMessageIds`. This keeps the display component simple and avoids passing edit callbacks deep into the message tree.

## Risks / Trade-offs

- **`renderFooterActions` API surface** — adding a render prop to `Input` broadens its contract. Future changes to the internal send flow must keep `onSend` semantics stable. Mitigation: keep the helper shape narrow (`canSend`, `onSend` only); document in JSDoc.
- **`[field-sizing:content]` browser support** — already used in `Input`; no new risk.
- **Multiple edits + streaming start race** — if a user submits an edit while a previous stream has just ended but `isStreaming` is still briefly `true`, `handleEditMessage` should guard the same way `handleRegenerateMessage` does (`if (isStreaming) return`).
- **Attachment object URL cleanup** — `Input` revokes object URLs on send and unmount. `EditMessageInput` passes `initialAttachments` that may already have blob URLs owned by the parent. The component must not revoke URLs it did not create. Mitigation: `initialAttachments` should use stable server-side URLs (from the saved conversation), not transient blob URLs.
