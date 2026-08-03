## Why

The overlay currently forces every unauthenticated user through an external tab/window login regardless of the OIDC provider configured on a given deployment. Some providers (e.g. those configured with PKCE flows through Keycloak or certain Auth0 tenant settings) can complete interactive login inside the same iframe window, avoiding the popup/tab round-trip and its associated friction. A single deployment-wide switch is the wrong scope: one deployed chat instance can be embedded by multiple independent host applications, each configured with a different OIDC provider; only the host that constructs `ChatOverlay` knows which provider it has wired up and whether that provider supports same-window navigation inside an iframe. The safe default must remain external login.

## What Changes

- `ChatOverlayOptions` (`libs/chat-shared`) gains an optional `auth` field containing an optional `providerUiModes` record mapping opaque provider ID strings to a new `OverlayAuthUiMode` enum (`External | SameWindow`).
- `SetOverlayOptionsPayload` (`libs/chat-shared`) gains a matching optional `authProviderUiModes` field for wire transport.
- `ChatOverlay` (`libs/chat-overlay`) stores the `auth` option, includes `authProviderUiModes` in the `SET_OVERLAY_OPTIONS` payload when set, and updates the stored map on `setOverlayOptions()` calls without mutating an in-progress attempt.
- `OverlayContext.tsx` (`apps/chat`) validates and applies the `authProviderUiModes` field from the trusted `SET_OVERLAY_OPTIONS` handshake, exposes the resolved per-provider mode to the auth concern, and degrades any unknown or invalid entry to `External`.
- A new `useOverlayProviderLogin` hook (`apps/chat/src/hooks/auth/`) replaces `OverlayLoginGate`'s direct use of `useOverlayExternalLogin`. The hook fetches providers (reusing `getProviders()`), resolves each provider's mode from the overlay-context configuration, and delegates to either the existing external-window path or a new same-window navigation path depending on the resolved mode.
- `OverlayLoginGate` is updated to render a provider-picker UI when provider-mode configuration is present in the overlay context, or the current single "Log in" button behavior when it is absent.
- For providers resolved to `SameWindow`: the hook navigates the iframe itself (`window.location.assign`) to the BFF provider login endpoint with the current same-origin overlay URL as the `callbackUrl`. No `window.open` is called and no external polling starts. On the return visit (the BFF redirects back), the existing origin-validated overlay handshake replays and restores host options.
- For providers resolved to `External`: the existing `useOverlayExternalLogin` behavior is used as-is, called synchronously from the provider's click handler.
- `docs/chat-overlay-migration-guide.md` documents the new option, the safe-default external behavior, and the recovery considerations for incorrectly opted-in providers.
- `openspec/specs/overlay-external-login`, `openspec/specs/chat-overlay-library`, and `openspec/specs/chat-overlay-protocol` receive delta updates for the new wire field and provider-aware behavior.

No backend API changes are required. The existing `GET /api/v1/auth/login/:providerId?callbackUrl=` and `GET /api/v1/auth/providers` endpoints cover all new flows.

## Capabilities

### New Capabilities

- `overlay-provider-auth-ui-mode`: provider-aware login mode selection for the overlay login gate; includes the public `OverlayAuthUiMode` enum, wire field, `OverlayContext` trusted state, `useOverlayProviderLogin` hook, `OverlayLoginGate` provider-picker UI, same-window navigation path, and associated i18n keys, a11y, and RTL coverage.

### Modified Capabilities

- `chat-overlay-protocol`: `SetOverlayOptionsPayload` gains optional `authProviderUiModes?: Record<string, string>` (opaque strings on the wire, validated app-side); `ChatOverlayOptions` gains optional `auth?: { providerUiModes?: Record<string, OverlayAuthUiMode> }`.
- `chat-overlay-library`: `ChatOverlay` serializes the new `auth` option into `SET_OVERLAY_OPTIONS`, stores it, and updates it via `setOverlayOptions()` without mutating an in-progress attempt; `OverlayAuthUiMode` is exported from the lib's public index.
- `overlay-external-login`: `OverlayLoginGate` gains a provider-picker branch when `authProviderUiModes` is configured; the external-login lifecycle is reused through a new intermediary hook and supports replacing a waiting attempt.

## Impact

- **`libs/chat-shared`**: `overlay-protocol.ts` — add `OverlayAuthUiMode` enum, `auth` field on `ChatOverlayOptions`, `authProviderUiModes` field on `SetOverlayOptionsPayload`. No logic, no new imports.
- **`libs/chat-overlay`**: `ChatOverlay.ts` — store and transmit the new `auth` option; `index.ts` — export `OverlayAuthUiMode`; `README.md` — add usage example.
- **`apps/chat`**: `OverlayContext.tsx` — validate and expose resolved auth provider modes; new hook `apps/chat/src/hooks/auth/useOverlayProviderLogin.ts`; `OverlayLoginGate.tsx` — provider-picker branch; `apps/chat/src/i18n/locales/en.json` — new i18n keys.
- **`openspec/specs/`** and **`docs/chat-overlay-migration-guide.md`** — updated documentation.
- **No backend changes.** `GET /api/v1/auth/providers` and `GET /api/v1/auth/login/:providerId` are reused without modification.
- **No breaking changes.** Existing `ChatOverlay` constructors without `auth` continue to compile and behave as before. Wire payloads without `authProviderUiModes` are accepted by the app without errors.
- **Library isolation preserved.** `libs/chat-shared` stays import-free. `libs/chat-overlay` stores and transmits generic `Record<string, string>` data; it does not fetch providers, build `/api` paths, or know any IdP brand. All BFF URL construction, provider DTO use, and session logic stay in `apps/chat`.
