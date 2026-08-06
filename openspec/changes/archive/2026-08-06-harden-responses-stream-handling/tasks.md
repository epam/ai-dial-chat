## 1. Event and terminal-state types

- [x] 1.1 Add `ResponsesFailedEvent` (`type: 'response.failed'`, `response?: { id?: string; error?: { message?: string; code?: string } }`) to `apps/chat-api/src/conversations/generation/generation.types.ts` and include it in the `ResponsesSseEvent` union.
- [x] 1.2 Add the `ResponsesTerminalState` string enum (`Success`, `Failed`, `Incomplete`, `StreamError`) and a `ResponsesTerminalSignal` interface (`{ state: ResponsesTerminalState; message?: string }`) to `generation.types.ts`, following the repository TypeScript enum convention.
- [x] 1.3 Add focused unit tests in `apps/chat-api/src/conversations/generation/responses.adapter.spec.ts` asserting the new types compile and are exported/importable as expected (type-level smoke coverage only — behavioral tests land in section 2).

## 2. Terminal-event and truncated-stream handling

- [x] 2.1 In `responses.adapter.ts`, replace the `terminalError: string | null` / `isDone: boolean` pair with a `terminalSignal: ResponsesTerminalSignal | null` local (keep a narrow `isDone` boolean only to control read-loop exit), per design.md Decision 1.
- [x] 2.2 Add a `case 'response.failed':` branch in `handleEvent` that sets `terminalSignal = { state: Failed, message: extractDialErrorMessage(event.response?.error) ?? 'Responses generation failed' }` and `isDone = true`, placed before the `default` branch so it is never counted as an unknown event.
- [x] 2.3 Update the `response.completed` branch to set `terminalSignal = { state: Success }` on terminal-success and `terminalSignal = { state: StreamError, message }` on a non-`completed` status, instead of the current `terminalError`/`isDone` writes.
- [x] 2.4 Update the `response.incomplete` and top-level `error` branches to set `terminalSignal` with `state: Incomplete` / `state: StreamError` respectively (message extraction unchanged).
- [x] 2.5 Update the `[DONE]` marker handling so it sets `terminalSignal = { state: Success }` only when `terminalSignal` is still `null`, never overwriting an already-recorded error/incomplete/stream-error signal.
- [x] 2.6 Replace the post-loop `if (terminalError) {...} res.write('[DONE]'); return completed;` logic with the explicit three-way check from design.md Decision 3: non-success `terminalSignal` → error outcome; `Success` `terminalSignal` → write `[DONE]` and return completed; no `terminalSignal` at all (EOF or `[DONE]` never having produced one) → error outcome with a fixed generic message, no downstream `[DONE]` write.
- [x] 2.7 Add the fixed generic message constant (e.g. `GENERIC_TRUNCATED_MESSAGE`) as a module-level `const` — never derived from upstream content.
- [x] 2.8 Extend `responses.adapter.spec.ts` with the Required Tests 1–9 from the change prompt (`response.failed` before/after text, structured message extraction without logging payload, not counted as unknown event, socket close after deltas without terminal signal, socket close before any event, Core-shaped stream completing on `response.completed` alone without `[DONE]`, legacy `[DONE]` stream still completing, `[DONE]` not overriding an earlier error, non-`completed` status remaining an error) and Required Test 16 (no failure path triggers a Chat Completions retry).
- [x] 2.9 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`; fix any failures before continuing.

## 3. Regression coverage: status filtering and error extraction

- [x] 3.1 Add/confirm a `responses.adapter.spec.ts` test asserting `ConversationMessageRole.Status` messages are excluded from `buildRequest`'s `input` array while surrounding message order is preserved (Required Test 10) — extend existing coverage rather than duplicating if a close match already exists. (Already present in the worktree; confirmed passing, no duplicate added.)
- [x] 3.2 Apply the minimal raw-body fallback change from design.md Decision 5 in `responses.adapter.ts`: read the raw body once, attempt structured JSON extraction, then fall back to the sanitized raw text itself when non-empty and no message was otherwise found.
- [x] 3.3 Add `responses.adapter.spec.ts` tests for Required Tests 11–14: SDK-parsed non-2xx message returned in `errorMessage`; raw-body extraction used only when the SDK gave nothing; a non-empty plain-text body (including `Upstream is missing required id`) preserved via the fallback; an empty body keeping the existing generic (`''`) fallback.
- [x] 3.4 Add a `responses.adapter.spec.ts` test for Required Test 15 confirming abort handling still returns `outcome: 'aborted'` and is not reclassified as a truncated-stream error by the changes in section 2. (Already present in the worktree; confirmed still passing after section 2's changes.)
- [x] 3.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`; fix any failures before continuing.

## 4. Documentation

- [x] 4.1 Update `docs/responses-api-integration.md`'s "Supported events" table to add `response.failed` and describe its behavior (terminal error, partial text preserved, no `[DONE]`, no retry).
- [x] 4.2 Update the "SSE Stream Transformation" and "Completion, Errors, and Stopping" sections to describe the explicit terminal-state model: `response.completed` (valid status) as the canonical success signal, `[DONE]` as compatibility-only for legacy/non-standard upstreams, and end-of-stream without any recognized terminal signal as an error that preserves partial text.
- [x] 4.3 Update the "Current Support Scope" section if needed so it does not claim `[DONE]` is part of the canonical Core contract, and note the known Core-side gap (missing `response.failed` terminal recognition) as an external follow-up, without adding Core implementation work.
- [x] 4.4 Proofread the updated doc against the final `responses.adapter.ts` behavior — no stale event/table descriptions left over from before this change.

## 5. Final verification

- [x] 5.1 Run `npm exec nx affected --target=test --base=origin/development-1.0` and `npm exec nx affected --target=lint --base=origin/development-1.0`; fix any failures. (`chat-api` itself: 1817/1817 tests, 0 lint errors. The affected set also surfaces three failures pre-existing on this branch before this change — confirmed via `git stash` — and unrelated to Responses/generation code: `@epam/ai-dial-conversation-input:test`'s `AddAttachmentButton.tools.spec.tsx` "Deep Research" menu assertion, `@epam/ai-dial-catalog:typecheck`'s missing `InlineSelect` export from `@epam/ai-dial-ui-kit`, and a flaky `@epam/ai-dial-publish-panel:typecheck` that Nx itself flagged as flaky and which passes standalone. None are touched by this change's diff.)
- [x] 5.2 Run `npm exec nx affected --target=build --base=origin/development-1.0` to confirm the affected projects still build. (`chat-api` builds cleanly standalone; the only affected-build failure is the same pre-existing `@epam/ai-dial-catalog:typecheck` issue above, blocking its downstream `@epam/chat:build`/`typecheck` — unrelated to this change.)
- [x] 5.3 Confirm no unrelated files changed (`git status`) and that the diff is limited to `responses.adapter.ts`, `generation.types.ts`, `responses.adapter.spec.ts`, `docs/responses-api-integration.md`, and the openspec change artifacts. (Confirmed via `git status --short`.)
