## Why

App authors building a custom application in the Apps editor (`/apps-editor`, `AppsEditor.tsx`) can only see their app rendered through its settings iframe — there is no way to try a live chat with the app without leaving the editor, publishing it, and finding it in the Catalog. A "Preview" action that saves the app and immediately opens a real chat window against it (with the model fixed to that app) closes this feedback loop directly inside the editor.

## What Changes

- Add an optional `onPreview?: () => void` prop to `EditorHeader` (`apps/chat/src/components/EditorHeader/EditorHeader.tsx`). A button with a leading icon renders in the right-hand action group next to Cancel/Save, only when `onPreview` is supplied. It is wired up **only** in `AppsEditor` — `ToolsetEditor` does not use `EditorHeader` today and stays out of scope.
- `AppsEditor` supplies `onPreview` only on the Settings step, once the app has been created (`schema.editorUrl` and a saved `appId` are present). Clicking it triggers the same `triggerSave` postMessage flow the Save button uses and waits for the resulting `SaveSuccess`/`SaveError` signal; on success it switches the content area from the settings `iframe` to a live preview chat, on failure it stays on the iframe and shows the existing save-error notification.
- While previewing, the button's label/icon toggles to "Exit preview"; clicking it switches back to the settings iframe. The Cancel/Save buttons are disabled while previewing (there is no settings form visible to save).
- The preview pane is a **real, persisted conversation** — it reuses the exact same conversation-creation, streaming, and interaction machinery as a normal chat (`apiCreateConversation`, `useConversationStream`, `useConversationHandlers`, `ConversationView`), so every feature of a normal chat (attachments, audio transcription, chat settings, edit/regenerate/rate, etc.) works in preview with no new backend contract. The only difference: the model is fixed to the application being edited — the model selector is visible (not hidden) but rendered disabled, so it cannot be changed.
- The preview conversation is created lazily on the first message sent in preview (identical to how a normal new chat is created) and is deleted (`deleteConversation`) when the app editor is left — Cancel, a successful normal Save-and-exit, or navigating away — so it does not linger in the user's conversation history afterward. It may appear in the conversation sidebar for the duration of the editing session; this is accepted since the entire point of reusing real conversation infrastructure is to get full feature parity for free.
- Toggling between the settings iframe and the preview pane within one editor session preserves the same preview conversation (its id lives in a component that stays mounted, hidden, across the toggle) — no new conversation is created per toggle.

## Capabilities

### New Capabilities

- `app-preview-chat`: In-editor preview affordance — `EditorHeader` preview/exit-preview button, `AppsEditor` save-then-switch orchestration, a real (but scoped-to-session and cleaned-up-on-exit) persisted conversation bound to the app's fixed model, reusing the standard conversation view and its full feature set.

### Modified Capabilities

- None. `app-editor-flow` (the two-step Apps editor introduced in `add-app-editor-flow`, not yet archived) gains the preview affordance but its existing requirements (routing, General/Settings steps, iframe embed) are unchanged — this is additive, so it is captured as a new capability (`app-preview-chat`) rather than a delta to avoid depending on an unarchived spec.

### Removed Capabilities

- `preview-completion-api`: an earlier iteration of this change added a stateless `POST /api/v1/conversations/preview-completions` endpoint plus a dedicated ephemeral frontend hook to avoid persisting preview chats. Superseded by reusing the real, existing conversation endpoints — simpler, and gives full feature parity (attachments, transcription, chat settings) without extending the backend contract. All code added for the stateless endpoint is removed as part of this change (see `tasks.md`).

## Impact

- **Backend — removed**: `apps/chat-api/src/conversations/dto/preview-completion.dto.ts`, the `streamPreviewCompletion` controller/service methods, their tests, and the generated `preview-completions` OpenAPI operation/client method. `streamCompletion` and its extracted shared helpers (`relayModelCompletion`) are otherwise unaffected.
- **Frontend — removed**: `apps/chat/src/server-api/preview-completion.api.ts`, `apps/chat/src/hooks/conversation/usePreviewCompletion.ts`, and their tests.
- **Frontend — modified files**: `apps/chat/src/components/EditorHeader/EditorHeader.tsx`, `apps/chat/src/pages/AppsEditor/AppsEditor.tsx`, `apps/chat/src/pages/AppsEditor/SettingsStep.tsx`, `apps/chat/src/components/ConversationView/ConversationView.tsx` (new `fixedModel` prop), `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/*.json`.
- **Frontend — new files**: `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx`, mirroring `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` (empty/welcome composer, used to create the preview conversation on first send) and `apps/chat/src/pages/Conversation/Conversation.tsx` (streaming view once the conversation exists), adapted to run embedded (no router navigation) and to delete its conversation on unmount.
- **No changes** to `ToolsetEditor`, `ToolsetEditorHeader`, or any `libs/*` package except `libs/conversation-input`, which gains a small, generic `isModelSelectorDisabled` prop (independent of the existing `isInputDisabled`) so a model chip can be shown-but-disabled instead of only hidden-or-fully-enabled.
