## Context

The Chat frontend currently has no route through which it can upload files to DIAL Core storage or retrieve binary file content. DIAL Core exposes a Files API (`POST /v1/files/{bucket}/{path}` and `GET /v1/files/{bucket}/{path}`) but the BFF contract forbids direct browser access — all traffic must be proxied through `apps/chat-api` so that DIAL Core access tokens are never exposed to the client.

The existing NestJS backend (apps/chat-api) already proxies conversations, models, deployments, and chat completions through the same session-auth pattern. This change follows those conventions and adds a `files` domain in the same style.

All backend conventions (URI versioning, thin controllers, validated DTOs with `@Matches` allowlists, typed HTTP exceptions, Logger + ConfigService, `@epam/ai-dial-typescript-sdk` preferred, raw fetch as a documented exception) are governed by `apps/chat-api/AGENTS.md` and are not repeated here.

## Goals / Non-Goals

**Goals:**
- Proxy multipart/form-data file upload from the browser to DIAL Core under the authenticated session.
- Proxy binary file download from DIAL Core to the browser, streaming content and forwarding safe response headers.
- Validate all user-controlled inputs (bucket, path, filename) with allowlist DTO validation.
- Map DIAL Core error codes to typed NestJS HTTP exceptions (400, 401, 403, 404, 413, 429, 502, 503).
- Publish Swagger/OpenAPI annotations so the generator produces a typed `FilesApi` in `@epam/chat-api-client`.
- Expose frontend wrappers through `apps/chat/src/server-api/files.api.ts`.
- Document any OpenAPI generator gaps (multipart, binary streaming) with narrowly scoped exceptions.

**Non-Goals:**
- Chunked or resumable (multipart range) upload.
- File listing, deletion, or metadata endpoints (future scope).
- File content transformation, virus scanning, or thumbnail generation.
- Caching file content at the BFF layer.
- Direct browser-to-DIAL-Core access of any kind.
- Persisting uploaded files on the Chat API server (files are streamed, not stored).

## Decisions

### Decision 1 — Raw fetch instead of DIAL TypeScript SDK

**Options considered:**
- A. Use `@epam/ai-dial-typescript-sdk` — preferred for DIAL Core calls per AGENTS.md §4.
- B. Raw fetch with `AbortController`.

**Decision: B (raw fetch) for both endpoints, with documented SDK gap.**

Reasoning: The SDK wraps responses through its own serialisation pipeline, which buffers the body. Multipart proxying requires piping the incoming `ReadableStream` (from multer) into the outgoing request body, and binary download requires piping the DIAL Core response body directly to the NestJS `Response` object to avoid buffering the entire file in memory. Neither pattern is composable with the SDK's response handling. Raw fetch is the correct choice for streaming scenarios; this is explicitly permitted by AGENTS.md §4 when the SDK cannot satisfy the use case.

Add `FILE_TRANSFER_TIMEOUT_MS` to `EnvironmentVariables` (default 30 000 ms) and pass it to `AbortController.timeout()`.

---

### Decision 2 — Multer in-memory for upload

**Options considered:**
- A. `diskStorage` — writes temp files to disk, needs cleanup.
- B. `memoryStorage` — file bytes land in `req.file.buffer`, no disk I/O.

**Decision: B (`memoryStorage`)**, with a multer `limits.fileSize` cap drawn from `FILE_UPLOAD_MAX_BYTES` env var (default 50 MB). Files are never persisted on the BFF — the buffer is forwarded in the DIAL Core request body immediately after validation.

NestJS wiring: `@UseInterceptors(FileInterceptor('file'))` + `@UploadedFile()` on the upload handler. Swagger gap: `@ApiConsumes('multipart/form-data')` + `@ApiBody({ schema: { type: 'object', … } })` is required because `@nestjs/swagger` does not auto-detect `multipart/form-data` from `FileInterceptor`.

---

### Decision 3 — Download endpoint shape: query params over path params

**Options considered:**
- A. `GET /api/v1/files/{bucket}/{*path}` — pure REST, but NestJS wildcard routes with URI versioning produce brittle behaviour and the OpenAPI generator cannot express a free-form catch-all path parameter cleanly.
- B. `GET /api/v1/files/download?bucket=X&path=Y` — explicit query params, fully typeable in DTO + Swagger, no wildcard routing.

**Decision: B (query params).** The route `/files/download` is unambiguous relative to `POST /files` (upload). Both `bucket` and `path` are `@IsString()` + `@Matches(allowlist)` validated.

---

### Decision 4 — Safe header forwarding for download

