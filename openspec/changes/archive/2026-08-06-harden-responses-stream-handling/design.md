## Context

`ResponsesAdapter.relay` (`apps/chat-api/src/conversations/generation/responses.adapter.ts:75-277`) reads the Responses SSE body line by line, calls `handleEvent` per parsed frame, and stops the loop when either `terminalError` is set or `isDone` becomes `true` (`responses.adapter.ts:212-249`). After the loop, the only branch is:

```ts
if (terminalError) { return { outcome: 'error', ... } }
res.write('data: [DONE]\n\n');
return { outcome: 'completed', assembledMessage };
```

`isDone` is set in exactly two places today: on the legacy `[DONE]` marker (`responses.adapter.ts:232-235`) and on a `response.completed` event whose `status` is `'completed'` or absent (`responses.adapter.ts:165-183`). Everything else — including the plain end of the `while (true)` loop when `upstreamReader.read()` returns `done: true` with no prior terminal event, and the unhandled `response.failed` type falling into the `default` unknown-event branch (`responses.adapter.ts:193-209`) — currently falls through to the success return. That is the bug: absence of an explicit error is silently treated as presence of success.

The prompt's Core-behavior baseline is authoritative context for this design, not something Chat can control:

- Core's canonical Responses stream ends in `response.completed` or `response.incomplete`, never `[DONE]`.
- Core may end a proxied stream on upstream socket close even without a recognized terminal event.
- Core does not yet treat `response.failed` as terminal internally, so it can forward `response.failed` as an ordinary frame before closing the socket — Chat is the only layer currently positioned to treat it as terminal.
- Core's non-2xx bodies can be plain text (e.g. `Upstream is missing required id`), and the generated SDK may expose that text via its parsed `error` rather than structured JSON.

This design only touches `apps/chat-api/src/conversations/generation/{responses.adapter.ts,generation.types.ts,responses.adapter.spec.ts}` and `docs/responses-api-integration.md`. `ConversationService`'s consumption of `GenerationRelayOutcome` (`conversation.service.ts:1369-1460`) is unaffected — the `rejected`/`completed`/`aborted`/`error` outcome shape does not change, only which branch a given upstream stream shape now resolves to.

## Goals / Non-Goals

**Goals:**

- Make `response.failed` a first-class terminal error event, symmetric with `response.incomplete`.
- Make "the stream ended" and "the stream succeeded" two independent facts — success requires an explicit terminal-success signal, not merely the absence of an explicit terminal-error signal.
- Give the terminal-state precedence rules (which signal wins when more than one is observed) a single explicit representation instead of leaving it implicit in `if`/`break` ordering.
- Preserve every existing passing behavior: successful `response.completed` streams, legacy `[DONE]`-only streams, `response.incomplete`, in-band `error`, unknown-event skipping/metrics, aborts, and the two pre-existing safeguards (status-message filtering, SDK-first error extraction) — all get explicit regression tests, not new implementation, except where item below requires a small addition.
- Extend the non-2xx raw-body fallback to accept a non-empty plain-text body as the error message when the SDK gave nothing and the body isn't JSON (Core's plain-text error shape).

**Non-Goals:**

- No change to `ai-dial-core`. Core's missing `response.failed` terminal recognition and EOF-without-terminal-event behavior are external facts this design defends against, not defects this change fixes.
- No change to the `NormalizedStreamChunk` shape, the `/api/v1/conversations/completions` contract, or anything `apply-chunk.server.ts`/the frontend consumes.
- No automatic Responses → Chat Completions fallback (unchanged existing constraint).
- No new metric, endpoint, env var, or feature flag. The existing `generationUnknownEventsTotal` metric and `generation.requests`/`generation.stream_duration` metrics keep recording exactly the outcomes the adapter already returns.

## Decisions

### 1. Explicit terminal-state enum instead of `terminalError: string | null` + `isDone: boolean`

Replace the two loosely-related locals with one variable holding a discriminated terminal-state value, using a string enum for the state discriminant per the repository's TypeScript enum convention (`AGENTS.md` §TypeScript enums / `all-ts.md`):

```ts
enum ResponsesTerminalState {
  Success = 'success',
  Failed = 'failed',       // response.failed
  Incomplete = 'incomplete', // response.incomplete
  StreamError = 'stream_error', // top-level `error` event or invalid response.completed status
}

interface ResponsesTerminalSignal {
  state: ResponsesTerminalState;
  message?: string; // only meaningful for non-Success states
}
```

