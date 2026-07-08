## 1. Backend: stateless preview completion endpoint

- [x] 1.1 Add `PreviewMessageDto`/`PreviewCompletionDto` under `apps/chat-api/src/conversations/dto/` with class-validator decorators (`model` bounded string, `messages` array with `@ValidateNested({ each: true })` + `@ArrayMaxSize`, each message `role`/`content` validated, optional `generationId` UUID) and `@ApiProperty` Swagger metadata.
- [x] 1.2 Extract the reusable "assemble request body" and "call model + relay SSE chunks" logic out of `ConversationService.streamCompletion` (`apps/chat-api/src/conversations/conversation.service.ts`, ~lines 1284-1340 and ~1391-1465) into shared private method(s), keeping existing `streamCompletion` behavior identical.
- [x] 1.3 Implement `ConversationService.streamPreviewCompletion` using the shared logic from 1.2, with no `getConversation`/`saveConversation`/`finalize`/`ConversationGenerationService` calls, forwarding the request's `AbortSignal` (from client disconnect/abort) into the model call.
- [x] 1.4 Add `POST /api/v1/conversations/preview-completions` to `ConversationController` (`apps/chat-api/src/conversations/conversation.controller.ts`): `@Throttle` stricter than the existing `/completions` limit, `@ApiOperation` + `@ApiResponse` for 200/400/401/429/502/503, delegates to `streamPreviewCompletion`.
- [x] 1.5 Add/extend unit tests (`*.spec.ts` co-located) covering: happy-path streamed response, validation rejection (empty messages, oversized message, too many messages, missing model), unauthenticated rejection, rate-limit boundary, and confirming no storage read/write occurs.
- [x] 1.6 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`; fix any pre-existing lint errors surfaced with `--fix`.

## 2. OpenAPI / generated client

- [x] 2.1 Run `npm run openapi` to regenerate the OpenAPI spec and `libs/chat-api-client` with the new endpoint/DTOs (confirm generated operationId, e.g. `streamPreviewCompletion`).
- [x] 2.2 Run `npm run openapi:check` to verify the committed generated client matches; commit the regenerated client files.
- [x] 2.3 Build/lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`) to confirm the new generated code compiles cleanly.

## 3. Frontend: stateless preview API wrapper and hook

- [x] 3.1 Add `apps/chat/src/server-api/preview-completion.api.ts`: a thin `streamPreviewCompletion(model, messages, options, generationId)` function modeled on `server-api/chat-stream.api.ts`'s `streamCompletion`, POSTing to the new endpoint and reusing the existing SSE line-parsing pattern.
- [x] 3.2 Add `apps/chat/src/hooks/conversation/usePreviewCompletion.ts`: owns in-memory `messages` state, `sendMessage`, `stop`, `isAssistantTyping`, `hasStreamError`; uses `applyChunkToMessages` (existing util) to apply streamed chunks; JSDoc explaining why this hook exists separately from `useConversationStream`.
- [x] 3.3 Unit test `usePreviewCompletion` (send success, stream chunks applied, stop aborts, error surfaces `hasStreamError`).

## 4. Frontend: EditorHeader preview button

- [ ] 4.1 Add `onPreview?: () => void` and `isPreviewing?: boolean` props to `EditorHeader` (`apps/chat/src/components/EditorHeader/EditorHeader.tsx`); render a `GhostButton`/`NeutralButton` (per `.claude/rules/all-tsx.md` button conventions) with `IconEye`/`IconEyeOff` on the left side, next to the title/steps nav, only when `onPreview` is provided; label toggles between `AppsEditorI18nKeys.PreviewButton` and `AppsEditorI18nKeys.ExitPreviewButton` based on `isPreviewing`.
- [ ] 4.2 Add the new translation keys to `AppsEditorI18nKeys` in `apps/chat/src/constants/translation-keys.ts` (`PreviewButton`, `ExitPreviewButton`, `PreviewChatPlaceholder`, `PreviewChatAriaLabel`) and to every locale file in `apps/chat/src/i18n/locales/` (including `ar.json`).
- [ ] 4.3 Update/add `EditorHeader` tests (`apps/chat/src/components/EditorHeader/tests/`) covering: no button without `onPreview`, button shown and labeled correctly for `isPreviewing` false/true, click invokes `onPreview`.

## 5. Frontend: AppsEditor save-then-preview orchestration

- [ ] 5.1 Add `pendingSaveAction: 'save' | 'preview' | null` and `isPreviewing: boolean` state to `AppsEditor` (`apps/chat/src/pages/AppsEditor/AppsEditor.tsx`).
- [ ] 5.2 Add `handlePreview` that sets `pendingSaveAction = 'preview'` and calls `settingsStepRef.current?.triggerSave()` (reusing the existing ref/imperative-handle chain through `SettingsStep`/`AppEditorIframe`).
- [ ] 5.3 Update `handleSaveSuccess`/`handleSaveError` to branch on `pendingSaveAction`: `'save'` keeps existing navigate-on-success behavior; `'preview'` sets `isPreviewing = true` on success (no navigation) or shows the existing error notification and stays on the iframe on error; both reset `pendingSaveAction` to `null` at the end. Ignore `SaveSuccess`/`SaveError` entirely while `isPreviewing` is already `true` (per the "stray postMessage" spec scenario).
- [ ] 5.4 Compute and pass `onPreview`/`isPreviewing` to `EditorHeader` only when `isGeneralStep` is `false` and `appIdForSettings`/`schema?.editorUrl` are present; disable Cancel/Save while `isPreviewing`.
- [ ] 5.5 Update `AppsEditor` tests (`apps/chat/src/pages/AppsEditor/tests/`) covering: button presence/absence per step, save-success-while-previewing does not navigate, save-error-while-previewing shows notification and stays on iframe, normal Save unaffected, Cancel/Save disabled while previewing.

## 6. Frontend: SettingsStep keeps iframe mounted, adds preview pane

- [ ] 6.1 Update `SettingsStep` (`apps/chat/src/pages/AppsEditor/SettingsStep.tsx`) to accept `isPreviewing`/`appId`/`onPreview`-related props as needed and render both `AppEditorIframe` (hidden via CSS, not unmounted, when `isPreviewing`) and the new preview pane, toggling visibility.
- [ ] 6.2 Create `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx`: builds the minimal in-memory `Conversation` shape (`model: { id: appId }`, messages from `usePreviewCompletion`) and renders `ConversationView` without `deployments`/`modelPickerOverlay`, using `AppsEditorI18nKeys.PreviewChatPlaceholder`/`PreviewChatAriaLabel`.
- [ ] 6.3 Update `SettingsStep` tests to cover: iframe stays mounted (not unmounted) when toggling preview, preview pane renders `ConversationView` with a fixed model and no picker.

## 7. Verification

- [ ] 7.1 `npm exec nx lint chat`, `npm exec nx test chat` — fix any pre-existing lint errors surfaced with `--fix`.
- [ ] 7.2 `npm exec nx lint chat-api`, `npm exec nx test chat-api`.
- [ ] 7.3 Manually run the app (`npm run start:all`), create/edit an application through `/apps-editor`, click Preview, confirm: save happens, chat opens with the model fixed to the app, sending a message streams a response, Stop aborts cleanly, Exit preview returns to the iframe without reload, and the preview conversation never appears in the conversation sidebar.
- [ ] 7.4 Verify RTL: switch to `ar` locale, confirm the preview button and chat pane mirror correctly via logical properties and the eye icon is not incorrectly flipped.
- [ ] 7.5 Run the five-axis code review (`.claude/skills/code-review-and-quality/SKILL.md`) before merge.