Only an explicit allowlist of DIAL Core response headers is forwarded to the browser:
- `content-type`
- `content-disposition`
- `content-length`

All other headers (including hop-by-hop, CORS, and cookie headers returned by DIAL Core) are stripped. The allowlist is a constant in `files.service.ts` to keep the logic auditable.

---

### Decision 5 — OpenAPI generator gap for binary download

`application/octet-stream` responses cause the OpenAPI generator to emit `Blob | void` as the return type, which loses stream semantics on the frontend. The generated `downloadFileRaw()` method returns the raw `fetch` `Response` object, which supports `response.body` streaming. The `files.api.ts` wrapper documents this gap and uses `downloadFileRaw()`, following the same pattern established in `auth.api.ts` (`getCurrentUserRaw()`).

---

### Decision 6 — Error mapping

| DIAL Core status | NestJS exception             |
|------------------|------------------------------|
| 400              | `BadRequestException`        |
| 401              | `UnauthorizedException`      |
| 403              | `ForbiddenException`         |
| 404              | `NotFoundException`          |
| 413              | `PayloadTooLargeException`   |
| 429              | `TooManyRequestsException`   |
| 5xx              | `BadGatewayException`        |
| Network timeout  | `ServiceUnavailableException`|
| Unexpected       | `InternalServerErrorException` (log first) |

Reuse the existing `handleDialError` utility in `apps/chat-api/src/common/utils/dial-error.ts`; extend it to handle 413 and 429 if not already present.

---

### Decision 7 — Rate limiting

Both endpoints apply a per-route `@Throttle` override stricter than the global 100 req/min default:
- Upload: `{ default: { limit: 20, ttl: 60000 } }` (upload is heavier).
- Download: `{ default: { limit: 60, ttl: 60000 } }`.

---

### Decision 8 — Authentication

Both endpoints are authenticated: `req.user.at` (access token from the BFF session) is forwarded to DIAL Core as `Authorization: Bearer {at}`. No change to the session or auth module is required; the pattern is identical to existing service calls.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Large file upload exhausts Node.js heap via `memoryStorage` | Enforce `FILE_UPLOAD_MAX_BYTES` in multer `limits.fileSize`; DIAL Core will also reject oversized payloads with 413 |
| DIAL Core slow or hung connection holds a Node.js worker | `AbortController.timeout(FILE_TRANSFER_TIMEOUT_MS)` on both upload and download fetch calls |
| Path traversal via `bucket` or `path` query params | `@Matches(/^[\w.\-/]+$/)` allowlist on both fields rejects `..`, `%2F`, and other traversal sequences at DTO validation time |
| SSRF via path injection pointing to internal hosts | Bucket is validated against `^[\w.\-]+$` (no slashes, no colons); path is concatenated onto the fixed `DIAL_CORE_URL` — no user-controlled host |
| Header injection via `Content-Disposition` forwarded to browser | Only allowlisted headers are forwarded; values are taken from the DIAL Core response, not user input |
| Sensitive file content in logs | Logger writes only file name, size, and DIAL Core status code — never file bytes or path beyond what is already in the request DTO |
| OpenAPI generator emits `void` for binary download response | Documented gap; `downloadFileRaw()` used in frontend wrapper |

## Migration Plan

Additive change — no existing endpoints or clients are modified. Deploy order:

1. Merge and deploy `apps/chat-api` with the new `FilesModule`.
2. Run `npm run openapi` + `npm run openapi:check` to regenerate `@epam/chat-api-client`.
3. Build and publish the updated client package.
4. Merge and deploy `apps/chat` with the new `files.api.ts` wrapper.

No rollback complexity: the new endpoints can be removed without affecting existing functionality.

## Open Questions

1. **SDK file methods**: Does the current version of `@epam/ai-dial-typescript-sdk` expose `uploadFile` / `downloadFile` methods? If yes, revisit Decision 1 for the download case (upload still requires raw fetch for stream proxying). → Check SDK source during implementation slice 1.
2. **DIAL Core bucket semantics**: Is the bucket always the user's own bucket (derived from session), or can the user specify an arbitrary bucket? The current proposal assumes the browser supplies both `bucket` and `path`, but DIAL Core may enforce that the bucket matches the authenticated user. → Clarify with DIAL Core API docs during implementation; add server-side bucket enforcement if required.
3. **`Content-Disposition` filename sanitisation**: Should the BFF sanitise the `Content-Disposition` header value from DIAL Core before forwarding, or is trusting DIAL Core's response safe enough? → Conservative default: forward as-is from DIAL Core (a trusted internal system), document the assumption.
