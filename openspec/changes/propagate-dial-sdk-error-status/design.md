## Context

`@epam/ai-dial-typescript-sdk` (openapi-fetch based) resolves every operation to a discriminated union:

```ts
type SDKResponse<TData, TError> =
  | { data: TData; error?: never; response: Response }
  | { data?: never; error: TError; response: Response };
```

`response` (the raw `Response`, carrying `.status`) is present on **both** branches. `error` is only ever the parsed JSON error body from DIAL Core (typically `{ message: string }`) — it never carries a numeric `status` field itself.

`handleDialSdkError` → `mapDialHttpStatus` needs a numeric `status` to pick the right NestJS exception; its `isHttpError` type guard checks for `'status' in error && typeof error.status === 'number'`. Five of the seven SDK-path services (`files.service.ts`, `chat.service.ts`, `rate.service.ts`, `transcription.service.ts`, `user-config.service.ts`) already work around this correctly: they destructure `response` alongside `data`/`error` and construct `{ status: response.status }` (sometimes merged with the error body) before calling `handleDialSdkError`. `conversation.service.ts` (10 call sites) and `bucket.service.ts` (1 call site) do not — they destructure only `{ data, error }`, discard `response`, and hand the bare error body to `handleDialSdkError`, which always falls through to the generic `BadGatewayException` (502) branch of `mapDialHttpStatus`.

This bug predates the `dedupe-common-dial-utilities` refactor (the old `handleDialError(error)` had the exact same blind spot — it never received a status either). It is being fixed now as its own change because it's an independent, client-visible behavior change (see proposal.md's BREAKING note), not a pure refactor.

## Goals / Non-Goals

**Goals:**
- Every SDK-shaped error path in `conversation.service.ts` and `bucket.service.ts` passes the real `response.status` into `handleDialSdkError`, matching the pattern already used elsewhere.
- `getStoredConversation` (a private helper used by `getConversation`, `duplicateConversation`, and `renameConversation`) stops throwing an un-shaped raw error body and instead produces something its callers can correctly status-map.
- Add regression tests asserting specific status codes (404, 403, 409, etc.) — not just "some 4xx or 5xx" — for each fixed call site.

**Non-Goals:**
- No change to the correctly-working call sites in `files.service.ts`, `chat.service.ts`, `rate.service.ts`, `transcription.service.ts`, `user-config.service.ts`.
- No change to `handleDialSdkError`'s or `mapDialHttpStatus`'s signatures or status-to-exception table (defined by `dial-error-mapping`) — this change is purely about what callers pass in, not the mapper itself.
- No new REST endpoints, no OpenAPI changes.

## Decisions

### 1. Status-capture shape: `{ status: response.status, ...errorBody }`

At each affected call site, change the destructuring to also capture `response`, and build the value passed to `handleDialSdkError` as an object literal with `status` set from `response.status`, spreading the original error body's own fields after it (in case any DIAL Core error body includes useful fields like `message` that `handleDialSdkError`'s logging or future error-detail work might use):

```ts
const { data, error, response } = (await this.client.deleteConversation(...)) as {
  data?: unknown;
  error?: unknown;
  response: Response;
};
if (error != null) {
  handleDialSdkError(
    { status: response.status, ...(typeof error === 'object' && error ? error : {}) },
    'conversations.deleteConversation',
    this.logger,
  );
}
```

This exactly matches the shape already used in `files.service.ts` (`{ status: response.status }`) and `chat.service.ts`/`transcription.service.ts` (`result.error ?? { status: result.response.status }`) — no new pattern is introduced, just consistent application of the existing one.

Alternative considered: change `handleDialSdkError`'s signature to accept an explicit `status?: number` third-ish parameter instead of requiring callers to shape the error object. Rejected — it would touch the already-correct call sites too (churn with no behavior change) and diverge from the pattern the rest of the codebase already uses; the fix should be minimal and localized to the two broken services.

### 2. `getStoredConversation`: route through `handleDialSdkError` at the source

