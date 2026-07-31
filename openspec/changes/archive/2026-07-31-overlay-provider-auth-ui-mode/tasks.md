## 1. Protocol Types (libs/chat-shared)

- [x] 1.1 Add `OverlayAuthUiMode` string enum (`External = 'external'`, `SameWindow = 'sameWindow'`) to `libs/chat-shared/src/types/overlay/overlay-protocol.ts`; the file must gain no new imports.
- [x] 1.2 Add optional `auth?: { providerUiModes?: Record<string, OverlayAuthUiMode> }` field to `ChatOverlayOptions` in the same file.
- [x] 1.3 Add optional `authProviderUiModes?: Record<string, string>` field to `SetOverlayOptionsPayload` in the same file; the wire type uses opaque strings, not the enum.
- [x] 1.4 Verify that all existing callers of `ChatOverlayOptions` and `SetOverlayOptionsPayload` compile without modification (no newly required fields).
- [x] 1.5 Run `npm exec nx lint @epam/ai-dial-chat-shared` and `npm exec nx build @epam/ai-dial-chat-shared` for this slice.

## 2. Library Serialization and Exports (libs/chat-overlay)

- [x] 2.1 Update `libs/chat-overlay/src/lib/ChatOverlay.ts`: store the `auth` option alongside the other stored constructor options.
- [x] 2.2 Update `sendCurrentOverlayOptions()` in `libs/chat-overlay/src/lib/ChatOverlay.ts`: include `authProviderUiModes` in the `SET_OVERLAY_OPTIONS` payload when `options.auth?.providerUiModes` is set and non-empty; omit the field otherwise, following the same pattern used for `theme`, `modelId`, and `overlayConversationId`.
- [x] 2.3 Update `setOverlayOptions()` in `libs/chat-overlay/src/lib/ChatOverlay.ts`: replace stored `options.auth` when `auth` appears in the partial update; preserve the existing stored `auth` when `auth` is absent from the update.
- [x] 2.4 Export `OverlayAuthUiMode` from `libs/chat-overlay/src/index.ts` (re-export from `@epam/ai-dial-chat-shared`).
- [x] 2.5 Add or update tests in `libs/chat-overlay/src/lib/` covering: constructor without `auth` emits no `authProviderUiModes`; constructor with entries emits them in the payload; empty `providerUiModes` map omits the field; `setOverlayOptions` replaces stored `auth` when provided; `setOverlayOptions` preserves stored `auth` when the update contains no `auth` key.
- [x] 2.6 Add a usage example to `libs/chat-overlay/README.md` showing a `ChatOverlay` constructor with two providers using different modes and a comment explaining that `SameWindow` requires the host to verify that the provider supports iframe login for their specific configuration.
- [x] 2.7 Run `npm exec nx test @epam/ai-dial-chat-overlay`, `npm exec nx lint @epam/ai-dial-chat-overlay`, and `npm exec nx build @epam/ai-dial-chat-overlay`.

## 3. OverlayContext Validation and State (apps/chat)

- [x] 3.1 Extend `hasSetOverlayOptionsPayload` in `apps/chat/src/context/overlay/OverlayContext.tsx` to accept an optional `authProviderUiModes` field: treat absent/null/undefined as unset and accept the payload; accept a present value only when it is a plain object with all string values; treat a non-object or an object containing any non-string value as absent without breaking the handshake.
- [x] 3.2 Add `authProviderUiModes: Record<string, string> | undefined` to the `OverlayContext` state; expose it through the context value, keeping it stable across re-renders via the existing `useMemo` pattern.
- [x] 3.3 Update `handleSetOverlayOptions` in `apps/chat/src/context/overlay/OverlayContext.tsx` to store the validated `authProviderUiModes` map; treat invalid field values as absent.
- [x] 3.4 Add or update `apps/chat/src/context/overlay/tests/OverlayContext.spec.tsx` covering: missing field accepted, context value is `undefined`; valid map stored correctly; non-object field treated as absent; object with non-string value treated as absent; an `authProviderUiModes`-bearing message from an untrusted origin is still rejected.
- [x] 3.5 Run `npm exec nx test @epam/chat -- OverlayContext`, `npm exec nx lint @epam/chat`, and `npm exec nx build @epam/chat`.

## 4. useOverlayProviderLogin Hook (apps/chat)

- [x] 4.1 Create `apps/chat/src/hooks/auth/useOverlayProviderLogin.ts`: fetch providers via `getProviders()` on mount with a cancellation flag to prevent setState-on-unmount; read `authProviderUiModes` from `useOptionalOverlay()`; call `useOverlayExternalLogin` unconditionally.
- [x] 4.2 Expose from the hook: `providers: ProviderInfoDto[] | null`, `isLoadingProviders: boolean`, `hasProviderError: boolean`, `retryLoadProviders: () => void`, `openProviderLogin: (providerId: string) => void`, `openLogin: () => void` (delegated from `useOverlayExternalLogin` for the no-configuration single-button path), `externalLoginStatus: OverlayExternalLoginStatus`.
- [x] 4.3 Implement mode resolution in `openProviderLogin(providerId)`: look up the provider ID in `authProviderUiModes`; treat absent, unknown, or unrecognized string values as `External`.
- [x] 4.4 Implement External path in `openProviderLogin`: call `window.open` synchronously with `/api/v1/auth/login/${encodeURIComponent(providerId)}?callbackUrl=${encodeURIComponent(`${window.location.origin}/overlay-close`)}` and the same polling/state mechanics as `useOverlayExternalLogin` for that attempt.
- [x] 4.5 Implement SameWindow path in `openProviderLogin`: call `window.location.assign` with `/api/v1/auth/login/${encodeURIComponent(providerId)}?callbackUrl=${encodeURIComponent(window.location.href)}`; do not call `window.open` and do not start external-login polling.
- [x] 4.6 Add auth-hook tests covering: providers fetched on mount; fetch cancelled on unmount; `hasProviderError` + retry; `SameWindow` mode calls `window.location.assign` not `window.open`; `External` mode calls `window.open` not `window.location.assign`; unconfigured provider ID uses External; unrecognized string mode falls back to External; provider ID encoded with `encodeURIComponent` in URL path segment; `callbackUrl` encoded correctly per mode; replacement clears timers and prevents the old attempt from polling again; no token/session data in either URL.
- [x] 4.7 Run `npm exec nx test @epam/chat -- useOverlayProviderLogin`, `npm exec nx lint @epam/chat`, and `npm exec nx build @epam/chat`.

