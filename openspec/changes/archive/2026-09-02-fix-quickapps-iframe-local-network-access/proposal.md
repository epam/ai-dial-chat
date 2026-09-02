## Why

On environments where an embedded custom application (e.g. quickapps-frontend) or its identity provider resolves to a private/internal IP address (e.g. `*.lab.epam.com`), Chrome's Local Network Access (LNA) permission gates any request originating from a cross-origin context. The `/apps-editor` iframe (`AppEditorIframe.tsx`) opens a Keycloak login popup from inside that iframe, but neither the iframe nor the backend's security headers delegate the `local-network-access` permission to it. As a result, the permission prompt attaches ambiguously to the iframe/popup pair and the Keycloak login navigation stalls indefinitely instead of completing or failing visibly.

## What Changes

- Add an `allow="local-network-access=*"` attribute to the `/apps-editor` iframe in `AppEditorIframe.tsx` so the embedded app (and anything it opens, such as the Keycloak login popup) can request and receive the Local Network Access permission.
- Extend the Helmet configuration in `chat-api`'s `createHelmetOptions` (`csp.ts`) with a `Permissions-Policy` directive that delegates `local-network-access` to the same allowlisted iframe origins already used for `frameSrc`/`frameAncestors`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `app-editor-flow`: the embedded schema iframe requirement now specifies the `allow` attribute needed to delegate the Local Network Access permission to the embedded app.
- `chat-overlay-security-config`: the security headers requirement now specifies a `Permissions-Policy` header delegating `local-network-access` to allowlisted iframe origins.

## Impact

- `apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx` — iframe `allow` attribute.
- `apps/chat-api/src/config/csp.ts` — Helmet/Permissions-Policy configuration.
- No API contract or database changes. No breaking changes for existing embedders; this only widens a previously-absent permission delegation.
