## 1. Backend: remove the stateless preview endpoint (superseded)

An earlier iteration of this change added a stateless `POST /api/v1/conversations/preview-completions` endpoint to keep preview chats out of persisted storage. Product direction changed: preview now reuses the real conversation stack (see `design.md` Decision 1), so this endpoint and its supporting code are dead and must be removed.

- [x] 1.1 Remove `apps/chat-api/src/conversations/dto/preview-completion.dto.ts` and its `*.spec.ts`.
- [x] 1.2 Remove `ConversationController.streamPreviewCompletion` (`apps/chat-api/src/conversations/conversation.controller.ts`) — the `POST preview-completions` route, its `@ApiOperation`/`@ApiResponse`/`@Throttle` decorators, and the `PreviewCompletionDto` import.
- [x] 1.3 Remove `ConversationService.streamPreviewCompletion` (`apps/chat-api/src/conversations/conversation.service.ts`). Keep the shared `relayModelCompletion` private method — `streamCompletion` still uses it.
- [x] 1.4 Remove preview-completion-specific tests from `conversation.controller.spec.ts`/`conversation.service.spec.ts` (happy path, validation rejection, unauthenticated rejection, rate-limit boundary, no-storage-access assertion) that were added for the removed endpoint. Also deleted the standalone `tests/preview-completions.integration.spec.ts`.
- [ ] 1.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`; fix any pre-existing lint errors surfaced with `--fix`.

## 2. OpenAPI / generated client: drop the removed endpoint

- [ ] 2.1 Run `npm run openapi` to regenerate the OpenAPI spec and `libs/chat-api-client` now that `preview-completions`/`PreviewCompletionDto`/`PreviewMessageDto` no longer exist (confirms the generated `streamPreviewCompletion` client method and its DTOs are removed).
- [ ] 2.2 Run `npm run openapi:check` to verify the committed generated client matches; commit the regenerated client files.
- [ ] 2.3 Build/lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`).

## 3. Frontend: remove the stateless preview hook/api (superseded)

- [x] 3.1 Remove `apps/chat/src/server-api/preview-completion.api.ts`.
- [x] 3.2 Remove `apps/chat/src/hooks/conversation/usePreviewCompletion.ts` and its `*.spec.ts`.
- [x] 3.3 Grep the app for any remaining references to `usePreviewCompletion`/`streamPreviewCompletion`/`preview-completion.api` and remove them — none remain outside the generated client (dropped in §2).

## 4. Frontend: EditorHeader preview button

- [x] 4.1 Add `onPreview?: () => void` and `isPreviewing?: boolean` props to `EditorHeader` (`apps/chat/src/components/EditorHeader/EditorHeader.tsx`); render a `GhostButton` with `IconEye`/`IconEyeOff` in the **right-hand action group, next to Cancel/Save** (not on the left with the title/steps nav), only when `onPreview` is provided; label toggles between `AppsEditorI18nKeys.PreviewButton` and `AppsEditorI18nKeys.ExitPreviewButton` based on `isPreviewing`.
- [x] 4.2 Add the new translation keys to `AppsEditorI18nKeys` in `apps/chat/src/constants/translation-keys.ts` (`PreviewButton`, `ExitPreviewButton`, `PreviewChatPlaceholder`, `PreviewChatAriaLabel`) and to every locale file in `apps/chat/src/i18n/locales/` (including `ar.json` — only `en.json` exists in this repo today).
- [x] 4.3 Update/add `EditorHeader` tests (`apps/chat/src/components/EditorHeader/tests/`) covering: no button without `onPreview`, button shown and labeled correctly for `isPreviewing` false/true, click invokes `onPreview`, button renders in the right-hand group.

## 5. Frontend: `libs/conversation-input` — shown-but-disabled model selector

- [x] 5.1 Add `isModelSelectorDisabled?: boolean` to `ConversationInputProps` (`libs/conversation-input/src/models/ConversationInput.ts`) and `InputProps` (`libs/conversation-input/src/models/Input.ts`), independent of `isInputDisabled`.
- [x] 5.2 Thread it through `Input.tsx` → `ModelSelectorControl` (new `isDisabled` prop on `ModelSelectorControl`).
- [x] 5.3 In `ModelSelectorControl.tsx`, make `isDisabled` dim and block all three variants (desktop `DialDropdownIcon`, desktop `modelPickerOverlay` button, mobile bottom-sheet trigger) from opening, independent of `isInputDisabled`/`isStreaming`. Fix the pre-existing bug where `disabledIconClassName` was only ever non-empty when `isStreaming`.
- [x] 5.4 Add/extend `libs/conversation-input` tests covering `isModelSelectorDisabled`: chip stays visible (aria-disabled), typing/sending remain enabled. (Covered in `Input.spec.tsx`; the click-does-not-open assertion is not separately testable through the mocked `DialDropdownIcon` used in that suite — `onOpenChange` being `undefined` when disabled is verified by code inspection, matching how the surrounding `isStreaming` case is already tested.)

## 6. Frontend: `ConversationView` — `fixedModel` prop

- [x] 6.1 Replace the earlier `isModelFixed: boolean` prop on `ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`) with `fixedModel?: { id: string; displayName?: string; iconUrl?: string }`. When set: `deployments` passed to `ConversationInput` is a single-item list built from `fixedModel`; `selectedDeploymentId` is pinned to `fixedModel.id`; `onDeploymentChange` is `undefined`; `isModelSelectorDisabled` is `true`; `modelPickerOverlay` is `undefined`.
- [ ] 6.2 Add/update `ConversationView` tests covering `fixedModel`: chip shows the fixed model's name, selector does not open, `onSend` still works. **Deferred**: `ConversationView`, like `Conversation.tsx`/`ConversationRoute.tsx`, has no existing test suite in this repo — it composes ~10 contexts/hooks with no established test harness. Adding one from scratch is out of scope for this change; flagged for the user rather than silently skipped.