## 5. OverlayLoginGate UI — Provider Picker (apps/chat)

- [x] 5.1 Add i18n keys to `apps/chat/src/constants/translation-keys.ts` under `AuthI18nKeys`: `OverlayProviderPickerLoading` and `OverlayProvidersError`. Add `Retry` to `ButtonsI18nKeys` if not already present.
- [x] 5.2 Add English strings for the new keys to `apps/chat/src/i18n/locales/en.json`; verify every new key in `OverlayLoginGate` is looked up through the enum members via `useTranslation()`.
- [x] 5.3 Update `apps/chat/src/components/OverlayLoginGate/OverlayLoginGate.tsx` to call `useOverlayProviderLogin` instead of `useOverlayExternalLogin` directly.
- [x] 5.4 Implement Branch A (no `authProviderUiModes` or empty map): render the existing single "Log in" button using `openLogin()` from the hook; no provider fetch, no picker UI.
- [x] 5.5 Implement Branch B loading state: show `auth.overlayProviderPickerLoading` text, set `aria-busy="true"` on the section container.
- [x] 5.6 Implement Branch B error state: render `role="alert"` region with `auth.overlayProvidersError` text and a retry button calling `retryLoadProviders()`.
- [x] 5.7 Implement Branch B empty-list state: fall back to the single "Log in" button (same as Branch A).
- [x] 5.8 Implement Branch B populated state: render one button per provider showing the provider `label` and icon from `https://authjs.dev/img/providers/${id.replace(/[1-9]\d*$/, '')}.svg` (icon hidden on load error, `aria-hidden="true"`); each button's `onClick` calls `openProviderLogin(provider.id)` synchronously.
- [x] 5.9 Disable the generic login and provider buttons only during the synchronous `opening` transition; while `waiting` or `takingLonger`, keep them enabled so a new selection replaces the active attempt. Set `aria-busy="true"` while an attempt is active.
- [x] 5.10 Preserve the `role="alert"` blocked message and `aria-live="polite"` taking-longer message below the provider list for both branches.
- [x] 5.11 Use only logical Tailwind spacing utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `gap-*`) for all new layout; do NOT apply `rtl:scale-x-[-1]` to provider icons.
- [x] 5.12 Add/update `apps/chat/src/components/OverlayLoginGate/tests/OverlayLoginGate.spec.tsx` covering: Branch A renders single button with no picker; Branch B loading sets `aria-busy`; Branch B error renders `role="alert"` and retry; Branch B populated renders one button per provider; generic and provider buttons can replace a waiting attempt; blocked message is `role="alert"`; taking-longer is `aria-live="polite"`.
- [x] 5.13 Run `npm exec nx test @epam/chat -- OverlayLoginGate`, `npm exec nx lint @epam/chat`, and `npm exec nx build @epam/chat`.

## 6. Sandbox Example (libs/chat-overlay)

- [x] 6.1 Add or extend a TypeScript snippet in `libs/chat-overlay` (README or sandbox) showing `ChatOverlay` constructed with two providers using different modes (`OverlayAuthUiMode.External` and `OverlayAuthUiMode.SameWindow`) with a comment stating that `SameWindow` is an explicit opt-in and that the host is responsible for verifying the provider's iframe compatibility before using it.
- [x] 6.2 Confirm the snippet type-checks without errors with `npm exec nx build @epam/ai-dial-chat-overlay`.

## 7. Docs Update

- [x] 7.1 Update `docs/chat-overlay-migration-guide.md`: add a section documenting the new `auth.providerUiModes` option — the `External` safe default, the `SameWindow` opt-in, the same-window recovery limitation (no automatic fallback once the iframe navigates away), and a migration example using two providers with different modes.

## 8. Final Verification

- [x] 8.1 Run `npm exec nx test @epam/ai-dial-chat-shared` and `npm exec nx test @epam/ai-dial-chat-overlay`.
- [x] 8.2 Run `npm exec nx test @epam/chat -- OverlayContext useOverlayProviderLogin OverlayLoginGate`.
- [ ] 8.3 Run `npm exec nx affected --target=lint --base=origin/development-1.0`.
- [x] 8.4 Run `npm exec nx affected --target=build --base=origin/development-1.0`.
- [x] 8.5 Run `npm exec nx affected --target=test --base=origin/development-1.0`.

## 9. Interactive Sandbox Case

- [x] 9.1 Add an `apps/chat-overlay-sandbox` case with a dynamic list of editable provider IDs and per-provider `External` / `SameWindow` selectors.
- [x] 9.2 Demonstrate constructor-time `auth.providerUiModes`, runtime updates, and clearing the configuration through `setOverlayOptions()`.
- [x] 9.3 Add navigation and case-level tests, then run sandbox test, lint, and build targets.
