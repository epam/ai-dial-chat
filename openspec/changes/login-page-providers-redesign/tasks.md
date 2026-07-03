## 1. Static Assets

- [x] 1.1 Add `apps/chat/public/1920_login_dark mode.png` and `apps/chat/public/1920_login_light mode.png` — large-screen background images
- [x] 1.2 Add `apps/chat/public/768_login_dark mode.png` and `apps/chat/public/768_login_light mode.png` — mid-size background images

## 2. i18n & Translation Keys

- [x] 2.1 Add `LoginTitle`, `LoginDescription`, `Loading`, `ProviderButtonLabel`, `ProvidersError` to `AuthI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`
- [x] 2.2 Add matching English strings to `apps/chat/src/i18n/locales/en.json`:
  - `auth.loginTitle` → `"Welcome to DIAL Chat"`
  - `auth.loginDescription` → `"Sign in with:"`
  - `auth.loading` → `"Checking your session…"`
  - `auth.providersError` → `"Could not load identity providers. Please retry."`
  - `auth.providerButtonLabel` → `"Sign in with {{provider}}"`

## 3. Login Page — UI (slice 1)

- [x] 3.1 Rewrite `apps/chat/src/pages/auth/Login.tsx`:
  - Full-screen container (`relative flex min-h-screen items-center justify-center overflow-hidden bg-layer-2 mobile:bg-layer-0 mobile:px-6`)
  - `<picture>` element with `(min-width: 1920px)` source and 768-px fallback `<img>`; hidden on mobile (`mobile:hidden`)
  - Card: `bg-blackout`; mobile: `bg-transparent rounded-none p-0`
  - Theme favicon span (rendered when `currentThemeFavicon` is set)
  - `<h1>` with `t(AuthI18nKeys.LoginTitle)`; responsive font size (`text-[28px] mobile:text-[22px]`)
  - Loading state: `<p>{t(AuthI18nKeys.Loading)}</p>` while `providers === null && !hasError`
  - Error state: `<p>{t(AuthI18nKeys.ProvidersError)}</p>` when `hasError`
  - Provider list via `renderProviders()` helper once `providers` is loaded
- [x] 3.2 Add module-level `handleIconError` — single-stage fallback: hides the image element on load error (`style.display = 'none'`); icons are loaded from the Auth.js CDN (`https://authjs.dev/img/providers/{id}.svg`) so a local fallback file is not needed
- [x] 3.3 Add module-level `renderProviders(providers, callbackUrl, signInLabel)` — renders sign-in label paragraph and vertical stack of `NeutralButton` buttons (from `@epam/ai-dial-kit`) with provider SVG icons; navigation is via `window.location.href`

## 4. Login Page — API Integration (slice 2)

- [ ] 4.1 In `loadProviders`, replace the hardcoded stub with the real API response: uncomment `if (!signal.isCancelled) setProviders(data);` and remove the hardcoded `setProviders([...])` call (lines 69–79 in `Login.tsx`)
- [ ] 4.2 Remove `console.error(err)` from the catch block in `loadProviders` — the error is already handled by setting `hasError`; logging to console is not appropriate in production code

## 5. Tests (slice 3)

- [ ] 5.1 Fix test setup: both existing tests fail with `TypeError: React.act is not a function` — `@testing-library/react` version mismatch with the installed React. Add `useTheme` mock (`vi.mock('../../context/ThemeContext')`) and ensure the test environment resolves the correct React version.
- [ ] 5.2 Fix existing aria-label query: `getByRole('link', { name: AuthI18nKeys.ProviderButtonLabel })` matches the raw key string, not the rendered label. The `<a>` accessible name is `provider.label` (e.g. `"Keycloak"`). Replace with `getByRole('link', { name: /keycloak/i })` or the provider label string directly.
- [ ] 5.3 Add test: `renders loading state while providers are loading` — mock `getProviders` with a never-resolving promise, assert the loading message is shown
- [ ] 5.4 Add test: `renders error message when getProviders rejects` — mock `getProviders` to reject, assert the error string is rendered
- [ ] 5.5 Add test: `renders theme favicon when currentThemeFavicon is set` — mock `useTheme` to return a favicon URL, assert the favicon span is present in the DOM

## 6. ESLint Warnings in Login.tsx

- [ ] 6.1 Fix `@typescript-eslint/no-unused-vars` on `data` (line 68) — will be resolved automatically once task 4.1 wires the real API response (`data` becomes used via `setProviders(data)`)
- [ ] 6.2 Fix `jsx-a11y/aria-unsupported-elements` on `<picture aria-hidden="true">` (line 101) — `<picture>` does not support ARIA attributes; move `aria-hidden` to a wrapping `<div>` or remove it (the `<img>` inside already has `alt=""` and the element is decorative)

## 7. Verification

- [ ] 7.1 `npm exec nx test chat` — all Login.spec.tsx tests pass
- [ ] 7.2 `npm exec nx lint chat` — no lint errors
- [ ] 7.3 `npm exec nx typecheck chat` — no type errors
- [ ] 7.4 Manual smoke test: start dev server, navigate to `/login`, verify provider buttons appear, each button links to the correct BFF URL, background image loads for both themes, mobile layout is transparent
