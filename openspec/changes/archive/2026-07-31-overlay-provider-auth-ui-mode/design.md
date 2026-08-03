## Context

The overlay external-login change (archived 2026-07-27) established a single login path: the overlay iframe always opens a new tab/window to `/login` and polls `GET /api/v1/auth/me` until the session established by that external tab is usable inside the iframe. This approach is mandatory for OIDC providers that refuse to render their authorization pages inside an iframe (Microsoft Entra ID, by `X-Frame-Options: DENY`, is the canonical example; Auth0 hosted Universal Login may also apply clickjacking protection).

Some providers and configurations allow interactive login inside an iframe because they do not set restrictive frame-ancestors directives. In that case, navigating the iframe itself to the BFF login endpoint (`/api/v1/auth/login/:providerId?callbackUrl=...`) is simpler: the BFF redirect chain runs inside the same frame, sets the session cookie, and redirects back to the protected overlay route. The same origin-validated `SET_OVERLAY_OPTIONS` handshake that runs on first load then runs again on the return visit, restoring host options.

The fundamental problem is that which mode is appropriate depends on the OIDC provider configured for a given deployment, and a single deployed chat instance can be embedded by multiple host applications each with a different provider. The configuration scope must therefore be per `ChatOverlay` instance, supplied by the host at construction time.

**Existing surfaces used or extended:**

- `libs/chat-shared/src/types/overlay/overlay-protocol.ts:158` — `ChatOverlayOptions` and `SetOverlayOptionsPayload` are the extension points.
- `libs/chat-overlay/src/lib/ChatOverlay.ts:254` — `setOverlayOptions()` is the mutable runtime surface; `sendCurrentOverlayOptions()` (line 330) is the serialization path.
- `apps/chat/src/context/overlay/OverlayContext.tsx:223` — `hasSetOverlayOptionsPayload` validates the wire payload; `handleSetOverlayOptions` (line 718) applies trusted host options.
- `apps/chat/src/components/OverlayLoginGate/OverlayLoginGate.tsx` — current single-button login gate.
- `apps/chat/src/hooks/auth/useOverlayExternalLogin.ts:40` — existing external auth lifecycle and polling, extended with replacement teardown.
- `apps/chat/src/pages/auth/Login.tsx:28` — provider list and BFF login URL construction; pattern to reuse.
- `apps/chat/src/server-api/auth.api.ts` — `getProviders()` is the existing thin wrapper around `authApi.listProviders()`.

## Goals / Non-Goals

**Goals:**

- Allow a host to opt specific provider IDs into same-window iframe navigation while keeping `External` as the mandatory default for all others.
- Preserve full backward compatibility: existing `ChatOverlay` constructors and integrations compile and behave identically.
- Keep library isolation strict: `libs/chat-shared` and `libs/chat-overlay` must not fetch providers, build `/api` URLs, read auth state, or encode knowledge of any concrete IdP.
- Extend the existing `SET_OVERLAY_OPTIONS` handshake rather than adding a second unauthenticated `postMessage` channel.
- Reuse the existing `getProviders()` call and provider-button UI pattern from `Login.tsx` rather than duplicating logic.
- Preserve all existing external-login behaviors: popup-blocked, retry, long-wait, sequential polling, cleanup, COOP-tolerance, and `SameSite=None; Secure` cookie behavior.

**Non-Goals:**

- Auto-detecting iframe compatibility from provider brand names or IDs.
- Automatic fallback when a same-window navigation is blocked by the IdP's frame policy (not reliably detectable after the iframe has already navigated away).
- Any backend API change. `GET /api/v1/auth/providers` and `GET /api/v1/auth/login/:providerId` are used as-is.
- Supporting `AUTH_UI_MODE` or any deployment-wide env variable for this purpose.
- Making this feature a capability gate via `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES`.

## Decisions

### D1: Public API shape — `auth.providerUiModes` nested record

The host-facing API is:

```ts
enum OverlayAuthUiMode {
  External = 'external',
  SameWindow = 'sameWindow',
}

interface ChatOverlayOptions {
  // existing fields unchanged...
  auth?: {
    providerUiModes?: Record<string, OverlayAuthUiMode>;
  };
}
```

**Alternatives considered:**

| Option | Verdict |
|--------|---------|
| 1. Keep external login only | Conservative baseline; does not solve the problem. Rejected. |
| 2. Deployment-wide `AUTH_UI_MODE` env var | Wrong scope: one deployment can be embedded by multiple hosts with different providers. Rejected. |
| 3. Single `authUiMode: OverlayAuthUiMode` per overlay instance | Does not allow a multi-provider host to configure different modes per provider. A host embedding a deployment that offers both Entra ID and Auth0 cannot configure each correctly. Rejected. |
| 4. `auth.providerUiModes: Record<string, OverlayAuthUiMode>` per overlay instance (selected) | Correct scope: per instance, per provider. Extensible under the `auth` namespace. Provider IDs are opaque strings — no IdP brand knowledge required in the library. Selected. |
| 5. Backend provider response carries iframe-capability metadata | The same deployment can be embedded by hosts with conflicting policies; the capability is not a property of the provider itself. Adding optional backend metadata would require a backend change and still need a host-side override mechanism. Rejected. |