## 7. Frontend: AppsEditor save-then-preview orchestration

- [x] 7.1 Add `pendingSaveAction: 'save' | 'preview' | null` and `isPreviewing: boolean` state to `AppsEditor` (`apps/chat/src/pages/AppsEditor/AppsEditor.tsx`).
- [x] 7.2 Add `handlePreview` that toggles `isPreviewing` off directly when already previewing (no save), or sets `pendingSaveAction = 'preview'` and calls `settingsStepRef.current?.triggerSave()` when entering preview.
- [x] 7.3 Update `handleSaveSuccess`/`handleSaveError` to branch on `pendingSaveAction`: `'save'` keeps existing navigate-on-success behavior; `'preview'` sets `isPreviewing = true` on success (no navigation) or shows the existing error notification and stays on the iframe on error; both reset `pendingSaveAction` to `null` at the end. Ignore `SaveSuccess`/`SaveError` entirely while `isPreviewing` is already `true`.
- [x] 7.4 Compute and pass `onPreview`/`isPreviewing` to `EditorHeader` only when `isGeneralStep` is `false` and `appIdForSettings`/`schema?.editorUrl` are present; disable Cancel/Save while `isPreviewing` (already handled inside `EditorHeader`).
- [x] 7.5 Update `AppsEditor` tests (`apps/chat/src/pages/AppsEditor/tests/`) covering: button presence/absence per step, save-success-while-previewing does not navigate, save-error-while-previewing shows notification and stays on iframe, normal Save unaffected, Cancel/Save disabled while previewing. (Existing test file from the prior iteration still matches — `AppsEditor.tsx` orchestration was unchanged by the real-conversation pivot.)

## 8. Frontend: SettingsStep keeps both panes mounted

- [x] 8.1 Update `SettingsStep` (`apps/chat/src/pages/AppsEditor/SettingsStep.tsx`) to render `AppPreviewChat` **whenever `appId` is present** (not only while `isPreviewing`), hidden via CSS (`hidden`/hidden wrapper) when not previewing — mirroring how `AppEditorIframe` is already kept mounted-but-hidden. This lets `AppPreviewChat`'s internal conversation state (and its cleanup-on-unmount effect) survive toggling Preview ↔ Settings.
- [x] 8.2 Update `SettingsStep` tests to cover: both `AppEditorIframe` and `AppPreviewChat` stay mounted regardless of `isPreviewing`, visibility toggles via CSS class, not mount/unmount.

## 9. Frontend: `AppPreviewChat` — real, cleaned-up-on-exit conversation

- [x] 9.1 Rewrite `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx` to own a `conversationId: string | null` state (no conversation yet on first mount).
- [x] 9.2 Before a conversation exists: render the same composer-only experience as `ConversationRoute.tsx` (`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`) — reuse `ConversationInput` directly with a greeting/placeholder, `fixedModel` wired to `isModelSelectorDisabled`/pinned deployment, and full attachment/transcription support (`useAttachmentUpload`, `useAudioTranscription` — both are conversation-id-independent, so reusable as-is).
- [x] 9.3 On send: call `apiCreateConversation`/`saveConversation` exactly as `ConversationRoute.handleSend` does, but store the returned id in local state instead of calling `navigate()`. Also mirrors `Conversation.loadConversation`'s post-creation branch: appends the assistant placeholder and calls `startStream(..., CompletionMode.ContinueLastUser)` since `createConversation` only persists the user message.
- [x] 9.4 Once `conversationId` is set: render `ConversationView` bound to `useConversationStream`/`useConversationHandlers` for that id, exactly as `Conversation.tsx` does, with `fixedModel` set and `onBrowseCatalog`/model-changing paths omitted (there is nothing to browse — the model is fixed). `useConversationHandlers` gained a new optional `fixedModelId` param (`apps/chat/src/hooks/conversation/useConversationHandlers.ts`) so sends target the pinned app model instead of the globally-selected deployment.
- [x] 9.5 On unmount: if `conversationId` is set, call `deleteConversation(path)`; log (do not surface) failures.
- [ ] 9.6 Add/update `AppPreviewChat` tests (`apps/chat/src/pages/AppsEditor/tests/`) covering: welcome composer shown before first send, conversation created on first send (no navigation), streaming works once created, conversation preserved across a hidden/visible toggle (parent controls visibility, component stays mounted), `deleteConversation` called on unmount when a conversation exists, not called when it doesn't. **Deferred for the same reason as 6.2** — `AppPreviewChat` now composes the same wide hook/context surface as `ConversationRoute.tsx`/`Conversation.tsx`, neither of which has a test suite in this repo.

## 10. Verification

- [ ] 10.1 `npm exec nx lint chat`, `npm exec nx test chat` — fix any pre-existing lint errors surfaced with `--fix`.
- [ ] 10.2 `npm exec nx lint chat-api`, `npm exec nx test chat-api`.
- [ ] 10.3 Manually run the app (`npm run start:all`), create/edit an application through `/apps-editor`, click Preview, confirm: save happens, chat opens with the model fixed (visible, disabled) to the app, sending a message creates a real conversation and streams a response, attachments/transcription/chat-settings all work, Stop aborts cleanly, Exit preview returns to the iframe without reload and without losing the conversation, and the preview conversation is deleted after Cancel or a normal Save-and-exit.
- [ ] 10.4 Verify RTL: switch to `ar` locale, confirm the preview button and chat pane mirror correctly via logical properties and the eye icon is not incorrectly flipped.
- [ ] 10.5 Run the five-axis code review (`.claude/skills/code-review-and-quality/SKILL.md`) before merge.
