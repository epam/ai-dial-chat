## Context

`AppsEditor` (`apps/chat/src/pages/AppsEditor/AppsEditor.tsx`) has two steps: General (creates the app via `POST /api/v1/applications`) and Settings (`SettingsStep` → `AppEditorIframe`, an `<iframe>` pointed at `schema.editorUrl`, driven by a `postMessage` protocol — `AppsEditorEvent.TriggerSave` in, `SaveSuccess`/`SaveError`/`UpdatedSuccess`/`ReadyToInteract` out; see `apps/chat/src/types/apps-editor.ts`). `EditorHeader` (`apps/chat/src/components/EditorHeader/EditorHeader.tsx`) renders title/steps nav on the left and Cancel/Save on the right; it is shared with `ToolsetEditor` today only insofar as both editors *could* use it, but `ToolsetEditor` in fact uses its own `ToolsetEditorHeader` and never imports `EditorHeader` — so it is safe to add an app-specific `onPreview` prop without affecting toolsets.

Real conversations are rendered by `ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`) inside `Conversation.tsx` (`apps/chat/src/pages/Conversation/Conversation.tsx`), backed by `useConversationStream` + `useConversationHandlers`, both keyed by a persisted `conversationId`/path (SSE watch via `conversations/watch`, `getConversation`/`saveConversation` calls). A brand-new chat is created by `ConversationRoute.tsx` (`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`): it renders a centered `ConversationInput` with a greeting, and on first send calls `apiCreateConversation(message, selectedItemId, attachmentDtos)` then navigates to the resulting conversation's route.

**Revision note (superseding an earlier iteration of this design):** the first pass of this change added a new stateless `POST /api/v1/conversations/preview-completions` endpoint and a dedicated `usePreviewCompletion` frontend hook specifically to keep preview chats out of persisted storage. That path was implemented, then reverted per explicit product decision: it does not support attachments, audio transcription, or chat settings without extending the backend contract further, and duplicates completion logic that already exists. This design now reuses the real, existing conversation stack end-to-end and simply deletes the preview conversation when the editor is left.

## Goals / Non-Goals

**Goals:**

- Let an app author, from inside the Settings step of the Apps editor, save their in-progress app and immediately chat with it live, with full feature parity with a normal chat (attachments, transcription, chat settings, edit/regenerate/rate).
- Keep the model fixed to the application under edit — the model selector is visible (so the UI looks identical to a real chat) but disabled, so it cannot be changed.
- Preserve the preview conversation across toggling Preview ↔ Settings within one editor session.
- Delete the preview conversation when the editor is left (Cancel, a normal Save-and-exit, or navigating away), so it does not linger in the user's conversation history.

**Non-Goals:**

- Hiding the preview conversation from the sidebar while the editor session is open. It is a real conversation for the duration of the session; only its cleanup afterward is special.
- Resuming a preview conversation across a hard page reload. A reload starts a fresh preview (any conversation created in the previous session is orphaned and relies on normal user-initiated deletion, or a future best-effort `beforeunload` cleanup — not attempted here).
- Adding preview to `ToolsetEditor` or any other editor.
- Building a generic "compare mode" or multi-preview-tab system — one preview pane per editor session.

## Decisions

### 1. Reuse real conversation creation/streaming/deletion — no new backend endpoint

The earlier stateless `/conversations/preview-completions` endpoint, its DTOs, and the `usePreviewCompletion`/`preview-completion.api.ts` frontend hook are removed. Preview chats now go through the exact same path as a normal new chat:

- First message: `apiCreateConversation(message, appId, attachmentDtos)` (same call `ConversationRoute.tsx` makes), then `saveConversation` with the initial chat-settings values, exactly mirroring `ConversationRoute.handleSend`.
- Subsequent messages and streaming: `useConversationStream` + `useConversationHandlers`, exactly as `Conversation.tsx` uses them, parameterized by the created conversation's id.
- Stop: the existing `handleStop` from `useConversationStream` — no new abort plumbing needed.

This means attachments, audio transcription, chat settings (temperature/system prompt/response format), edit, regenerate, and rate all work in preview with zero new backend code, because they are the same code path a real chat uses.

**Alternative considered (superseded):** a stateless completion endpoint that never touches DIAL Core storage. Rejected because it cannot support attachments/settings without significant backend contract growth, and the product decision changed to accept a real, cleaned-up-afterward conversation instead of a genuinely ephemeral one.

### 2. `AppPreviewChat` owns the preview conversation lifecycle, mounted-but-hidden like the iframe

`AppPreviewChat` (`apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx`) is rendered by `SettingsStep` **whenever an app id exists**, mounted at all times alongside `AppEditorIframe` and toggled visible/hidden via CSS exactly like the iframe already is (Decision 4 below) — not conditionally mounted only while `isPreviewing`. This lets its internal `conversationId` state (and the `useConversationStream`/`useConversationHandlers` state it owns) survive toggling Preview ↔ Settings within a session, and gives it a single, well-defined unmount point (when `SettingsStep` itself unmounts — i.e. the user leaves the Settings step or the editor) at which to run cleanup.

