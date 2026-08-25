## Why

Outbound requests from the new Chat BFF currently inherit Undici's generic `User-Agent: node`, so DIAL Core logs cannot reliably distinguish AI DIAL Chat from other Node.js clients or identify the deployed Chat build. The shared DIAL transport should provide a stable, product-specific identifier without exposing tenant, host, or user information.

## Problem

`DialClientService` currently constructs the shared SDK with only `baseUrl` (`apps/chat-api/src/dial/dial-client.service.ts:26`), leaving the HTTP runtime to choose `User-Agent`. Several DIAL Core integrations also use raw `fetch`, so changing only the SDK headers would leave inconsistent identification across rating, scheduled-task, and file-upload requests.

## Solution

Route both SDK and raw DIAL Core requests through a shared transport owned by `DialClientService`. The transport will set `User-Agent: ai-dial-chat/<version>`, deriving the version through the existing `resolveAppVersion` precedence rule (`apps/chat-api/src/common/utils/app-version.ts:23`) and normalizing it to a safe HTTP product-version token.

## What Changes

- Add a product-specific `User-Agent` to every outbound request that `chat-api` sends to DIAL Core.
- Reuse `CHAT_VERSION`, falling back to the bundled `apps/chat-api/package.json` version.
- Normalize unsupported version characters for the header without changing the version displayed by the UI or health endpoint.
- Use one DIAL Core fetch transport for the SDK and existing raw-fetch escape hatches.
- Add transport and affected-service tests that verify the exact header while preserving existing request headers.
- Update backend documentation for the outbound client identity.

## Non-goals

- No browser-to-BFF request or response contract changes.
- No OpenAPI or generated frontend-client changes.
- DIAL Core must not use `User-Agent` for authentication, authorization, routing, feature gating, or other business decisions.
- The header will not include the Node.js version, hostname, environment, tenant, account, or user identifiers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dial-core-client`: identify AI DIAL Chat with a stable product/version User-Agent and apply it consistently through the shared SDK and raw DIAL Core transport.

## Alternatives Considered

- Keep Undici's `User-Agent: node`: rejected because it is runtime-dependent and does not identify the calling product.
- Add custom `X-DIAL-CLIENT-NAME` and `X-DIAL-CLIENT-VERSION` headers: not selected because this change is diagnostic metadata, for which the standard `User-Agent` product/version format is sufficient. A dedicated DIAL contract remains appropriate if Core later needs machine-enforced client semantics.
- Configure a process-global fetch or Undici dispatcher: rejected because it would also label unrelated upstream calls, such as theme-service requests, as DIAL Chat-to-Core traffic.

## Acceptance Criteria

- SDK-backed Chat-to-Core calls send `User-Agent: ai-dial-chat/<normalized-version>`.
- Raw DIAL Core calls made by rating, scheduled tasks, and file upload send the identical header.
- Existing Authorization, content negotiation, correlation, conversation, and client-channel headers remain unchanged.
- `CHAT_VERSION` is preferred; blank or missing values use the bundled package version.
- Arbitrary configured version text cannot produce an invalid HTTP header value.
- Backend unit tests, lint, build, and documentation validation pass for the affected project; typecheck is run and the change introduces no new errors relative to the current branch baseline.

## Compatibility and Rollback

The change is backward-compatible because it only replaces an automatically generated outbound metadata value. Rollback consists of removing the shared User-Agent injection and returning raw DIAL requests to the runtime default; no persisted data, public endpoint, or frontend migration is involved.

## Impact

- Backend: `apps/chat-api/src/dial/dial-client.service.ts`, its tests, and raw DIAL Core callers in rating, scheduled tasks, and file upload.
- Documentation/OpenSpec: `apps/chat-api/README.md` and the `dial-core-client` capability.
- External observation: DIAL Core access logs will see `ai-dial-chat/<version>` instead of the Node runtime default.
- Dependencies, frontend, libraries, OpenAPI, rate limiting, caching, i18n, RTL, and accessibility: no impact.
