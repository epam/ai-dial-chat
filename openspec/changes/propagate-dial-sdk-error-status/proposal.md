## Why

`@epam/ai-dial-typescript-sdk` client calls resolve to `{ data, error, response }`, where `response` is the raw `Response` and carries the real upstream HTTP status; `error` is only the parsed error body (e.g. `{ message: string }`) and never carries a numeric `status`. In `apps/chat-api/src/conversations/conversation.service.ts` (10+ call sites) and `apps/chat-api/src/auth/bucket/bucket.service.ts` (1 call site), the code destructures `{ data, error }` and discards `response`, then passes the bare error body into `handleDialSdkError`. Since that body has no `status`, `mapDialHttpStatus`'s `isHttpError` check fails and every one of these paths falls through to a generic `BadGatewayException` (502) — regardless of whether DIAL Core actually returned 404, 403, 409, etc. This was observed live: deleting an already-deleted conversation returns HTTP 502 to the client with a generic "Unexpected response from DIAL Core" message, when DIAL Core's real response was 404 Not Found.

This is a pre-existing bug (confirmed unchanged across the `dedupe-common-dial-utilities` refactor — the old `handleDialError(error)` had the identical blind spot), not something introduced by that change. Other SDK-path services (`files.service.ts`, `chat.service.ts`, `rate.service.ts`, `transcription.service.ts`, `user-config.service.ts`) already do this correctly by explicitly passing `{ status: response.status }`; this change brings `conversation.service.ts` and `bucket.service.ts` in line with that established, correct pattern.

## What Changes

- In every affected call site, capture `response` alongside `data`/`error` and pass the real `response.status` into `handleDialSdkError`, mirroring the pattern already used in `files.service.ts`, `chat.service.ts`, `rate.service.ts`, `transcription.service.ts`, and `user-config.service.ts`: `handleDialSdkError({ status: response.status, ...(error ?? {}) }, context, logger)` (exact merge shape to be finalized in design.md).
- Affected call sites in `conversation.service.ts`: `createConversation` (saveConversation call, ~line 168-183), `getStoredConversation` (~line 288-295, used by `getConversation`, `duplicateConversation`, `renameConversation`), `deleteConversation` (~line 323-335), and the remaining `{ data?: unknown; error?: unknown }` / `{ error?: unknown }` destructuring sites at ~lines 462, 562, 822, 863, 1073.
- Affected call site in `bucket.service.ts`: `getUserBucket` (~line 15-31).
- `getStoredConversation` currently `throw`s the raw error body directly (`throw error ?? new Error('Conversation not found')`) instead of routing through `handleDialSdkError` at all — this needs to either call `handleDialSdkError` itself with the captured status, or continue to throw an error that its callers' `catch` blocks can correctly re-map (needs a design decision, since today the caught value in downstream `catch (error)` blocks is the un-shaped body, not a shape `handleDialSdkError` can map either).
- No REST endpoint additions/removals, no OpenAPI changes — this only corrects which status code and exception subtype is returned for already-existing error paths. Response bodies for the *correctly*-mapped cases (i.e., every fetch-path service, and the two SDK call sites that already pass `response.status`) are unaffected.
- **BREAKING (client-visible, but a bug fix)**: clients that today receive `502 Bad Gateway` from the affected endpts on a 404/403/409/etc. upstream condition will start receiving the correct `404`/`403`/`409`/etc. Any frontend code that specifically branches on 502 for these operations (e.g. `deleteConversation`) must be checked for a status-code assumption that needs updating.

## Capabilities

### New Capabilities

- `dial-sdk-error-status-propagation`: the contract that every SDK-shaped DIAL Core error path in `chat-api` must pass the real upstream HTTP status into the shared error mapper, not just the parsed error body. This complements (and, once `dedupe-common-dial-utilities` is archived, should be treated as tightening) the broader `dial-error-mapping` capability, but is specified independently here since that capability isn't published to `openspec/specs/` yet.

### Modified Capabilities

None yet — see note above; if `dedupe-common-dial-utilities` is archived before this change is implemented, consider folding this spec into a delta on `openspec/specs/dial-error-mapping/spec.md` instead at apply/archive time.

## Impact

- **Code**: `apps/chat-api/src/conversations/conversation.service.ts`, `apps/chat-api/src/auth/bucket/bucket.service.ts`.
- **Tests**: add/extend unit tests asserting the real upstream status (404, 403, 409, etc.) is surfaced as the corresponding NestJS exception for each affected method, not a generic 502.
- **Client-visible behavior**: affected endpoints (`DELETE /api/v1/conversations`, `POST /api/v1/conversations` (create), conversation get/duplicate/rename, and the bucket-resolution path used by most authenticated requests) will return accurate status codes for upstream 4xx conditions instead of always 502.