`handleEvent` sets a local `terminalSignal: ResponsesTerminalSignal | null` (mirrors today's `terminalError`) instead of the current pair. `isDone` remains as a separate, narrower flag that only means "stop reading the socket" — it is set by `response.completed` (terminal-success), `response.failed`/`response.incomplete`/`error` (terminal-error — the loop should still stop early, matching today's `if (terminalError || isDone) break;`), and by `[DONE]`. Reusing one enum for "why did we stop" keeps the precedence check in one place instead of re-deriving it from independent booleans.

**Alternative considered:** keep `terminalError: string | null` and add a second `isSuccess: boolean`. Rejected — that's exactly one more loosely-related boolean, which is the pattern the prompt asks to move away from, and it still doesn't name the four distinguishable states for the compatibility-`[DONE]` precedence rule below.

### 2. `response.failed` is handled exactly like `response.incomplete`, one branch earlier than `default`

Add `ResponsesFailedEvent` to `generation.types.ts`:

```ts
export interface ResponsesFailedEvent {
  type: 'response.failed';
  response?: { id?: string; error?: { message?: string; code?: string } };
}
```

(`response.error` per the prompt's "Extract ... from `response.error`" — mirrors the OpenAI Responses API's `response.failed` payload shape, which nests the error under `response.error`, not top-level `error` as the existing `error` SSE event does.)

In `handleEvent`, add a `case 'response.failed':` branch before `default`, setting `terminalSignal = { state: Failed, message: extractDialErrorMessage(event.response?.error) ?? 'Responses generation failed' }` and `isDone = true` (so the read loop exits promptly rather than waiting for more frames that a failed generation is unlikely to send). This reuses `extractDialErrorMessage` (`dial-error.mapper.ts:79`) exactly as the prompt requires ("the repository's established DIAL error-extraction conventions") — `response.error` already matches the `{ message?: string }` shape that function accepts as an object payload.

**Alternative considered:** a bespoke `extractResponsesFailedMessage` parsing only `response.error.message`. Rejected — `extractDialErrorMessage` already handles the object-with-`message`/`display_message` shape and a plain-string payload; a second parser would be exactly the "second error schema" the prompt says not to invent.

### 3. Loop-exit fallthrough becomes an explicit branch, not an assumed success

Today the code after the `while` loop is `if (terminalError) return error; res.write('[DONE]'); return completed;`. Replace it with an exhaustive check driven by `terminalSignal`:

```ts
if (terminalSignal && terminalSignal.state !== ResponsesTerminalState.Success) {
  return { outcome: 'error', error: new Error(terminalSignal.message ?? GENERIC_TRUNCATED_MESSAGE), assembledMessage };
}
if (terminalSignal?.state === ResponsesTerminalState.Success) {
  res.write('data: [DONE]\n\n');
  return { outcome: 'completed', assembledMessage };
}
// Loop ended (EOF or [DONE]) with no explicit terminal signal observed.
return { outcome: 'error', error: new Error(GENERIC_TRUNCATED_MESSAGE), assembledMessage };
```

`GENERIC_TRUNCATED_MESSAGE` is a fixed, non-content string (e.g. `'Responses generation ended before completion'`) — never built from anything upstream-controlled, satisfying "a stable generic error message that does not expose prompt or response content."

`[DONE]` no longer implies success by itself: `handleEvent`'s legacy `payload === '[DONE]'` branch only sets `isDone = true`; it must not overwrite an existing `terminalSignal`. Concretely, the `[DONE]` handling becomes:

```ts
if (payload === '[DONE]') {
  isDone = true;
  if (!terminalSignal) {
    terminalSignal = { state: ResponsesTerminalState.Success };
  }
  continue;
}
```

