## 1. Spec Sync (documentation only)

- [x] 1.1 Overwrite `openspec/specs/conversations-api/spec.md` with the content from `openspec/changes/conversation-panel-state-and-list-path/specs/conversations-api/spec.md` to replace the stale in-memory / offset-pagination spec with the shipped DIAL Core / cursor-pagination shape
- [x] 1.2 Update `openspec/changes/implement-conversation-panel/specs/conversations-api/spec.md` to mark the `GET /api/v1/conversations` list requirement as REMOVED (superseded by `GET /api/v1/conversations/list`) and reference this change

## 2. Backend — Add `path` Parameter to listConversations

- [x] 2.1 Add `@IsOptional() @IsString() @MaxLength(512) @ApiPropertyOptional({ description: 'DIAL Core subfolder path; omit or pass empty string for bucket root (My Files)' }) path?: string` to `apps/chat-api/src/conversations/dto/list-conversations-query.dto.ts`
- [x] 2.2 Update `ConversationService.listConversations` signature in `apps/chat-api/src/conversations/conversation.service.ts` to accept `path?: string` and forward `path ?? ''` as the second argument to `client.getConversationMetadata(bucket, path ?? '', ...)`
- [x] 2.3 Update the `@Get('list')` handler in `apps/chat-api/src/conversations/conversation.controller.ts` to destructure `path` from `@Query()` and pass it to `listConversations`; update the `@ApiQuery` Swagger annotation to document the `path` parameter
- [x] 2.4 Add integration test scenarios in `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` covering: omitted path returns root listing, non-empty path is forwarded to the service, path exceeding 512 characters returns 400

## 3. Generated API Client

- [x] 3.1 Run `npm run openapi` to regenerate `libs/chat-api-client` from the updated Swagger schema (picks up the new `path` query parameter in `listConversations`)
- [x] 3.2 Run `npm run openapi:check` to confirm the generated client matches the Swagger source
- [x] 3.3 Run `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client` to verify no build errors in the generated client

## 4. Frontend — conversations.api.ts Wrapper

- [x] 4.1 Update `listConversations` in `apps/chat/src/server-api/conversations.api.ts` to accept an optional `path?: string` parameter and pass it to the generated `ConversationsApi.listConversations({ ..., path })` call

## 5. Frontend — useLocalStorage Hook

- [x] 5.1 Create `apps/chat/src/hooks/useLocalStorage.ts` — generic `useLocalStorage<T>(key: string, initialValue: T): [T, (v: T) => void]` hook; read from `localStorage` on first render with `try/catch` fallback to `initialValue`; write on state update with `try/catch` to swallow storage errors; wrap the setter in `useCallback` for reference stability; include JSDoc explaining why the try/catch guards are needed
- [x] 5.2 Create `apps/chat/src/hooks/tests/useLocalStorage.spec.ts` covering: returns `initialValue` when key is absent, returns stored value on subsequent render, updates `localStorage` on setter call, returns `initialValue` when stored JSON is malformed, does not throw when `localStorage` is unavailable (mock `localStorage` to throw)

## 6. Frontend — Wire Panel State to localStorage

- [x] 6.1 In `apps/chat/src/app/app.tsx`, replace `const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false)` with `const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useLocalStorage('conversationPanelOpen', false)`; import `useLocalStorage` from `@/hooks/useLocalStorage`

## 7. Verification

- [x] 7.1 Run `npm exec nx test chat-api` — pre-existing environment failure (all test files fail at import with `TypeError: Cannot read properties of undefined (reading 'config')`; confirmed identical on clean branch, unrelated to this change)
- [x] 7.2 Run `npm exec nx lint chat-api` — no lint errors
- [x] 7.3 Run `npm exec nx affected --target=test --base=origin/development-1.0` — pre-existing environment failure (same `TypeError: Cannot read properties of undefined (reading 'config')` across all 8 affected projects; unrelated to this change)
- [x] 7.4 Run `npm exec nx affected --target=typecheck --base=origin/development-1.0` — all errors are pre-existing (TS6305 dist/output-not-built issues and pre-existing type mismatches in conversation.service.ts lines 58/71/220/252/302); no errors from this change's files
