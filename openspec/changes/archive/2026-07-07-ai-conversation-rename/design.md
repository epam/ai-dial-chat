## Context

The current LLM naming flow (`apps/chat-api/src/conversations/conversation-naming.service.ts`) is a fire-and-forget side effect of `saveConversation`: after the first assistant reply it builds a prompt from exactly the first user/assistant exchange, calls the `UTILITY_MODEL` through the DIAL Core client, sanitises the result with `prepareEntityName`, and persists `{ ...conversation, name, llmNamingDone: true }`. The `llmNamingDone` flag then permanently blocks re-runs, and the frontend uses it to stop watching for async name updates (`display-name-watch.ts`, `Conversation.tsx`).

There is no HTTP endpoint that returns a name; naming is entirely internal. The manual rename path is `PATCH /api/v1/conversations` (`renameConversation`) with `RenameConversationBodyDto.newTitle`, wired to the frontend through `server-api/conversations.api.ts` → generated `@epam/chat-api-client`. The rename UI is `RenameConversationPopup.tsx` (a `DialFormPopup` + `DialInput`), hosted by `ConversationPanelView.tsx`, which calls `renameConversation` from `ConversationsContext`.

This change adds an on-demand, synchronous "generate a title now" capability that reuses the naming machinery but decouples it from persistence and the `llmNamingDone` lock.

## Goals / Non-Goals

**Goals:**
- A synchronous `POST /api/v1/conversations/generate-title?path=<path>` endpoint that returns `{ name }` computed from the **full current** conversation.
- Reuse the existing system prompt, `prepareEntityName` sanitisation, `UTILITY_NAMING_TIMEOUT_MS`, and DIAL Core client path.
- Decouple on-demand generation from `llmNamingDone` (never read, never set) and from persistence (never save).
- A "rename with AI" pencil-style icon button in the rename modal that populates the editable input on success, with spinner and error handling.

**Non-Goals:**
- No change to the existing auto-naming-after-first-reply behavior or the `llmNamingDone` semantics.
- No feature-flag gating of the new control in this change (always available; can be revisited later).
- No streaming; the endpoint blocks until the LLM returns and responds synchronously.
- No automatic persistence — the user still confirms through the existing rename endpoint.

## Decisions

### Decision: Add a method to `ConversationNamingService`, don't fork the LLM code path

Add a public `generateTitle(path, authContext)` (name TBD) method to `ConversationNamingService` that: loads the conversation, builds a prompt from the full message list, calls the same `sendNamingCompletion(...)` helper, sanitises with `prepareEntityName`, and returns the string — with **no** persistence and **no** `llmNamingDone` interaction. The controller (`conversation.controller.ts`) exposes it as the new endpoint.

- **Why**: Maximizes reuse of the prompt, sanitisation, timeout, and DIAL client wiring already proven in the auto-naming flow, and keeps LLM/DIAL knowledge in one service.
- **Alternative considered**: A separate service/module — rejected as duplication of the DIAL client wiring and prompt constants.

### Decision: Authenticate as the calling user (bearer token), not the operator's `DIAL_API_KEY`

Auto-naming (`renameWithLlm`) authenticates its completion call with the operator-configured `DIAL_API_KEY` (`Api-Key` header) since it's an unattributable, fire-and-forget background operation with no natural "requesting user" at the point it runs. On-demand generation is different: it's a deliberate, user-initiated action (clicking the AI-rename button), so `generateTitle` authenticates with `getBearerAuthHeaders(token)` — the same bearer-token scheme regular chat completions use (`chat.service.ts`) — meaning the call consumes the calling user's own model access and quota, not the operator's.

- **Why**: The user is explicitly choosing to spend a model call; it should be attributed and rate/quota-limited the same way their own chat messages are, not billed against a shared service credential.
- **Consequence**: `generateTitle` no longer requires `DIAL_API_KEY` to be configured at all — only `UTILITY_MODEL` (as the deployment id) and the calling user's own access to it. If the user's token lacks permission to invoke that deployment, DIAL Core rejects the call and the endpoint surfaces it as a `502`, correctly reflecting the user's own access rather than a service-wide outage.
- **Alternative considered**: Keep using `DIAL_API_KEY` for consistency with auto-naming — rejected per explicit product decision that this is the user's own choice to spend a model call, not a background/service operation.

### Decision: Prompt uses the last 50 messages, not just the first exchange

`getNamingTriggerState` restricts auto-naming to exactly two non-status messages. For on-demand generation we deliberately bypass that gate and feed the **most recent 50 messages** of the current conversation into the prompt so the title reflects the latest topic. 50 is a conservative starting default and can be tuned later if it proves too small/large for the `UTILITY_MODEL` context window.

- **Why**: The core user problem is title staleness as the conversation grows.
- **Trade-off**: Longer prompts cost more tokens/latency. Mitigate by the 50-message cap (most recent) and the existing timeout.

### Decision: Path passed as a query parameter, no request body