— i.e. `[DONE]` sets `Success` only if nothing else already claimed the terminal state, giving the required precedence: `response.failed` / `response.incomplete` / `error` / invalid-status `response.completed`, once observed, cannot be overridden by a later `[DONE]`. A valid `response.completed` already sets `terminalSignal = { state: Success }` itself (see #4), so a canonical Core stream no longer depends on `[DONE]` at all — it succeeds on `response.completed` alone, and the loop's `if (terminalSignal || isDone) break;` guard (unchanged shape, now keyed off `terminalSignal`) still exits promptly.

**Alternative considered:** treat clean EOF as success when at least one delta was received (assume "if we got content, it probably finished"). Rejected — this is a heuristic, not an explicit signal, and is precisely the class of assumption the prompt requires removing; a delta-then-socket-drop is a real truncation failure mode this change must catch (see Required Test 5).

### 4. `response.completed` with a non-`completed` status stays a `StreamError`, not silently swallowed

The existing status check (`responses.adapter.ts:174-177`) is preserved verbatim in behavior, only re-expressed against the new state: `status != null && status !== 'completed'` sets `terminalSignal = { state: StreamError, message: ... }` (equivalent to today's `terminalError = ...`) and does **not** set `Success`. This is unchanged behavior, called out because it interacts with the new `[DONE]`-non-override rule: if a non-standard upstream sent an invalid-status `response.completed` and later also sent `[DONE]`, the `StreamError` state must still win (Required Test 8, generalized).

### 5. Non-2xx raw-body fallback: add a plain-text branch, do not replace the JSON-first attempt

Current code (`responses.adapter.ts:109-117`):

```ts
if (!errorMessage) {
  try {
    const rawBody = await dialResult.response.text();
    errorMessage = extractDialErrorMessage(JSON.parse(rawBody)) ?? '';
  } catch {
    /* non-JSON or empty body */
  }
}
```

The `catch` currently discards a non-JSON body entirely, which loses Core's plain-text errors (`Upstream is missing required id`). Minimal fix — read the body once, try JSON extraction, and if that doesn't yield a message, fall back to the raw text itself when non-empty:

```ts
if (!errorMessage) {
  const rawBody = await dialResult.response.text().catch(() => '');
  if (rawBody) {
    try {
      errorMessage = extractDialErrorMessage(JSON.parse(rawBody)) ?? '';
    } catch {
      /* not JSON — fall through to plain-text below */
    }
    if (!errorMessage) {
      errorMessage = StringUtils.sanitizeForLog(rawBody, 500);
    }
  }
}
```

This is the smallest change that satisfies "attempt structured JSON extraction first and then treat the raw text itself as the error candidate" and "apply the repository's sanitization rules before logging it" (`StringUtils.sanitizeForLog`, already used for the unknown-event-type label in this same file). An empty body (`rawBody === ''`) leaves `errorMessage` as `''`, preserving the existing generic-fallback behavior exactly. The same fix pattern applies to `chat-completions.adapter.ts`'s identical block only if the design decides to share it — **out of scope here**: the prompt scopes this requirement to the Responses adapter's `createResponse` path, and `chat-completions.adapter.ts` already has its own passing tests for its current (JSON-only) fallback; duplicating the fix there is not requested and would expand this change's blast radius. This is flagged as a candidate follow-up, not implemented.

**Alternative considered:** treat `rawBody` as the primary candidate and only try JSON as a refinement. Rejected — reversing the order could regress a case where the raw body is JSON whose top-level shape isn't itself the message (e.g. `{"error": {"message": "..."}}` — the full JSON string would become the "message" instead of the extracted field) if the JSON-parse branch didn't run first.

### 6. Where the enum lives

`ResponsesTerminalState` is added to `generation.types.ts` alongside the other Responses-only types (`ResponsesFailedEvent`, updated `ResponsesSseEvent` union). It is not exported for use outside `responses.adapter.ts`/its spec unless a future change needs it — `ConversationService` continues to depend only on `GenerationRelayOutcome`, which is unchanged.

## Risks / Trade-offs

- **[Risk]** A real but non-standard upstream that relies on today's "EOF ⇒ success" behavior (sends deltas, closes the socket, no `response.completed`/`[DONE]`) will start seeing that generation persisted as an error. → **Mitigation**: per the prompt's Core-behavior baseline, DIAL Core's canonical stream always ends in `response.completed`/`response.incomplete`, and legacy/non-standard upstreams are expected to send `[DONE]`; a stream matching neither was already a truncation bug being masked, and partial text is still preserved exactly as before, so the user-visible regression is limited to no longer showing a truncated answer as if it finished cleanly.
- **[Risk]** `response.failed`'s `response.error` shape is inferred from the OpenAI Responses API convention, not confirmed against a live Core response, since Core does not yet emit `response.failed` as a terminal event today. → **Mitigation**: `extractDialErrorMessage` already tolerates a missing/malformed `error` field (returns `undefined`, feeding the existing `'Responses generation failed'` fallback), so an unexpected shape degrades to a generic message rather than throwing.
- **[Trade-off]** Introducing `ResponsesTerminalState` touches every branch of `handleEvent` and the post-loop logic in one slice, rather than patching `response.failed` and the EOF case independently. → Accepted: the prompt explicitly asks for "terminal state explicit rather than relying on loosely related booleans," and patching the two gaps independently while keeping `terminalError`/`isDone` would keep exactly the anti-pattern being removed.

## Migration Plan

Pure application-code change with no data migration, schema change, or deployment step beyond the normal build/deploy of `chat-api`. Rollback is a plain `git revert` of the adapter/types/spec/doc commits — no persisted state depends on the new behavior, and no external contract changes.

## Open Questions

- None — the prompt's Core-behavior baseline, error-extraction conventions, and enum requirement fully determine the approach above.
