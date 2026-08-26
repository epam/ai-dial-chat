## Context

The BFF is the HTTP user agent for all server-to-server calls to DIAL Core. Today, `DialClientService` creates one `@epam/ai-dial-typescript-sdk` client with the runtime's default fetch implementation, so Undici supplies `User-Agent: node`. The SDK accepts a custom `fetch` function, while three current Core integrations use raw fetch because their operations are SDK gaps: rating (`apps/chat-api/src/rate/rate.service.ts:31`), Scheduler routes (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts:216`), and streaming file upload (`apps/chat-api/src/files/upload/files-upload.service.ts:562`).

The application already has a single version precedence rule in `resolveAppVersion`: a non-blank `CHAT_VERSION` wins, otherwise the bundled `apps/chat-api/package.json` version is used. The displayed and health-check version may contain operator-authored text, but an HTTP product version must be normalized to a conservative token before being placed in a header.

This is outbound operational metadata. There is no new inbound endpoint, authorization rule, rate limit, cache, feature flag, browser state, UI, i18n, RTL, accessibility, or generated-client surface.

## Goals / Non-Goals

**Goals:**

- Identify every DIAL Core request from this BFF as `ai-dial-chat/<normalized-version>`.
- Keep SDK-backed and raw Core requests consistent.
- Preserve every caller-provided header and request option except an attempted per-call User-Agent override.
- Reuse the deployed application version without restricting the existing display-version configuration.
- Keep the identification implementation at the `apps/chat-api` integration edge.

**Non-Goals:**

- Identifying the end user's browser, tenant, account, pod, hostname, Node.js runtime, or environment.
- Creating a machine-enforced client identity or authentication mechanism.
- Applying the Chat User-Agent to non-Core upstream requests.
- Removing raw Core fetch escape hatches where the SDK still lacks an operation.
- Changing any browser-facing API, OpenAPI document, generated client, UI, or library.

## Decisions

### 1. Use the standard product/version User-Agent form

The canonical value is `ai-dial-chat/<normalized-version>`. `User-Agent` already represents the software making an HTTP request, and a product/version token is directly recognizable in access logs. The value will not include comments or secondary products such as the Node.js version because they create high-cardinality noise and disclose unnecessary runtime details.

Alternative: custom `X-DIAL-CLIENT-NAME` and `X-DIAL-CLIENT-VERSION` fields. Those would be appropriate for a future DIAL-wide machine contract, but add a proprietary contract with no current consumer. This proposal is limited to diagnostics.

### 2. Resolve the version once and normalize only the header representation

`DialClientService` resolves the build version once during construction with `resolveAppVersion(configService.get('CHAT_VERSION', { infer: true }))`. For the User-Agent representation, runs of characters outside `A-Z`, `a-z`, `0-9`, `.`, `_`, and `-` are replaced with `-`; leading and trailing separators introduced by normalization are removed; an empty normalized result becomes `unknown`.

The raw `CHAT_VERSION` remains unchanged for the health endpoint, client config, and footer. This avoids a breaking validation change for operators while guaranteeing that arbitrary configured text cannot inject control characters or produce an invalid header.

Alternative: strengthen `CHAT_VERSION` validation globally. Rejected because that setting is also user-visible text and existing deployments may legitimately use characters that are unsuitable for an HTTP product token.

### 3. Own a Core-only fetch transport in DialClientService

`DialClientService` will expose a bound fetch-compatible function for DIAL Core requests. It will construct `Headers` from each request's existing headers, set the canonical `User-Agent` case-insensitively, and delegate to `globalThis.fetch` with every other option unchanged.

The same function will be:

1. passed to `createSDK({ baseUrl, fetch })`, covering all SDK operations; and
2. called by rating, scheduled-task, and file-upload raw Core integrations.

The wrapper deliberately overrides any caller-supplied User-Agent so all Core traffic has one identity. It does not inject authorization or other request-specific fields; those remain the responsibility of each operation.

Alternative: configure a global Undici dispatcher or replace global fetch. Rejected because theme-service and other unrelated upstream requests would be mislabeled. Alternative: add the header at every call site. Rejected because it duplicates version logic and allows future SDK/raw operations to omit the identity.

### 4. Verify behavior at the transport boundary and raw escape hatches

`dial-client.service.spec.ts` will verify the SDK receives the shared fetch function and that invoking it produces the exact User-Agent for configured, fallback, and normalized versions while preserving existing headers. Existing service tests for rating, scheduled tasks, and file upload will assert that their raw Core request uses the shared transport rather than global fetch and retains operation-specific headers.

No live-network integration test is required: the contract is fully observable at the fetch boundary, and existing domain tests already mock upstream calls.

## Risks / Trade-offs

- **[Risk] Core dashboards group by the full build version and create excess cardinality.** → Keep the value limited to the existing deployment version and do not add pod, tenant, or runtime dimensions; operators can aggregate by the `ai-dial-chat/` prefix.
- **[Risk] A raw DIAL Core caller added later uses global fetch directly.** → Document `DialClientService` as the required Core transport and cover known escape hatches in the capability spec and code review checklist.
- **[Risk] Header normalization makes two unusual version strings identical.** → Acceptable because User-Agent is diagnostic rather than a unique build identifier; the original version remains available through health/config endpoints.
- **[Risk] A downstream intermediary rewrites User-Agent.** → Acceptable for diagnostic metadata. If Core requires reliable machine semantics later, introduce an explicit DIAL client-identity contract instead.
- **[Trade-off] Passing a custom fetch function slightly expands DialClientService's public surface.** → This centralizes a cross-cutting outbound concern and is narrower than global fetch configuration or repeated headers.

## Migration Plan

1. Add version resolution, normalization, and the Core-only fetch transport to `DialClientService`.
2. Pass that transport to the SDK and verify SDK behavior.
3. Migrate each raw Core fetch escape hatch and verify its request headers.
4. Update backend documentation and run project/documentation checks.
5. Deploy normally; no data or frontend migration is required. DIAL Core logs begin showing the new value immediately.

Rollback removes the injected transport from SDK construction and restores raw callers to global fetch. Requests then return to the runtime-supplied User-Agent without affecting persistence or public APIs.

## Open Questions

None. If DIAL Core later needs client identity for business logic rather than observability, that must be proposed as a separate cross-service contract instead of extending this User-Agent behavior.