**Wire transport:** The `auth.providerUiModes` map is serialized as `authProviderUiModes?: Record<string, string>` in `SetOverlayOptionsPayload`. Opaque strings on the wire; the app validates and maps them to `OverlayAuthUiMode`. Unknown string values degrade to `External`.

**Why not a flat `sameWindowProviderIds` allowlist?** An allowlist is simpler but less extensible; adding a third mode later (e.g. `popup`) would require a new field and a migration. A record is the same ergonomics for two values and trivially extends.

### D2: Wire validation and degradation strategy

`hasSetOverlayOptionsPayload` in `OverlayContext.tsx` is the existing validation gate for the `SET_OVERLAY_OPTIONS` payload. It must be extended to accept (but not reject on) the new `authProviderUiModes` field.

Validation rules for `authProviderUiModes`:
- Absent or `null`/`undefined`: treated as unset; existing external-only behavior is preserved.
- Present as an object: each entry must have a string key and a string value. Non-string values make the entire field treated as absent (not just the bad entry) to prevent partial-update ambiguity.
- An entry whose value is not a recognized `OverlayAuthUiMode` member is silently demoted to `External` at resolution time (in the hook), not at validation time. This keeps the validation fast and the handshake robust.
- Unknown provider IDs (keys not matching any provider returned by `GET /api/v1/auth/providers`) are ignored.

### D3: State ownership and layer assignments

| Concern | Owner |
|---------|-------|
| `OverlayAuthUiMode` enum and `ChatOverlayOptions.auth` type | `libs/chat-shared/src/types/overlay/overlay-protocol.ts` |
| `authProviderUiModes` wire field on `SetOverlayOptionsPayload` | `libs/chat-shared/src/types/overlay/overlay-protocol.ts` |
| Storing and transmitting `auth` option | `libs/chat-overlay/src/lib/ChatOverlay.ts` |
| Validating wire payload, storing trusted resolved map | `apps/chat/src/context/overlay/OverlayContext.tsx` |
| Provider fetch, BFF URL construction, mode resolution per provider | `apps/chat/src/hooks/auth/useOverlayProviderLogin.ts` (new) |
| External window lifecycle, polling, replacement teardown | `apps/chat/src/hooks/auth/useOverlayExternalLogin.ts` |
| Login gate UI (provider picker or single button) | `apps/chat/src/components/OverlayLoginGate/OverlayLoginGate.tsx` |

`OverlayContext` exposes the trusted `authProviderUiModes` map as part of its context value. The `useOverlayProviderLogin` hook consumes it alongside the providers from `getProviders()`. The `OverlayLoginGate` component calls `useOverlayProviderLogin` instead of `useOverlayExternalLogin` directly.

### D4: `OverlayLoginGate` behavior — provider-picker vs single-button

Two branches:

1. **No provider-mode configuration** (map is empty or absent): render the existing single "Log in" button that opens `/login?callbackUrl=<overlay-close-url>` externally. No provider fetch. Current behavior unchanged.

2. **Provider-mode configuration present** (map has at least one entry): fetch `GET /api/v1/auth/providers` via `getProviders()`, then render one button per provider. Each button's click:
   - **`External`** (including the default for unconfigured provider IDs): call `window.open` synchronously with the BFF login URL for that provider (`/api/v1/auth/login/:providerId?callbackUrl=<overlay-close-url>`). Delegate to the `useOverlayExternalLogin`-equivalent logic already in the hook.
   - **`SameWindow`**: call `window.location.assign` with the same BFF login URL but with `callbackUrl` set to the current same-origin overlay URL (not `/overlay-close`), so the BFF redirects back to the protected overlay route after setting the session cookie.

The no-configuration branch keeps the single-button experience exactly as it is for all existing overlay consumers.

### D5: Provider-picker loading, empty, and error states

- **Loading**: the provider list is fetching. Show a spinner or loading text (`auth.overlayProviderPickerLoading` i18n key) and disable the container. `aria-busy="true"` on the section.
- **Error**: the provider fetch failed. Show an error message (`auth.overlayProvidersError` i18n key) with a retry button that calls `loadProviders()` again.
- **Empty**: provider list returned zero items. Show a generic external "Log in" button fallback (same as the no-configuration branch) to avoid a blank gate.

### D6: Same-window navigation and recovery

