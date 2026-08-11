## Why

`ResponsesAdapter.relay` (`apps/chat-api/src/conversations/generation/responses.adapter.ts:75`) currently has two terminal-state gaps: a `response.failed` event falls through the `default` unknown-event branch instead of being treated as an error, and a clean upstream socket close with no recognized terminal event (`response.completed`, `response.incomplete`, `error`, or `[DONE]`) is currently treated as success. Both let a failed or truncated Responses generation be persisted as a completed assistant message. The Responses feature is about to expand scope, so this correctness gap must be closed first.

## What Changes

- Add a typed `response.failed` event to the Responses SSE event union and handle it as a terminal error — extract a safe message from `response.error`, preserve any assembled partial text, skip the downstream `[DONE]` write, and never retry through Chat Completions.
- Replace the current "loop ended ⇒ success" assumption with an explicit terminal-state model: end-of-stream (or `[DONE]`) without a prior `response.completed`/`response.failed`/`response.incomplete`/`error`/abort is itself a terminal error, using a stable generic message that never echoes prompt or response content.
- Introduce a string enum for the adapter's terminal lifecycle state (created/streaming/completed/failed/incomplete/truncated, per the repository's enum convention) so precedence between competing terminal signals (`response.failed`, `response.incomplete`, top-level `error`, abort, invalid `response.completed`, compatibility `[DONE]`, socket EOF) is explicit rather than encoded in loosely related booleans.
- Continue accepting `[DONE]` only as a backward-compatibility signal for legacy/non-standard upstreams; it must not override an already-observed error terminal state, and it is no longer required for a canonical Core stream that ends in a valid `response.completed`.
- Add regression tests for two safeguards already present in the current worktree so they cannot silently regress: filtering `ConversationMessageRole.Status` messages out of the Responses `input` (`responses.adapter.ts:53-73`), and SDK-first non-2xx error extraction with a raw-body fallback (`responses.adapter.ts:101-134`), extending the fallback to accept a non-empty plain-text body (e.g. Core's `Upstream is missing required id`) via `extractDialErrorMessage` (`apps/chat-api/src/common/dial/dial-error.mapper.ts:79`).
- Update `docs/responses-api-integration.md` so its supported-event table, completion semantics, and `[DONE]`/EOF description match the hardened behavior.

## Non-Goals

- No changes to `POST /api/v1/conversations/completions`, the browser SSE contract, or Chat Completions behavior.
- No automatic fallback from Responses to Chat Completions after `createResponse` starts (unchanged).
- No attachment, tool-calling, reasoning, multimodal-input, or `previous_response_id`/`store: true` work — out of scope, per the existing "Current Support Scope" limits in the docs.
- No changes to `ai-dial-core`. Core does not yet treat `response.failed` as terminal and can end a stream on socket EOF without a recognized terminal event; that gap is recorded as a follow-up for the Core repository, not implemented here.
- No new HTTP endpoints, environment variables, feature flags, user-visible strings, dependencies, or caches.

## Acceptance Criteria

- A `response.failed` event, at any point in the stream, ends the generation as `outcome: 'error'`, preserves partial text, is never counted as an unknown event, and never triggers a downstream `[DONE]` write or a Chat Completions retry.
- A canonical Core stream ending in a valid `response.completed` completes successfully without requiring `[DONE]`.
- A stream that ends (via `[DONE]` or socket EOF) without any recognized terminal signal returns an error outcome, preserves partial text, and does not write downstream `[DONE]`.
- `[DONE]` continues to complete a legacy-compatible stream but never overrides an already-observed `response.failed`, `response.incomplete`, `error`, abort, or invalid-status `response.completed`.
- `response.completed` with a non-`completed` status remains an error, unchanged.
- Internal `ConversationMessageRole.Status` messages are excluded from Responses `input`; surrounding message order is preserved.
- A non-2xx `createResponse` result surfaces the SDK-parsed message first, then falls back to raw-body extraction (structured JSON, then plain text) only when the SDK provided none; an empty body keeps the existing generic fallback. Logs carry only status and the sanitized message, never the full result/body/prompt/response text.
- Abort handling is unaffected and still reports `outcome: 'aborted'`, not a truncated-stream error.
- All Chat Completions behavior, the `/api/v1/conversations/completions` contract, and existing successful `response.completed`/`[DONE]` streams are unchanged.

## Backward Compatibility and Rollback

- Fully backward compatible for callers: no request/response contract, endpoint, or frontend behavior changes. The only externally observable difference is that streams that previously mis-persisted as "completed" (failed or truncated upstream) now correctly persist as errors — this is a bug fix, not a behavior change callers depend on.
- Legacy/non-standard upstreams that only send `[DONE]` (no `response.completed`) keep working exactly as before, provided no earlier error terminal state was observed.
- Rollback is a plain revert of the adapter/type/test/doc changes in this change; no data migration, schema change, or persisted-state change is introduced, so rollback carries no cleanup burden.

## Alternatives Considered

- **Treat socket EOF as success unless a boolean `hadError` flag was set** — rejected: this is the current design and is exactly the bug being fixed; ad hoc booleans don't express precedence between multiple possible terminal signals cleanly.
- **Drop `[DONE]` support entirely now that `response.completed` is authoritative** — rejected: `[DONE]` remains a real backward-compatibility path for non-Core or older upstreams per the prompt's explicit requirement; removing it would be a scope-expanding breaking change with no Core-side driver.
- **Fix Core's missing `response.failed` terminal handling instead of hardening Chat** — rejected: out of scope for this repository; Chat must defend against the sibling system's current behavior regardless, and the Core gap is recorded as a follow-up, not fixed here.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `responses-api-generation`: adds `response.failed` handling, replaces the implicit EOF-as-success behavior with an explicit terminal-state precedence model (including `[DONE]` as compatibility-only), and adds regression requirements for status-message filtering and SDK-first/raw-body error extraction.

## Impact

- `apps/chat-api/src/conversations/generation/responses.adapter.ts` — terminal-state handling, `response.failed`, EOF-without-terminal-signal error path, raw-body plain-text fallback.
- `apps/chat-api/src/conversations/generation/generation.types.ts` — new `ResponsesFailedEvent` type and (if introduced) a terminal-lifecycle-state string enum.
- `apps/chat-api/src/conversations/generation/responses.adapter.spec.ts` — new and updated tests per the Required Tests list.
- `apps/chat-api/src/conversations/conversation.service.ts` and its tests — verified unaffected beyond receiving the same `GenerationRelayOutcome` shape; touched only if finalization-path coverage is required.
- `docs/responses-api-integration.md` — supported-event table, completion/terminal-state section, `[DONE]`/EOF description.
- `openspec/specs/responses-api-generation/spec.md` — delta for the modified capability.
