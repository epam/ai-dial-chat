## ADDED Requirements

### Requirement: Permissions-Policy delegates Local Network Access to allowlisted iframe origins

`apps/chat-api/src/config/csp.ts` SHALL export `buildPermissionsPolicyHeader(allowedIframeOrigins: string[]): string`, which returns a `Permissions-Policy` header value delegating the `local-network-access` feature to `'self'` plus every origin in `allowedIframeOrigins`, formatted as `local-network-access=(self <origin> <origin> ...)`. When `allowedIframeOrigins` is empty, the returned value SHALL delegate to `'self'` only (`local-network-access=(self)`).

`apps/chat-api/src/main.ts` SHALL apply this header via a dedicated `app.use` middleware registered immediately after the existing `helmet(...)` middleware, passing the same `allowedIframeOrigins` value already read from `ALLOWED_IFRAME_ORIGINS` and passed into `createHelmetOptions`. This delegation allows the `/apps-editor` embedded schema iframe (see `app-editor-flow` capability, "App editor iframe component" requirement) — and any window it opens, such as an identity-provider login popup — to request the Local Network Access permission needed when the embedded app's or its identity provider's origin resolves to a private/internal IP address.

#### Scenario: Permissions-Policy header lists allowlisted origins

- **WHEN** `ALLOWED_IFRAME_ORIGINS` is `["https://quickapps.example.com"]`
- **THEN** the response includes `Permissions-Policy: local-network-access=(self https://quickapps.example.com)`

#### Scenario: Permissions-Policy header defaults to self when no origins are allowlisted

- **WHEN** `ALLOWED_IFRAME_ORIGINS` is empty
- **THEN** the response includes `Permissions-Policy: local-network-access=(self)`

#### Scenario: Permissions-Policy header lists multiple allowlisted origins

- **WHEN** `ALLOWED_IFRAME_ORIGINS` is `["https://quickapps.example.com", "https://skills.example.com"]`
- **THEN** the response includes `Permissions-Policy: local-network-access=(self https://quickapps.example.com https://skills.example.com)`
