## 1. Shared DIAL Core transport

- [x] 1.1 In `apps/chat-api/src/dial/dial-client.service.ts`, resolve `CHAT_VERSION` through `resolveAppVersion`, normalize it to the specified product-version representation, expose the canonical `ai-dial-chat/<version>` value without changing the existing public health/config version, and keep the `apps/chat-api/src/config/environment.config.ts` comment accurate for the new normalized outbound use.
- [x] 1.2 In `apps/chat-api/src/dial/dial-client.service.ts`, implement a fetch-compatible Core-only transport that merges existing `HeadersInit`, replaces any User-Agent casing with the canonical value, preserves all other request options, and delegates to `globalThis.fetch`.
- [x] 1.3 Pass the shared transport to `createSDK({ baseUrl, fetch })` so the single SDK client applies the identity to every SDK-backed DIAL Core request.
- [x] 1.4 Extend `apps/chat-api/src/dial/tests/dial-client.service.spec.ts` with configured-version, package fallback, normalization, empty-normalization fallback, header preservation, and User-Agent override scenarios; verify the SDK receives the same shared transport.
- [x] 1.5 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, and `npm exec nx build chat-api` after the shared transport slice.

## 2. Raw DIAL Core escape hatches

- [x] 2.1 Replace the global fetch call in `apps/chat-api/src/rate/rate.service.ts` with the shared `DialClientService` transport while preserving the current Authorization and Content-Type headers; the shared transport must also preserve X-CONVERSATION-ID when the separate conversation-header change is present.
- [x] 2.2 Replace the DIAL Core Scheduler fetch call in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts` with the shared transport while preserving its authentication, body, cancellation, and error behavior.
- [x] 2.3 Replace the streaming DIAL Core upload fetch call in `apps/chat-api/src/files/upload/files-upload.service.ts` with the shared transport while preserving duplex/stream, authentication, content, cancellation, and progress behavior.
- [x] 2.4 Update `apps/chat-api/src/rate/tests/rate.service.spec.ts`, `apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts`, and `apps/chat-api/src/files/tests/upload/files-upload.service.spec.ts` to verify each escape hatch uses the shared transport with its existing operation-specific headers and options.
- [x] 2.5 Search `apps/chat-api/src` for remaining raw fetch calls to DIAL Core; migrate any missed Core caller to `DialClientService` and confirm non-Core callers such as `ThemeService` remain on their own transport.
- [x] 2.6 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, and `npm exec nx build chat-api` after the raw-call migration slice.

## 3. Documentation and final verification

- [x] 3.1 Update `apps/chat-api/README.md` to document the outbound `User-Agent: ai-dial-chat/<normalized-version>`, its `CHAT_VERSION`/package fallback, normalization, diagnostic-only semantics, and coverage of SDK plus raw DIAL Core requests.
- [x] 3.2 Run `npm run validate:docs` after the README change; no OpenAPI generation is required because no browser-facing endpoint or DTO changes.
- [x] 3.3 Run final `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`, and `npm exec nx typecheck chat-api`; if the repository baseline still has unrelated typecheck failures, record them and verify no changed file introduces a new error.
- [x] 3.4 Run `openspec validate identify-dial-client-user-agent --type change --strict --no-interactive` and `git diff --check`, then review the diff for accidental public API, non-Core transport, dependency, library, i18n, UI, or OpenAPI changes.
