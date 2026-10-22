Slicing: vertical, risk-first within it — the GET-with-query path (the bulk of the consumer's calls) works
end to end first, then writes, then statuses and deadlines, then the generated client. Every slice keeps
the existing custom-api specs green, which is the backward-compatibility guarantee.

## 1. Registry: method, query, body, deadline

- [x] 1.1 `apps/chat-api/src/custom-api/custom-api-registry.service.ts`: `parseCustomApiRegistry` accepts
      `method` GET/POST/PUT/DELETE, `query` (≤16 unique names, `^[a-z][a-z0-9_]{0,31}$`), `body: "json"`
      on POST/PUT only, `timeoutMs` up to 300,000 (default 10,000 unchanged); `CustomApiOperation` carries
      them. Every invalid case fails startup without printing the value.
      Verification: `npm run test:file -- apps/chat-api/src/custom-api/tests/custom-api-registry.service.spec.ts`
- [x] 1.2 Unit tests for 1.1: each new field accepted, each invalid case rejected (PATCH, bad/duplicate/
      too many names, body on GET/DELETE, timeoutMs 300,001), and an existing GET-only registry parsed
      to the same operations as before.
      Verification: same file as 1.1.

## 2. GET with allowlisted query (slice 1)

- [x] 2.1 `custom-api.controller.ts`: read the parsed query, reject a name outside the operation's
      `query`, a repeated name, a non-string, a value over 2,048 bytes or a total over 8 KiB with 400;
      keep rejecting every query value on an operation without `query`.
      Verification: `npm run test:file -- apps/chat-api/src/custom-api/tests/custom-api.controller.spec.ts`
- [x] 2.2 `custom-api-registry.service.ts` / `custom-api.service.ts`: build the destination with the
      allowlisted parameters (`URLSearchParams`, configuration order) appended to
      `resolveCustomApiDestination`, asserting origin and pathname are unchanged.
      Verification: `npm run test:file -- apps/chat-api/src/custom-api/tests/custom-api.service.spec.ts`
- [x] 2.3 Unit tests for 2.1–2.2: forwarded query, encoding of spaces and slashes, a value that cannot
      change origin/path, every 400 case without dispatch.
      Verification: the files of 2.1 and 2.2.
- [x] 2.4 `npm run verify:changed`.

## 3. Writes (slice 2)

- [x] 3.1 `custom-api.controller.ts`: `@Post`/`@Put`/`@Delete(':id')` handlers sharing the GET path's
      admission, abort and telemetry; 405 when the request method differs from the operation's; HEAD and
      PATCH keep their explicit 405 handlers.
      Verification: `npm run test:file -- apps/chat-api/src/custom-api/tests/custom-api.controller.spec.ts`
- [x] 3.2 JSON body for `body: "json"` operations: Content-Type application/json, object or array,
      ≤65,536 serialized bytes, depth ≤32, else 400; `hasNonEmptyBody` still rejects a body elsewhere.
      `custom-api.service.ts` sends the configured method, the re-serialized body and Content-Type only
      when a body is sent.
      Verification: the files of 3.1 and `apps/chat-api/src/custom-api/tests/custom-api.service.spec.ts`
- [x] 3.3 Unit tests for 3.1–3.2: method mismatch, each body rejection, the forwarded method/body/headers,
      no caller header copied.
      Verification: the files of 3.1–3.2.
- [x] 3.4 Supertest integration tests (`apps/chat-api/src/custom-api/tests/custom-api.controller.spec.ts`
      or a sibling e2e spec, as the module's existing tests do): a configured PUT succeeds with the CSRF
      token, fails with 403 CSRF_INVALID without it, 405 on a GET operation, 400 on an oversized body, 401
      without a session.
      Verification: that spec file.
- [x] 3.5 `npm run verify:changed`.

## 4. Statuses, deadlines, telemetry

- [x] 4.1 `custom-api.service.ts` / `custom-api-response.ts`: accept 201 with bounded JSON and 204 with an
      empty body as `{"data": null}`; 204 with bytes → 502; per-operation deadline from `timeoutMs`.
      Verification: `npm run test:file -- apps/chat-api/src/custom-api/tests/custom-api-response.spec.ts apps/chat-api/src/custom-api/tests/custom-api.service.spec.ts`
- [x] 4.2 `custom-api-telemetry.ts`: bounded `method` label; no query values or bodies.
      Verification: `npm run test:file -- apps/chat-api/src/custom-api/tests/custom-api-telemetry.spec.ts`
- [x] 4.3 Unit tests for 4.1–4.2, including a long-deadline operation that is cut at its own deadline and
      a default one cut at 10 s.
      Verification: the files of 4.1–4.2.
- [x] 4.4 `npm run verify:changed`.

## 5. OpenAPI and the generated client

- [x] 5.1 Swagger: `postCustomApiOperation`, `putCustomApiOperation` (an optional free-form JSON object request
      body) and `deleteCustomApiOperation`, all returning
      `CustomApiResponseDto`; no query DTO; the generator gap for deployment query names documented in
      the operation descriptions.
      Verification: `npm run test:file -- apps/chat-api/src/custom-api/tests/custom-api-openapi.spec.ts`
- [x] 5.2 `npm run openapi`, `npm run openapi:check`, `npm exec nx build chat-api-client -- --skip-nx-cache`,
      `npm exec nx lint chat-api-client`; inspect the generated method names.
- [x] 5.3 `apps/chat/src/server-api/custom-api.api.ts` stays on `getCustomApiOperationRaw` — no change;
      confirm its spec still passes.
      Verification: `npm run test:file -- apps/chat/src/server-api/tests/custom-api.api.spec.ts`
      — Adapter and spec unchanged. Locally the spec cannot load: the worktree's shared node_modules lacks `@silurus/ooxml` (package.json is unchanged from development); CI runs it.

## 6. Docs

- [x] 6.1 `apps/chat-api/README.md` (Custom Core API operations, and the `CUSTOM_CORE_API_CONFIG` row):
      the new fields with an inline example, the method rule, query/body bounds, the 300 s opt-in and
      what it holds, CSRF on writes, the generator gap for query names, Core Route setup for write
      methods and `rewritePath` query copying, and that write routes hand caller JSON to a trusted
      upstream that must validate it.
      Verification: `npm run validate:specs`

## 7. Close

- [ ] 7.1 Follow-up (out of scope, consumer side): the DIAL Loop editor's change moving its runner and
      Teams calls onto these operations.
- [ ] 7.2 `npm run verify:full`; `npm exec nx build chat-api`.
      — Locally: `nx test chat-api` 252 files / 5397 tests green, `nx build chat-api`, chat-api-client build/lint and `openapi:check` green. `verify:full` stops on `nx sync` (the worktree links the main checkout's node_modules, so library references look stale) — run it in CI / a fresh checkout.
