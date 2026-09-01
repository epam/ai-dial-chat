## Why

`ALLOWED_IFRAME_ORIGINS` currently only accepts exact origins (`scheme://host[:port]`), enforced by `@IsUrl` + a no-path/query regex in `apps/chat-api/src/config/environment.config.ts`. An operator who wants to allowlist an entire subdomain family (e.g. every `*.example.com` host that may embed the app or host a Quick Apps editor) has no way to express that: setting `ALLOWED_IFRAME_ORIGINS=https://*.example.com` fails env validation at boot (`each value in ALLOWED_IFRAME_ORIGINS must be a URL address`), and the app never starts. Operators are stuck enumerating every exact host by hand and redeploying whenever a new subdomain is added.

## What Changes

- Accept a single leading-label wildcard host pattern (`https://*.example.com` / `http://*.example.com`) as a valid `ALLOWED_IFRAME_ORIGINS` entry, alongside today's exact-origin entries, in a comma-separated list mixing both forms.
- Replace the current `@IsUrl` + `@Matches` validation pair on `EnvironmentVariables.ALLOWED_IFRAME_ORIGINS` with a single regex-based check that accepts exact origins and the one-leading-wildcard-label form, and rejects everything else a bare `*`, a wildcard anywhere but the leftmost label, multiple wildcards, or a path/query/fragment on either form.
- CSP `frame-src`/`frame-ancestors` generation (`apps/chat-api/src/config/csp.ts`) needs no code change: wildcard host-source syntax is native to CSP and Helmet passes the configured strings through verbatim, so `https://*.example.com` already works as a CSP source once validation lets it through.
- **BREAKING (origin-matching semantics):** the frontend overlay's origin check in `apps/chat/src/context/overlay/OverlayContext.tsx` (`isTrustedHostOrigin`, `handleSetOverlayOptions`) currently does an exact-string `.includes()` lookup against `overlayAllowedOrigins`. It must switch to a wildcard-aware matcher so a wildcard entry in the allowlist is honored for incoming `postMessage` origins, not just for CSP.
- No new environment variable, no change to `OVERLAY_ENABLED`, no change to the `client-config` response shape (`overlayAllowedOrigins` still returns the configured strings verbatim, wildcards included).

## Capabilities

### New Capabilities

(none — this reuses the existing overlay security capability)

### Modified Capabilities

- `chat-overlay-security-config`: `ALLOWED_IFRAME_ORIGINS` validation now accepts a leading-wildcard-label origin pattern in addition to exact origins, and the frontend's incoming-origin check against this allowlist becomes wildcard-aware instead of doing exact string matching.

## Impact

- `apps/chat-api/src/config/environment.config.ts` — validation decorators on `ALLOWED_IFRAME_ORIGINS`.
- `apps/chat-api/src/config/validation.spec.ts` — new/updated cases for wildcard patterns (valid and rejected forms).
- `apps/chat/src/context/overlay/OverlayContext.tsx` — origin matching against `overlayAllowedOrigins`.
- New small pure matcher utility, one per app (no shared lib change — `libs/chat-shared` is types-only, matching logic doesn't belong there): `apps/chat-api/src/config/` (validation regex only, no runtime matcher needed there) and a new frontend utility used by `OverlayContext.tsx`.
- Docs: `apps/chat-api/README.md`, `apps/chat-api/.env.template`, `docs/architecture.md`, `docs/chat-overlay-migration-guide.md` currently describe the variable as "exact origin only" and need the wildcard form documented with an example.
- No database, API contract, or generated-client changes.