When a provider is resolved to `SameWindow`, the hook calls `window.location.assign(bffLoginUrl)`. The iframe navigates away from the protected overlay route. The BFF redirect chain sets the session cookie and returns to `callbackUrl` (the overlay URL). The `OverlayProvider` re-initializes and sends `INIT_READY`; the library replays `SET_OVERLAY_OPTIONS` from its stored options, restoring the host configuration.

No automatic fallback is possible after navigation: if the IdP's frame policy blocks the login page inside the iframe, the browser replaces the iframe content with an error page or a blank frame. The app has no access to the new cross-origin frame's location or error state. This limitation is documented for the host integrating the overlay, which is responsible for verifying provider compatibility before enabling `SameWindow`.

The only available recovery action is the host removing the `SameWindow` entry for that provider from `auth.providerUiModes`. No automatic detection or in-iframe recovery is possible.

External auth attempts do not use `Window.closed` as a completion signal because IdP COOP headers can make the retained handle unreliable. Login controls remain available while waiting; selecting one invalidates the previous attempt, clears both timers, best-effort closes the retained window, and starts the replacement login flow.

### D7: `setOverlayOptions()` during an active attempt

If `setOverlayOptions()` is called while an external login attempt is in progress (status is `waiting` or `takingLonger`), the new `auth.providerUiModes` map is stored in `ChatOverlay` and re-sent to the iframe via `SET_OVERLAY_OPTIONS`. The `OverlayContext` applies it. The in-progress external attempt is not torn down; its completion is still driven by the iframe-side `/auth/me` poll. The updated map takes effect on the next login initiation.

If `setOverlayOptions()` is called while a `SameWindow` navigation is underway, it is stored but the iframe has already navigated away; the update will be transmitted on the next `READY` event after the iframe returns.

### D8: Backward compatibility and rollback

All new fields in `ChatOverlayOptions` and `SetOverlayOptionsPayload` are optional. Existing callers that do not pass `auth` compile unchanged. The wire payload change is additive: an older iframe (without this feature) receives `authProviderUiModes` in the `SET_OVERLAY_OPTIONS` payload and ignores it because `hasSetOverlayOptionsPayload` previously accepted extra fields (the validation only checks the fields it knows about). A newer host sending `authProviderUiModes` to an older iframe gets the existing external-only behavior — safe by definition because `External` is the default.

Rollback is host-side: remove `auth.providerUiModes` from the `ChatOverlay` constructor options. No deployment configuration change or data migration is needed.

### D9: Security

- Origin validation in `handleSetOverlayOptions` is unchanged. `authProviderUiModes` is accepted only from the trusted host origin, exactly as `theme`/`modelId` are.
- Provider IDs are opaque strings. The hook constructs BFF URLs as `/api/v1/auth/login/${encodeURIComponent(providerId)}?callbackUrl=${encodeURIComponent(callbackUrl)}`, where `callbackUrl` is always a same-origin URL validated by the BFF's existing `resolveCallbackUrl` guard. No raw user-supplied string is ever embedded directly in a URL without encoding.
- No token, session ID, or credential crosses the overlay protocol or appears in any URL.
- `postMessage(..., '*')` is never introduced. The existing `hostDomain` validation is preserved.

## Risks / Trade-offs

**[Risk] Same-window navigation leaves no recovery path if the IdP blocks the iframe.**
→ Mitigation: Document the limitation in the migration guide. The host is responsible for verifying iframe compatibility before opting in.

**[Risk] `GET /api/v1/auth/providers` fails while the user is on the login gate.**
→ Mitigation: Show an error state with a retry button. The empty list falls back to a generic external login button.

**[Risk] Provider-mode map received before providers are fetched; a race between `SET_OVERLAY_OPTIONS` arrival and the provider list fetch.**
→ Mitigation: `useOverlayProviderLogin` fetches providers independently of the context's `authProviderUiModes` arrival. Both are needed before a provider button is clickable; the loading state covers any gap.

**[Risk] Provider IDs on the wire can be arbitrary strings; no allow-list enforced.**
→ Mitigation: Entries for IDs not returned by `GET /api/v1/auth/providers` are simply never rendered in the picker UI and never used.

**[Risk] `setOverlayOptions()` with a changed `authProviderUiModes` during a waiting external attempt.**
→ Mitigation: The in-progress attempt is not interrupted; the new map applies to the next attempt. Documented in the spec.

## Migration Plan

1. Deployment: no server-side changes required; deploy the updated frontend bundle.
2. Host integration: pass `auth.providerUiModes` to the `ChatOverlay` constructor only for providers known to support iframe login. Omitting the option keeps existing behavior.
3. Rollback: remove the `auth` option from the constructor. Restored immediately without a redeploy.

## Open Questions

None. The codebase investigation and comparison of alternatives are complete.
