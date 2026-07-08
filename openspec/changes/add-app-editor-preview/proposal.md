## Why

App authors building a custom application in the Apps editor (`/apps-editor`, `AppsEditor.tsx`) can only see their app rendered through its settings iframe — there is no way to try a live chat with the app without leaving the editor, publishing it, and finding it in the Catalog. A "Preview" action that saves the app and immediately opens a real chat window against it (with the model fixed to that app) closes this feedback loop directly inside the editor.

## What Changes

- Add an optional `onPreview?: () => void` prop to `EditorHeader` (`apps/chat/src/components/EditorHeader/EditorHeader.tsx`). A new button with a leading icon renders on the **left** side of the header, next to the title/steps nav, only when `onPreview` is supplied. It is wired up **only** in `AppsEditor` — `ToolsetEditor` does not use `EditorHeader` today and stays out of scope.
- `AppsEditor` supplies `onPreview` only on the Settings step, once the app has been created (`schema.editorUrl` and a saved `appId` are present). Clicking it triggers the same `triggerSave` postMessage flow the Save button uses and waits for the resulting `SaveSuccess`/`SaveError` signal; on success it switches the content area from the settings `iframe` to a live preview chat, on failure it stays on the iframe and shows the existing save-error notification.
- While previewing, the button's label/icon toggles to "Exit preview"; clicking it switches back to the settings iframe. The Cancel/Save buttons are disabled while previewing (there is no settings form visible to save).
- The preview pane reuses the existing single-conversation chat UI (`ConversationView`) with the model fixed to the application being edited (no model picker) and a fully in-memory, ephemeral message history — nothing is written to the user's conversation list/history.
- **BREAKING (backend contract addition, not a break of existing behavior)**: add a new, genuinely stateless completion endpoint in `apps/chat-api` (sibling to the existing `/conversations/completions`) that streams a model response for a client-supplied message history without reading or writing any persisted conversation. The existing `/conversations/completions` endpoint is unchanged; it is unsuitable for preview because it requires an existing persisted conversation `path` and saves history as a side effect.
- Add a small frontend hook that drives the preview chat's send/stream/stop against the new stateless endpoint, independent of the persistence-coupled `useConversationStream`/`useConversationHandlers` hooks used by real conversations.

## Capabilities

### New Capabilities

- `app-preview-chat`: In-editor preview affordance — `EditorHeader` preview/exit-preview button, `AppsEditor` save-then-switch orchestration, in-memory conversation state reused across preview toggles within one editor session, and the ephemeral chat view bound to the app's fixed model.
- `preview-completion-api`: `POST /api/v1/conversations/preview-completions` (naming confirmed in design) — stateless streaming completion endpoint: request DTO carrying model + full client-side message history, no DIAL Core storage reads/writes, no generation registry, client-side `AbortSignal` is sufficient to stop a stream in flight.

### Modified Capabilities

- None. `app-editor-flow` (the two-step Apps editor introduced in `add-app-editor-flow`, not yet archived) gains the preview affordance but its existing requirements (routing, General/Settings steps, iframe embed) are unchanged — this is additive, so it is captured as a new capability (`app-preview-chat`) rather than a delta to avoid depending on an unarchived spec.

## Impact

- **Backend — new files**: `apps/chat-api/src/conversations/dto/preview-completion.dto.ts`, new controller method + service method in `apps/chat-api/src/conversations/conversation.controller.ts` / `conversation.service.ts` (or a new sibling service if the existing service is too large), OpenAPI regeneration (`npm run openapi`, `npm run openapi:check`) and `libs/chat-api-client` rebuild.
- **Frontend — modified files**: `apps/chat/src/components/EditorHeader/EditorHeader.tsx`, `apps/chat/src/pages/AppsEditor/AppsEditor.tsx`, `apps/chat/src/pages/AppsEditor/SettingsStep.tsx`, `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/*.json`.
- **Frontend — new files**: a preview chat container component under `apps/chat/src/pages/AppsEditor/` (e.g. `AppPreviewChat.tsx`) plus a new hook (e.g. `apps/chat/src/hooks/conversation/usePreviewCompletion.ts`) and a new thin `server-api` function (e.g. `apps/chat/src/server-api/preview-completion.api.ts`).
- **No changes** to `ToolsetEditor`, `ToolsetEditorHeader`, or any `libs/*` package — `ConversationView` is reused purely through its existing props/callbacks contract.
