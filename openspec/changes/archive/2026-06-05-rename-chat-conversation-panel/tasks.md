## 1. Backend — PATCH endpoint

- [x] 1.1 Add `RenameConversationBodyDto` to `apps/chat-api/src/conversations/dto/rename-conversation.dto.ts` (`newTitle: string` with `@IsString @MinLength(1) @MaxLength(200)` and `@ApiProperty`)
- [x] 1.2 Add `renameConversation(path, newTitle, at, bucket)` method to `ConversationService` — sanitise title via `prepareEntityName`, construct source/destination DIAL Core URLs, call `client.moveResource`, return `{ newPath }`
- [x] 1.3 Add `PATCH` handler in `ConversationController` — query param `path` (reuse `ConversationPathDto`), body `RenameConversationBodyDto`, `@Throttle({ default: { limit: 20, ttl: 60000 } })`, returns `RenameConversationResponseDto`
- [x] 1.4 Add `RenameConversationResponseDto` (inline or in dto/) with `newPath: string` and `@ApiProperty`
- [x] 1.5 Add Swagger `@ApiResponse` decorators (200, 400, 401, 404, 409, 502, 503) to the PATCH handler
- [x] 1.6 Write integration tests for `PATCH /api/v1/conversations` in `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` — cover 200, 400 (empty newTitle), 400 (missing path)
- [x] 1.7 Verify: `npm exec nx test chat-api` passes; `npm exec nx lint chat-api` passes

## 2. Generated API client

- [x] 2.1 Regenerate the OpenAPI client (`@epam/chat-api-client`) using the repository OpenAPI script so `renameConversation` SDK method and `RenameConversationResponseDto` type are available in `libs/chat-api-client`

## 3. Frontend — server-api wrapper

- [x] 3.1 Add `renameConversation(path: string, newTitle: string)` function to `apps/chat/src/server-api/conversations.api.ts` — calls `conversationsApi.renameConversation({ path, renameConversationBodyDto: { newTitle } })`

## 4. Frontend — i18n

- [x] 4.1 Add keys to `apps/chat/src/i18n/locales/en.json` under `conversationHistory`: `renameTitle` ("Rename Chat"), `renameLabel` ("Rename"), `renameInputPlaceholder` ("Chat name"), `renameError` ("Failed to rename. Please try again.")
- [x] 4.2 Add corresponding enum members to `ConversationHistoryI18nKeys` in `apps/chat/src/constants/translation-keys.ts`: `RenameTitle`, `RenameLabel`, `RenameInputPlaceholder`, `RenameError`
- [x] 4.3 Add `Save = 'actions.save'` to `ActionsI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and add `"save": "Save"` under `actions` in `en.json`

## 5. Frontend — RenameConversationPopup component

- [x] 5.1 Create `apps/chat/src/components/RenameConversationPopup/RenameConversationPopup.tsx` — `DialPopup` with header from `RenameTitle` i18n key, controlled `<input>` initialised to `currentTitle`, Cancel (`fill="none"`) and Save (`fill="solid" color="primary"`) `DialButton`s, inline error with `role="alert"`, focus on open
- [x] 5.2 Save disabled when trimmed value is empty, equals trimmed `currentTitle`, or `isSaving` is true; `onSave` called with trimmed value
- [x] 5.3 Write unit tests at `apps/chat/src/components/RenameConversationPopup/tests/RenameConversationPopup.spec.tsx` — cover all scenarios from the spec: pre-fill, Save disabled (unchanged/empty/saving), trimmed onSave, onCancel, error display

## 6. Frontend — ConversationsContext

- [x] 6.1 Add `renameConversation(id: string, newTitle: string): Promise<void>` to `ConversationsContextType` interface
- [x] 6.2 Implement `renameConversation` in `ConversationsProvider` — optimistic title update, call server-api wrapper, update `id` to `newPath` on success, revert title on failure and re-throw

## 7. Frontend — ConversationPanelView wiring

- [x] 7.1 Add local state to `ConversationPanelView`: `pendingRenameItem: { id: string; title: string } | null`, `isRenaming: boolean`, `renameError: string | null`
- [x] 7.2 Add "Rename" `DropdownItem` (key `"rename"`, icon `IconPencil`, label `RenameLabel` i18n) to `getActions` between Pin and Delete — `onClick` sets `pendingRenameItem`
- [x] 7.3 Wire `handleConfirmRename` callback — calls `renameConversation` from context, sets `isRenaming`, handles error into `renameError`, clears `pendingRenameItem` on success
- [x] 7.4 Render `<RenameConversationPopup>` below `<DialConfirmationPopup>` — `open={pendingRenameItem !== null}`, `currentTitle`, `isSaving={isRenaming}`, `error={renameError}`, `onSave={handleConfirmRename}`, `onCancel` clears state

## 8. Verification

- [x] 8.1 `npm exec nx affected --target=lint --base=origin/development-1.0` passes
- [x] 8.2 `npm exec nx affected --target=test --base=origin/development-1.0` passes
- [x] 8.3 `npm exec nx affected --target=build --base=origin/development-1.0` passes
