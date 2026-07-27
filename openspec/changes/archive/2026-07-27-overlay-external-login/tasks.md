## 1. Redirect Isolation (`useAuthRedirect` disabled flag)

- [x] 1.1 Update `apps/chat/src/hooks/auth/useAuthRedirect.ts` to accept an optional `options: { disabled?: boolean }` parameter; return from the effect before any provider fetch, `sessionStorage` read/write, `navigate`, or `window.location.assign` call when `options.disabled` is `true`.
- [x] 1.2 Confirm `<LoginPage />` (`apps/chat/src/pages/auth/Login.tsx`) still calls `useAuthRedirect()` with no arguments; add a regression assertion that behavior is unchanged.
- [x] 1.3 Add/update `apps/chat/src/hooks/auth/useAuthRedirect.spec.tsx` covering: `disabled: true` performs none of the four side effects; omitted/`false` options preserve every existing scenario.
- [x] 1.4 Run `npm exec nx test @epam/chat -- useAuthRedirect` and `npm exec nx lint @epam/chat` for this slice.

## 2. External Auth Tab/Window Flow

- [x] 2.1 Add `apps/chat/src/hooks/auth/useOverlayExternalLogin.ts` exposing lifecycle state `idle | opening | waiting | blocked | takingLonger` and an `openLogin()` action.
- [x] 2.2 On `openLogin()`, synchronously call `window.open('/login?callbackUrl=<overlay-close-url>', '_blank')` so the IdP renders outside the iframe and browser settings decide whether it is a tab or separate window.
- [x] 2.3 Poll from the iframe through `UserContext.refresh({ setLoading: false })`; when it returns `authenticated`, close the external auth window best-effort and render protected content without setting the global loading state or reloading the iframe.
- [x] 2.4 Surface blocked cases and long-running unfinished attempts as retryable states. Treat auth-window `closed` observations as unreliable after provider navigation, keep polling after the long-wait threshold, and use the iframe-side current-user response as the authoritative completion signal.
- [x] 2.5 Add `apps/chat/src/hooks/auth/tests/useOverlayExternalLogin.spec.tsx` covering tab open target, blocked open, delayed first poll, non-overlapping polling, successful context refresh, long-wait backoff, retry teardown, and unmount cleanup.

## 3. `OverlayLoginGate` Component And `RequireAuth` Wiring

- [x] 3.1 Add `apps/chat/src/components/OverlayLoginGate/OverlayLoginGate.tsx`: centered layout, title + description + `PrimaryButton` "Log in" action from `@epam/ai-dial-kit`, consuming `useOverlayExternalLogin`.
- [x] 3.2 Update `apps/chat/src/components/RequireAuth/RequireAuth.tsx`: call `useAuthRedirect({ disabled: Boolean(overlay) })`; when `status === AuthStatus.Unauthenticated` and `overlay` is defined, render `<OverlayLoginGate />` instead of `null`; outside overlay mode, keep rendering `null`.
- [x] 3.3 Add/update `apps/chat/src/components/RequireAuth/tests/RequireAuth.spec.tsx` covering non-overlay and overlay unauthenticated behavior.
- [x] 3.4 Add `apps/chat/src/components/OverlayLoginGate/tests/OverlayLoginGate.spec.tsx` covering rendering, disabled state, and retryable error states.

## 4. i18n

- [x] 4.1 Add enum members to `apps/chat/src/constants/translation-keys.ts` under `AuthI18nKeys`: `OverlayLoginTitle`, `OverlayLoginDescription`, `OverlayExternalLoginBlocked`, and `OverlayLoginTakingLonger`. Reuse `ButtonsI18nKeys.LogIn` for the button label.
- [x] 4.2 Add the corresponding English strings to `apps/chat/src/i18n/locales/en.json`.
- [x] 4.3 Verify every new string in `OverlayLoginGate` is looked up through enum members via `useTranslation()`.

## 5. Overlay Regression Check

- [x] 5.1 Add or extend a `libs/chat-overlay` test/assertion confirming the iframe `sandbox` attribute still includes `allow-popups` and `allow-popups-to-escape-sandbox`.
- [x] 5.2 Run `npm exec nx test @epam/ai-dial-chat-overlay` and `npm exec nx lint @epam/ai-dial-chat-overlay`.

## 6. Backend Cookie Policy

- [x] 6.1 Update `apps/chat-api/src/auth/cookies/cookie-options.ts` so secure overlay-capable deployments emit `SameSite=None; Secure` auth cookies while normal and insecure-local deployments keep `SameSite=Lax`.
- [x] 6.2 Keep local insecure overlay testing on `SameSite=Lax` instead of emitting browser-rejected `SameSite=None` without `Secure`.
- [x] 6.3 Add focused backend coverage for cookie option selection, config validation, and callback `Set-Cookie` headers.

## 7. Docs

- [x] 7.1 Update `docs/auth/auth-bff-encrypted-cookie.md` to describe the overlay external-auth flow and the `SameSite=None; Secure` cookie policy required for secure cross-site overlay embedding.

## 8. Final Verification

- [x] 8.1 Run `npm exec nx test @epam/chat -- useAuthRedirect useOverlayExternalLogin RequireAuth OverlayLoginGate Login`.
- [x] 8.2 Run `npm exec nx lint @epam/chat` and `npm exec nx build @epam/chat`.
- [x] 8.3 Run `npm exec nx test @epam/chat-api`, `npm exec nx lint @epam/chat-api`, and `npm exec nx build @epam/chat-api` for the backend cookie policy change.
