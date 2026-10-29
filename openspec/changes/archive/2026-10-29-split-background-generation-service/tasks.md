Slicing: vertical, one module per slice. Each slice moves one helper group, rewires the service's import, and must leave `chat-api` green before the next slice starts. Every slice is a pure move: same names, signatures, bodies and JSDoc. All files are in `apps/chat-api/src/conversations/generation/`. No other folder changes, and no import outside it changes.

## 1. Chunk helpers → `background-chunk.ts`

- [ ] 1.1 Create `background-chunk.ts` with `parseChunkFrame` and `readChunkResponseId`, both now exported, with their JSDoc. Remove them from `background-generation.service.ts` and import them there.

Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/background-generation.service.spec.ts`

## 2. Terminal mapping → `background-terminal.ts`

- [ ] 2.1 Create `background-terminal.ts` with `toStoredTerminalEvent`, `extractOutputText`, `isRunningStatus` (now exported; the class calls it directly) and `toTerminalFields`. Bring the imports they need: `extractDialErrorMessage`, `GenerationTerminalEvent`, `BackgroundGenerationStatus`/`BackgroundGenerationDto`, `CoreResponseStatus`/`CoreResponse`, `RESPONSES_FAILED_MESSAGE`/`RESPONSES_INCOMPLETE_MESSAGE`, and `StoredMessage`/`ServerOwnedMessageFields`. Remove the four functions from the service and import them there.
- [ ] 2.2 Move the `describe('extractOutputText')` and `describe('toTerminalFields')` blocks, with any fixtures they use, from `background-generation.service.spec.ts` to a new `background-terminal.spec.ts`. Keep the assertions unchanged and import from `./background-terminal`. If a fixture is also used by the remaining service tests, copy it rather than export it from a spec.

Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/background-terminal.spec.ts` and `npm run test:file -- apps/chat-api/src/conversations/generation/background-generation.service.spec.ts`

## 3. Client-save merge → `background-message.ts`

- [ ] 3.1 Move `mergeClientMessages` and its JSDoc into `background-message.ts`, next to the helpers it composes. Add the `ConversationMessageRole` import it needs. Remove it from the service and import it there. Keep the `{@link mergeClientMessages}` reference in `saveClientConversation`'s JSDoc resolving.

Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/background-message.spec.ts` and `npm run test:file -- apps/chat-api/src/conversations/generation/background-generation.service.spec.ts`

## 4. Close

- [ ] 4.1 Remove imports left unused in `background-generation.service.ts`. Confirm its top-level declarations are only the imports, the seven contract members (`GENERATION_ACTIVE_MESSAGE`, `BACKGROUND_START_TIMEOUT_MS`, `BackgroundStopResult`, `BackgroundStartResult`, `BackgroundRequestContext`, `BackgroundAttachPlan`, `BackgroundStartParams`) and the class.
- [ ] 4.2 Confirm `git diff --stat` touches no file outside `apps/chat-api/src/conversations/generation/` except this change's OpenSpec folder.
- [ ] 4.3 `npm exec nx test chat-api`, `npm exec nx lint chat-api` and `npm exec nx build chat-api` pass.
- [ ] 4.4 `npm run validate:specs` passes. Then run `npm run verify:full` once.

## 5. Follow-up (out of scope)

- [ ] 5.1 Propose `split-conversation-streaming-service` (refactoring plan P1, next after this change).