Today, `getStoredConversation` does:
```ts
if (error != null || !data) {
  throw error ?? new Error('Conversation not found');
}
```
and its callers' `catch (error)` blocks re-throw via `handleDialSdkError(error, ...)` — but by the time it's caught, the thrown value is still the un-shaped body (or a generic `Error`), so the same status-loss bug applies transitively to `getConversation`, `duplicateConversation`, and `renameConversation`.

Decision: capture `response` in `getStoredConversation` and, on error, call `handleDialSdkError({ status: response.status, ...(error ?? {}) }, 'conversations.getStoredConversation', logger)` directly instead of throwing a bare `Error`. Since `handleDialSdkError` always throws (return type `never`), this preserves the "throws on failure" contract for callers without requiring them to change their `catch` blocks — the exception that reaches them is now already the correctly-mapped `HttpException` subtype, and `handleDialSdkError`'s own `HttpException` re-throw branch (first check in the function) means callers' `catch (error) { ...; return handleDialSdkError(error, ...) }` will just re-throw it unchanged, which is correct and requires no caller-side changes.

`getStoredConversation` needs a `logger` available — check whether it currently has access to `this.logger` (it's a private method on `ConversationService`, which already has `this.logger`); pass it through.

Alternative considered: keep throwing a bare `Error`/body from `getStoredConversation` and instead have each of its three callers inspect the thrown value more carefully. Rejected — that triples the fix surface for no benefit; centralizing the fix in the one shared helper is simpler and is exactly the kind of consolidation the codebase already does elsewhere (mirrors why `dedupe-common-dial-utilities` centralized the mapper in the first place).

### 3. `bucket.service.ts`: same fix, single call site

`getUserBucket` gets the identical treatment: capture `response`, pass `{ status: response.status, ...(error ?? {}) }`.

### 4. Fire-and-forget / non-fatal call sites are out of scope

`preserveLlmDisplayName`'s inner `saveConversation` call (~line 455-468) only logs a warning on `saveError` and never calls `handleDialSdkError` at all — it's intentionally non-fatal (a name-sync side effect). This change does not alter that; only call sites that already call (or, for `getStoredConversation`, effectively feed into) `handleDialSdkError` are in scope.

## Risks / Trade-offs

- [Behavior change is client-visible: some operations that returned 502 today will return 404/403/409/etc.] → This is the explicit goal (bug fix), documented as **BREAKING** in proposal.md; flag it prominently in the PR description so frontend code that might branch on 502 for these specific operations (search `apps/chat/src/server-api` and conversation-related hooks for any status-502-specific handling before merging) can be checked.
- [Merging `{ status: response.status, ...error }` could shadow `status` if the error body itself happens to contain a `status` field with a different meaning] → Put `status: response.status` LAST in the object spread (i.e., spread the error body first, then set `status` from `response.status`) so the real HTTP status always wins: `{ ...(error ?? {}), status: response.status }`. (Note: corrected order vs. the illustrative snippet in Decision 1 — implementers must use error-first, status-last ordering.)
- [`getStoredConversation`'s callers' logging messages reference `error`/`readError`/etc. by their old (bare-body) shape in log calls] → Since `handleDialSdkError` now throws before returning to the caller's `if (error != null)` branch, some of those pre-existing `this.logger.error('...', error)` calls immediately preceding the `handleDialSdkError`/`throw` become dead code for the `getStoredConversation`-sourced error path specifically (the log already happened inside `getStoredConversation`, or the exception now bypasses the caller's branch since `getStoredConversation` throws directly) — verify no error information is silently dropped by comparing before/after log output in the new tests.

## Migration Plan

Single-slice change confined to `conversation.service.ts` and `bucket.service.ts`. No feature flag, no staged rollout — ship as one PR with the regression tests from tasks.md proving each affected operation now returns the correct status for a simulated 404/403/409/5xx upstream response. Verify with `npm exec nx test chat-api` and `npm exec nx lint chat-api`. Rollback is a normal revert; no data migration.

## Open Questions

- Whether any `apps/chat` frontend code depends on the current (incorrect) 502 status for one of the affected operations — to be checked during implementation via a grep for `502` / `BadGateway` handling in `apps/chat/src/server-api` and related hooks before merging, not resolved here.