Matches the requested contract and mirrors how other conversation-scoped reads locate the resource. Validate the `path` with the same allowlist regex/DTO validation used elsewhere (`@Matches`) to prevent traversal, per the NestJS rules. Use a query-param DTO (or `@ApiQuery` + validated param) so Swagger emits metadata and the generated client typing is correct.

- **Why**: Consistent with the stated scope and with path-validation conventions in `apps/chat-api`.

### Decision: Response DTO `GenerateTitleResponseDto { name: string }` as a class

Return a class-based DTO (not interface) with `@ApiProperty` so `@nestjs/swagger` emits runtime metadata and the generated SDK method (`generateConversationTitle` / operationId) is typed. Handler name chosen so the generated client method reads well.

### Decision: Rate limit and error mapping

Apply `@Throttle` with a stricter budget than plain reads, since each call hits an LLM: **5 requests / minute per user**. Map upstream failures to `BadGatewayException`/`ServiceUnavailableException`, missing/invalid path to 400, missing conversation to `NotFoundException`, timeout to a typed error. Never return `null` or empty name. Never log tokens/keys.

### Decision: Frontend integrates through the generated client + a modal callback prop

Add `generateConversationTitle(path)` to `server-api/conversations.api.ts` wrapping the regenerated `@epam/chat-api-client` method. `RenameConversationPopup` gains an `onGenerateWithAi` callback prop (following the `onEvent`/`handleEvent` naming rule), plus internal `isGenerating`/`generateError` state and a trailing `IconSparkles` (`@tabler/icons-react`) button inside the input row. The button carries a tooltip label (no visible text label) — icon-only. `ConversationPanelView` supplies the callback that calls the server-api method for the current conversation path. On success `handleGenerateWithAi` sets the input `value`; on failure it surfaces an error string.

- **Why**: Keeps the modal presentational and host-integration knowledge in the app layer; matches existing wiring for `renameConversation`.
- **RTL/i18n**: Button uses logical positioning (`end`) and new i18n keys added to both `en.json` and `translation-keys.ts` (`ConversationPanelI18nKeys`).

## Risks / Trade-offs

- **Longer prompts / cost & latency** → Cap included messages to a recent window; keep the existing timeout; endpoint is user-initiated (low frequency) and rate-limited.
- **User confusion if the suggested name replaces their in-progress edit** → Only replace on explicit button click; keep the field editable and never auto-confirm.
- **Duplicate concurrent generation requests** → Disable the button and show a spinner while in-flight (frontend); optionally guard concurrency server-side, but since nothing is persisted the risk is limited to wasted tokens.
- **OpenAPI/client drift** → Regenerate `@epam/chat-api-client` and run `npm run openapi && npm run openapi:check`; build/lint the client after endpoint changes.
- **Empty/garbage LLM output** → After sanitisation, if the name is empty, return a typed error rather than an empty string so the modal shows an error instead of clearing the title.
- **`getConversation` mis-resolves bucket-stripped nested-folder paths (worked around locally)** → `ConversationService.getConversation()` passes its `conversationPath` argument directly into `getStoredConversation` → `resolveConversationLocation` without first calling `qualifySessionConversationPath` (unlike `renameConversation`, which calls it first — `conversation.service.ts:362`). `resolveConversationLocation`'s generic fallback (`conversation.service.ts:257-264`) treats the first `/`-delimited segment of a bucket-stripped path as the bucket name. This is correct for flat conversations (`gpt-4o__title__uuid`) but wrong for a conversation nested one folder level inside the caller's own bucket — e.g. one created via `duplicateConversation` from the public bucket, which preserves the source's folder segment (`conversation.service.ts:505-507`, e.g. `{bucket}/SL_conversations/{filename}`). Looking such a conversation up by its bucket-stripped id (`SL_conversations/{filename}`) makes the fallback mistake `SL_conversations` for the bucket, silently dropping the real bucket, so DIAL Core reports "Route is not found" → `502`. This is a pre-existing gap in shared code (also present in the plain `GET /api/v1/conversations` endpoint for the same class of conversation), discovered while testing this feature but not caused by it. Rather than modify the shared `getConversation()` (wider blast radius, affects every caller), `ConversationService.generateTitle` calls `qualifySessionConversationPath` itself before delegating — the same one-line pattern `renameConversation` already uses — so this endpoint is correct for nested-folder conversations without touching other callers. The underlying gap in `getConversation()` itself remains and is tracked as a separate follow-up.

## Migration Plan

1. Backend: add DTOs, service method, controller endpoint, tests; regenerate OpenAPI client.
2. Frontend: add server-api wrapper, modal button + state, host wiring, i18n; tests.
3. Deploy backend and regenerated client together (contract addition is backward compatible — new endpoint only).
4. Rollback: the endpoint is additive; reverting the frontend hides the button and reverting the backend removes the route. No data migration and no schema change (nothing persisted, no flag touched).

## Open Questions

_All resolved:_

- **Throttle budget**: 5 requests / minute per user.
- **Prompt message window**: last 50 messages (tune later if needed).
- **Icon**: `IconSparkles`, icon-only with a tooltip label.