Internally, `AppPreviewChat`:

- Before a conversation exists: renders the same centered composer experience as `ConversationRoute.tsx` (same `ConversationInput` usage, greeting text) with the model fixed. On send, calls `apiCreateConversation`/`saveConversation` and stores the returned id in local state — no router navigation occurs (this is the key difference from `ConversationRoute.tsx`, which navigates to the new conversation's route).
- Once a conversation exists: renders `ConversationView` bound to `useConversationStream`/`useConversationHandlers` for that id, exactly like `Conversation.tsx`, with `fixedModel` set (see Decision 3).
- On unmount: if a conversation was created, calls `deleteConversation(path)` (best-effort; failures are logged, not surfaced, since the user is already navigating away).

### 3. Model fixed via a shown-but-disabled selector, not a hidden one

`ConversationView` gains an optional `fixedModel?: { id: string; displayName?: string; iconUrl?: string }` prop (replacing an earlier, since-reverted `isModelFixed: boolean` that hid the selector entirely). When set:

- `deployments` passed to `ConversationInput` becomes a single-item list containing just `fixedModel`, so the chip shows the app's name/icon instead of whatever the global deployment context has selected.
- `selectedDeploymentId` is pinned to `fixedModel.id`; `onDeploymentChange` is `undefined`.
- A new `isModelSelectorDisabled` prop (added to `libs/conversation-input`, see Decision 5) is passed through so the selector renders dimmed and does not open, while remaining visible — matching the explicit product requirement that the selector be **disabled, not hidden**.

### 4. Keep `AppEditorIframe` mounted (hidden, not unmounted) while previewing — unchanged

`SettingsStep` renders both `AppEditorIframe` (visually hidden via `hidden`/`display:none`, not unmounted) and `AppPreviewChat` (mounted whenever an app id exists, visible only while `isPreviewing`), toggling visibility. Rationale unchanged from the original design: avoids a reload/flash on the iframe, and (per Decision 2) lets `AppPreviewChat` retain its conversation across toggles.

### 5. `isModelSelectorDisabled`, a new generic prop on `libs/conversation-input`

`ModelSelectorControl` previously only supported "fully enabled" or "fully disabled along with the rest of the composer" (`isInputDisabled`, which also blocks typing/sending). Preview needs typing/sending to work normally while only the model selector is locked. Added `isModelSelectorDisabled` (threaded through `ConversationInputProps` → `InputProps` → `ModelSelectorControl`'s `isDisabled`) that dims the control and blocks all three variants (desktop dropdown, desktop overlay, mobile bottom-sheet trigger) from opening, independent of `isInputDisabled`/`isStreaming`. This is a generic, host-agnostic capability (any app could want a locked model chip), so it lives in the lib rather than being special-cased for Apps-editor preview.

### 6. Icon choice — unchanged

`IconEye` (open preview) / `IconEyeOff` (exit preview) from `@tabler/icons-react`. Both are direction-symmetric — no RTL mirroring needed.

### 7. Preview button placement — right side, next to Cancel/Save

**Revision:** an earlier iteration placed the button on the left, next to the title/steps nav. Moved to the right-hand action group (before Cancel/Save) per explicit product feedback — it reads more naturally as a save-adjacent action ("Preview", "Cancel", "Save") than as a navigation-adjacent one.

### 8. i18n — unchanged

`AppsEditorI18nKeys.PreviewButton`, `ExitPreviewButton`, `PreviewChatPlaceholder` (composer placeholder), `PreviewChatAriaLabel` (region aria-label), added to `en.json` (the only locale file that exists in this repo today) and to every future locale file per `AGENTS.md` §Adding a new locale.

## Risks / Trade-offs

- **[Trade-off]** The preview conversation is real and briefly visible in the sidebar during the editing session. Accepted — the whole point of this revision is to get full chat feature parity for free by being a real conversation; hiding it again would reintroduce the complexity this revision removes.
- **[Risk]** If the user closes the tab or hard-reloads instead of using Cancel/Save, the `useEffect` unmount cleanup never runs and the preview conversation is orphaned in their history. → **Mitigation**: accepted for v1 (Non-Goals); the user can delete it manually like any other conversation. A `beforeunload`-based best-effort cleanup could be added later if this proves annoying in practice.
- **[Risk]** `AppPreviewChat` duplicates a meaningful slice of `ConversationRoute.tsx`/`Conversation.tsx` logic (create-on-first-send, then stream). → **Mitigation**: it calls the same `apiCreateConversation`/`useConversationStream`/`useConversationHandlers`/`ConversationView` used by those pages rather than reimplementing them, so the duplication is orchestration glue, not business logic.

## Open Questions

- None outstanding — the two open questions from the previous iteration (route naming for the now-removed stateless endpoint, and whether a "new chat" reset affordance is needed) are moot: there is no new endpoint, and "reset" is simply "exit preview and re-enter" is no longer even required since the same conversation persists for the session; a future "start a new preview conversation" button could reuse the delete+recreate cleanup path if requested.
