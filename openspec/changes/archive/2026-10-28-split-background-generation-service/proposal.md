## Why

`apps/chat-api/src/conversations/generation/background-generation.service.ts` is 1109 lines and landed as one file in `aa3a64cf47` (Issue #8947). The 2026-10-26 refactoring audit lists it as backend god module #2. About 290 of its lines (`background-generation.service.ts:104-357`) are pure, module-level functions. They need none of the service's injected dependencies, yet a reader has to scroll past them to reach the class. Two of them, `extractOutputText` and `toTerminalFields`, are unit-tested at the bottom of the service's 1375-line spec instead of beside their own code.

The sibling module `background-message.ts` already holds the stored-message helpers that `mergeClientMessages` is built from. This change finishes that split. The class split is a separate change, and `split-conversation-streaming-service` follows this one.

## What Changes

The helpers move into three modules, following the existing `background-message.ts` pattern of pure functions with co-located specs:

- **`mergeClientMessages`** joins `background-message.ts`. It only composes `withServerOwnedFields`, `pickServerOwnedFields`, `findPendingBackgroundMessage` and `neutralizeForeignPendingMessages` from that file.
- **New `background-terminal.ts`:** `toStoredTerminalEvent`, `extractOutputText`, `isRunningStatus` and `toTerminalFields`. These map stored or retrieved state to terminal values.
- **New `background-chunk.ts`:** `parseChunkFrame` and `readChunkResponseId`. These parse relayed SSE frames.

The `describe('extractOutputText')` and `describe('toTerminalFields')` blocks move from `background-generation.service.spec.ts` to a new `background-terminal.spec.ts`, unchanged.

The service keeps its public contract and imports the moved helpers. The contract is `GENERATION_ACTIVE_MESSAGE`, `BACKGROUND_START_TIMEOUT_MS`, `BackgroundStopResult`, `BackgroundStartResult`, `BackgroundRequestContext`, `BackgroundAttachPlan` and `BackgroundStartParams`. Because it stays in place, `conversation.controller.ts` and `conversation-streaming.service.ts` keep their imports.

Every moved function keeps its name, signature, body and JSDoc. A helper that was private to the service becomes exported from its new module, because the service has to import it.

Non-goals:

- Splitting the `BackgroundGenerationService` class.
- Moving the public contract.
- Adding new tests for `mergeClientMessages`, `parseChunkFrame` or `readChunkResponseId`. They stay covered through the service specs.
- Touching `conversation-streaming.service.ts`.

Acceptance criteria:

- The service file contains no module-level function other than its class. Its non-class exports are exactly the seven contract members above.
- The file shrinks by roughly 250 lines, to about 860.
- `npm exec nx test chat-api`, `lint` and `build` pass.
- The moved describe blocks pass from their new file with identical assertions.
- No import outside `conversations/generation/` changes.

Alternatives considered:

- **Move the contract to a separate `background-generation` module too.** Rejected: it touches the controller and the streaming service for no reader benefit.
- **A single `background-helpers.ts`.** Rejected: the name says nothing, and the three groups have different collaborators (`background-message`, the Core response types, the SSE frame shape).

Rollback: the change only moves code and changes no behavior; revert the commit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `background-responses-generation`: adds a structural requirement that the background path's pure helpers live outside the service file. Behavior requirements are unchanged.

## Impact

- **Code:** `apps/chat-api/src/conversations/generation/`. One file edited (`background-generation.service.ts`), one extended (`background-message.ts`), two new (`background-terminal.ts`, `background-chunk.ts`).
- **Tests:** `background-generation.service.spec.ts` (two blocks removed) and the new `background-terminal.spec.ts`.
- **Unaffected:** endpoints, OpenAPI, the generated client, env vars, i18n, libs and docs. No doc names these helpers' file. `openspec/specs/conversations-api/spec.md` cites `mergeClientMessages` by name only.
