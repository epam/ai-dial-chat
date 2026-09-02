## Context

`/apps-editor` embeds a custom application's own editor UI (e.g. quickapps-frontend) in an `<iframe>` (`AppEditorIframe.tsx`, capability `app-editor-flow`). That embedded app opens a login popup to Keycloak. On environments where the embedded app's origin or the identity provider resolves to a private/internal IP (e.g. internal `*.lab.epam.com` addresses), Chrome's Local Network Access (LNA) permission gates the request. Chrome only grants LNA to a cross-origin iframe (and windows it opens) when the top-level page explicitly delegates the `local-network-access` permission — via the iframe's `allow` attribute and/or a `Permissions-Policy` response header naming the iframe's origin. `AppEditorIframe.tsx` currently sets no `allow` attribute, and `createHelmetOptions` (`apps/chat-api/src/config/csp.ts`, capability `chat-overlay-security-config`) never emits a `Permissions-Policy` header — Helmet 8 has no built-in option for it. Without delegation, the permission request/prompt attaches ambiguously to the iframe/popup pair and the Keycloak navigation stalls indefinitely instead of completing or surfacing a visible error.

## Goals / Non-Goals

**Goals:**
- Delegate the `local-network-access` permission from the `/apps-editor` top-level page to the embedded schema iframe, using the same allowlist (`ALLOWED_IFRAME_ORIGINS`) already used for `frameSrc`/`frameAncestors`.
- Keep the delegation scoped to the existing allowlist — do not broaden it to `*` or to origins outside `ALLOWED_IFRAME_ORIGINS`.

**Non-Goals:**
- Do not change how Keycloak login itself works (popup + full-page redirect in the embedded app), and do not touch anything in the quickapps-frontend repository — the popup/redirect flow lives entirely in the embedded app.
- Do not attempt to detect or special-case whether a given deployment's origins actually resolve to private IPs — the permission is delegated unconditionally to allowlisted origins, matching how `frameSrc`/`frameAncestors` already work.
- Do not add a generic Permissions-Policy abstraction for arbitrary features; scope this change to `local-network-access` only.

## Decisions

- **Iframe `allow` attribute**: Add `allow="local-network-access=*"` to the `<iframe>` in `AppEditorIframe.tsx`. Using `*` here (rather than an explicit origin list) is safe because the iframe's `src` — and therefore what the browser treats as the delegate — is already constrained to `schema.editorUrl`, which is only ever a URL server-approved as an application schema; the attribute only controls whether this specific iframe *may ask for* the permission, not who receives it globally. This mirrors the pattern already used for scoped, single-purpose iframes rather than requiring a per-schema-origin allowlist inside the frontend bundle.
- **Permissions-Policy header**: Because Helmet 8 does not support emitting `Permissions-Policy`, add a small dedicated builder `buildPermissionsPolicyHeader(allowedIframeOrigins)` in `csp.ts` that returns the header value `local-network-access=(self <allowed-origins>)`, reusing the exact `allowedIframeOrigins` list already passed into `createHelmetOptions`. Apply it via a one-line `app.use` middleware in `main.ts`, registered immediately after the existing `helmet(...)` middleware, rather than pulling in an extra dependency or reimplementing Permissions-Policy inside Helmet's config object.
- **Reuse `ALLOWED_IFRAME_ORIGINS`** rather than introducing a new env var: this list already represents "origins we intentionally embed and trust enough to load as `frameSrc`," which is the same trust boundary needed for LNA delegation.

## Risks / Trade-offs

- [Risk] `allow="local-network-access=*"` on the iframe looks permissive at a glance → Mitigation: the iframe's `src` is already restricted server-side to schema-approved editor URLs (see `app-editor-flow` requirement "App editor iframe component"); the `allow` attribute cannot grant the permission to any origin the iframe isn't already loading.
- [Risk] The `Permissions-Policy` header syntax for allowlisted origins requires each origin to be a properly quoted, space-separated token; a malformed value silently fails closed (Chrome ignores the whole directive) → Mitigation: reuse the already-validated `ALLOWED_IFRAME_ORIGINS` config value and cover the header-building function with a unit test asserting exact output for representative origin lists.
- [Risk] This only fixes environments where the embedded app's origin is in `ALLOWED_IFRAME_ORIGINS`; it does not help if the identity provider itself (not the iframe's own origin) is what resolves to a private IP and the *popup* window (not the iframe) is what's blocked → Mitigation: `allow` on an iframe is inherited by windows opened from it (per the Permissions Policy spec, popups opened via `window.open` from a permission-delegated iframe inherit the delegated policy), so delegating to the iframe origin is sufficient to cover the login popup it opens; call this out explicitly as the mechanism being relied on.

## Migration Plan

No data migration. Deploy as a normal frontend + backend release:
1. Ship the `AppEditorIframe.tsx` `allow` attribute change (frontend-only, no env var dependency).
2. Ship the `csp.ts`/`main.ts` `Permissions-Policy` header change (backend-only).
3. No rollback beyond reverting the two commits/PRs if the header value ever causes an unexpected CSP-style regression; there is no schema or persisted-state change to roll back.

## Open Questions

- None — the fix reuses an existing, already-audited allowlist and a standard, spec-defined permission-delegation mechanism.
