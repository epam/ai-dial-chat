## 1. Backend — DTOs and service

- [x] 1.1 Query `path` validation — **reused the shared `ConversationPathDto`** (the same DTO every other conversation endpoint uses: `getConversation`, `renameConversation`, `deleteConversation`) instead of adding a new `GenerateTitleQueryDto`, for consistency. Path traversal/nonexistent paths are rejected downstream (404) by the persistence layer, matching existing endpoints.
- [x] 1.2 Add `GenerateTitleResponseDto` class with `@ApiProperty() name: string` under `apps/chat-api/src/conversations/dto/`
- [x] 1.3 Add a `generateTitle(path, authContext)` method to `ConversationNamingService` that loads the conversation, builds a prompt from the most recent 50 messages (bypassing the two-message trigger gate), calls the existing `sendNamingCompletion` path with `UTILITY_MODEL` and `UTILITY_NAMING_TIMEOUT_MS`, and returns the `prepareEntityName`-sanitised name — without reading/writing `llmNamingDone` and without persisting
- [x] 1.4 Return a typed error (not empty string) when the sanitised name is empty or the LLM output is unusable
- [x] 1.5 Add unit tests for `generateTitle`: happy path, already-`llmNamingDone` conversation (no persistence, still returns name), timeout, empty/garbage output, upstream failure

## 2. Backend — controller endpoint

- [x] 2.1 Add `POST /api/v1/conversations/generate-title` handler (`generateConversationTitle`) to `conversation.controller.ts` reading the validated `path` query param and delegating to `ConversationNamingService.generateTitle`
- [x] 2.2 Add `@Throttle` config (5 requests / minute per user) and full Swagger annotations: `@ApiOperation`, `@ApiQuery`, and `@ApiResponse` for 200 (with `GenerateTitleResponseDto`), 400, 404, 429, 502/503
- [x] 2.3 Map failures to typed HTTP exceptions (400 invalid/missing path, 404 missing conversation, 502/503 upstream, timeout) and ensure no secrets/tokens are logged
- [x] 2.4 Add e2e/controller tests (supertest): happy path, missing path (400), invalid path incl. traversal (400), unknown conversation (404), rate-limit boundary (429), upstream failure (502/503)

## 3. Backend — OpenAPI client

- [x] 3.1 Run `npm run openapi` and `npm run openapi:check` to regenerate and validate the spec
- [x] 3.2 Build and lint `chat-api-client`; confirm the generated `generateConversationTitle` method and DTO types exist

## 4. Frontend — server-api wrapper

- [x] 4.1 Add `generateConversationTitle(path)` to `apps/chat/src/server-api/conversations.api.ts` wrapping the generated `@epam/chat-api-client` method, returning `{ name }`
- [x] 4.2 Add a unit test for the wrapper

## 5. Frontend — i18n

- [x] 5.1 Add new strings to `apps/chat/src/i18n/locales/en.json` under `conversationPanel` (AI rename button label/tooltip, generating state, generation error)
- [x] 5.2 Add matching enum members to `ConversationPanelI18nKeys` in `apps/chat/src/constants/translation-keys.ts`

## 6. Frontend — rename modal

- [x] 6.1 Add `onGenerateWithAi` callback prop and internal `isGenerating` / `generateError` state to `RenameConversationPopup.tsx`
- [x] 6.2 Render a trailing (logical `end`) icon-only `IconSparkles` (`@tabler/icons-react`) button with a tooltip label in the title input row; show a spinner and disable it while generating
- [x] 6.3 On success, populate the `value` state with the returned name (keep it editable, do not auto-confirm); on failure, stop the spinner, leave the input unchanged, and show the error message
- [x] 6.4 Wire the callback in `ConversationPanelView.tsx` to call `generateConversationTitle` for the current conversation path
- [x] 6.5 Confirm the confirm/save path still routes through the existing rename endpoint (unchanged)
- [x] 6.6 Update/add `RenameConversationPopup.spec.tsx`: button present, spinner while in-flight, input populated on success, error surfaced on failure, confirm uses rename flow

## 7. Verification

- [x] 7.1 `npm exec nx test chat-api` and `npm exec nx lint chat-api` (and `npm exec nx build chat-api` if startup/bundling affected)
- [~] 7.2 `npm exec nx test chat` / `npm exec nx lint chat` are **blocked by a pre-existing broken workspace state** (dependency libs `conversation-panel`, `catalog`, `attachment-input`, `starter-buttons` fail to build/typecheck: unresolved `@epam/ai-dial-kit`, stale `dist/` `.d.ts`, `DialDropdown`/`DialTag` prop mismatches — none in this changeset). Verified my slice directly instead: ESLint clean on all changed chat files; vitest green for RenameConversationPopup (15), ConversationsContext (9), ConversationPanelView (18), conversations.api (8).
- [x] 7.3 Manual smoke verified by reviewer in the running app: rename modal → AI rename button (icon size/hover behavior tuned) → spinner → populated editable name → confirm renames via existing flow; error path also checked.
