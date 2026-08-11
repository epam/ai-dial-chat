## 1. Types and validation rules

- [x] 1.1 Add optional `temperature?: number` and `max_output_tokens?: number` to `ResponsesApiRequestBody` in `apps/chat-api/src/conversations/generation/generation.types.ts`.
- [x] 1.2 Add a pure `isValidMaxOutputTokens(value: unknown): value is number` guard (positive, integer, `Number.isSafeInteger`) colocated with `ResponsesAdapter` (e.g. exported from `generation.types.ts` or defined in `responses.adapter.ts`), with focused unit tests covering `1`, a representative larger integer, `0`, negative, fractional, `NaN`, `Infinity`, and `Number.MAX_SAFE_INTEGER + 1`.
- [x] 1.3 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` for this slice.

## 2. Capability-gated temperature mapping

- [x] 2.1 Change `resolveGenerationApiForDeployment` in `apps/chat-api/src/conversations/conversation.service.ts` to also derive `temperatureSupported: boolean` from the same `features` object already read for `resolveGenerationApi`, without any additional `getDeploymentDetails` call; return both values to `streamCompletion`.
- [x] 2.2 Update `ResponsesAdapter.buildRequest` to accept `temperatureSupported: boolean` and include `temperature` only when `temperatureSupported === true` and `startConversation.temperature != null` (nullish check, not truthy check).
- [x] 2.3 Update the `streamCompletion` call site (`conversation.service.ts:1372-1376`) to pass `temperatureSupported` into `buildRequest`.
- [x] 2.4 Add/extend `responses.adapter.spec.ts` unit tests: supported + `temperature: 0`; supported + non-zero temperature; unsupported (`false`); support absent/unknown — each asserting the exact request body.
- [x] 2.5 Add/extend a focused `conversation.service.spec.ts` test asserting `getDeploymentDetails` (or the underlying `DeploymentsService` mock) is called exactly once per `streamCompletion` invocation when routed to the Responses adapter, and that the resolved `temperatureSupported` value reaches `buildRequest`.
- [x] 2.6 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 3. maxOutputTokens persistence and Responses mapping

- [x] 3.1 Add optional `maxOutputTokens?: number` to `Conversation` in `libs/chat-shared/src/models/chat.ts`.
- [x] 3.2 Add optional `maxOutputTokens?: number` (with `@ApiPropertyOptional` and documentation-level class-validator decorators, per DTO convention) to `ConversationResponseDto` in `apps/chat-api/src/openapi/openapi-response.dto.ts`; note in a code comment that persistence-time enforcement lives in the adapter guard (Task 1.2), not in nested DTO validation, per `design.md` Decision 4.
- [x] 3.3 Update `ResponsesAdapter.buildRequest` to include `max_output_tokens: startConversation.maxOutputTokens` only when `isValidMaxOutputTokens` passes; never gate this on `maxTokensSupported`/`maxCompletionTokensSupported`.
- [x] 3.4 Add/extend `responses.adapter.spec.ts` unit tests: `maxOutputTokens: 1`; a representative larger positive integer; absent value omits the field; each invalid value (`0`, negative, fractional, `NaN`, `Infinity`, unsafe integer) omits the field; a request with both valid `temperature` and `maxOutputTokens` carries both fields plus the unchanged base body; the built request never contains `max_tokens`, `max_completion_tokens`, `previous_response_id`, or `conversation`.
- [x] 3.5 Add the minimum necessary round-trip tests for the surfaces enumerated in `design.md` Decision 5 that are not already covered by an equivalent `temperature` test — a `ConversationService` save/duplicate round-trip test for `maxOutputTokens`, plus one existing-conversation-without-the-field regression test. Do not duplicate adapter-level coverage at the service level.
- [x] 3.6 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 4. Generated API artifacts (only if required)

- [x] 4.1 Determine whether the `ConversationResponseDto` change alters the generated OpenAPI schema in a way that requires regeneration (it does, since it's a new documented property on an existing schema referenced by the conversation endpoints).
- [x] 4.2 Run `npm run openapi` and `npm run openapi:check`; regenerate `libs/chat-api-client` accordingly.
- [x] 4.3 Verify no generated file under `libs/chat-api-client/src/generated/**` was hand-edited (diff should be generator output only); run `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client`.

## 5. Documentation

- [x] 5.1 Update `docs/responses-api-integration.md`: move `temperature` and `max_output_tokens` from the "Not yet supported" list (around lines 300-313) into the supported scope, describing the capability-gating rule for `temperature` and the validation/omission rule for `max_output_tokens`; keep every other currently-unsupported parameter listed as unsupported.
- [x] 5.2 Note in the doc (or in this change's proposal, already done) that no UI control exists yet for editing `maxOutputTokens` and that this is a follow-up.

## 6. Full verification

- [x] 6.1 Run `npm exec nx affected --target=test --base=origin/development-1.0`. Result: 18 affected projects, all green except 3 pre-existing/unrelated failures verified against the pre-change tree via `git stash` — `@epam/ai-dial-catalog` (`InlineSelect` export/`ItemDetailsTexts` prop mismatches vs. installed `@epam/ai-dial-ui-kit`), a flaky `ScheduledTaskCreatePage` timeout that passes in isolation, and `@epam/ai-dial-conversation-input`'s pre-existing `AddAttachmentButton.tools` failures. `@epam/chat-api` itself: 1843/1843 passing.
- [x] 6.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0`. Result: clean for every project this change touches; the only failure (`@epam/ai-dial-catalog:typecheck`, a lint-chain dependency) reproduces identically on the pre-change tree.
- [x] 6.3 Run `npm exec nx affected --target=typecheck --base=origin/development-1.0` (or the project-level equivalent if no dedicated typecheck target exists for an affected project). Result: `@epam/chat-api:typecheck` and `@epam/chat:typecheck`/`build` are blocked by a pre-existing, repo-wide broken `typecheck` target (563 identical errors on the pre-change tree — stale `dist/**/*.d.ts` project-reference outputs plus an unrelated `@epam/ai-dial-ui-kit` version mismatch in `@epam/ai-dial-catalog`), confirmed via `git stash` on both. `@epam/ai-dial-chat-shared:typecheck` (the one shared-model file this change touches) passes cleanly.
- [x] 6.4 Run `npm exec nx affected --target=build --base=origin/development-1.0`. Result: `@epam/chat-api:build`, `@epam/chat-api-client:build`, and `@epam/ai-dial-chat-shared:build` all pass cleanly. `@epam/chat:build` is blocked by the same pre-existing `@epam/ai-dial-catalog:typecheck` dependency-chain failure (unrelated to this change, reproduced on the pre-change tree).
- [x] 6.5 Confirm all existing hardened Responses stream/terminal-state tests and the existing Chat Completions adapter tests still pass unmodified. Confirmed — all 40 `responses.adapter.spec.ts` tests (hardening + new) and all `conversation.service.spec.ts` tests (110) pass; no Chat Completions adapter test was touched.
