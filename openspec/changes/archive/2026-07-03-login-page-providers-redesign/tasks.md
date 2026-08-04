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
  - Full-screen container (`relative flex min-h-screen items-center justify-center overflow-hidden bg-layer-2 mobile:bg-layer-raised mobile:px-6`)
  - `<picture>` element with `(min-width: 1920px)` source and 768-px fallback `<img>`; hidden on mobile (`mobile:hidden`)
  - Card: `bg-overlay`; mobile: `bg-transparent rounded-none p-0`
  - Theme favicon span (rendered when `currentThemeFavicon` is set)
  - `<h1>` with `t(AuthI18nKeys.LoginTitle)`; responsive font size (`text-[28px] mobile:text-[22px]`)
  - Loading state: `<p>{t(AuthI18nKeys.Loading)}</p>` while `providers === null && !hasError`
  - Error state: `<p>{t(AuthI18nKeys.ProvidersError)}</p>` when `hasError`
  - Provider list via `renderProviders()` helper once `providers` is loaded
- [x] 3.2 Add module-level `handleIconError` — single-stage fallback: hides the image element on load error (`style.display = 'none'`); icons are loaded from the Auth.js CDN (`https://authjs.dev/img/providers/{id}.svg`) so a local fallback file is not needed
- [x] 3.3 Add module-level `renderProviders(providers, callbackUrl, signInLabel)` — renders sign-in label paragraph and vertical stack of `NeutralButton` buttons (from `@epam/ai-dial-kit`) with provider SVG icons; navigation is via `window.location.href`

## 4. Login Page — API Integration (slice 2)

- [x] 4.1 In `loadProviders`, replace the hardcoded stub with the real API response: `setProviders(data)` is called directly; no hardcoded stub remains
- [x] 4.2 Remove `console.error(err)` from the catch block in `loadProviders` — removed; error is handled by `setHasError(true)`

## 5. Tests (slice 3)

- [x] 5.1 Fix test setup: `React.act is not a function` fixed by adding `env: { NODE_ENV: 'test' }` to the `test` block in `apps/chat/vite.config.mts`; all 6 tests pass
- [x] 5.2 Tests updated to use `findByRole('button')` (providers render as `NeutralButton`, not `<a>`); navigation verified via `vi.stubGlobal('location', ...)` and `userEvent.click()`
- [x] 5.3 Test added: `renders loading state while providers are loading` — asserts `AuthI18nKeys.Loading` key is visible
- [x] 5.4 Test added: `renders error message when getProviders rejects` — asserts `AuthI18nKeys.ProvidersError` key is visible
- [x] 5.5 Test added: `renders theme favicon when currentThemeFavicon is set` — asserts favicon element present and style contains the path

## 6. ESLint in Login.tsx

- [x] 6.1 No unused vars — `data` is used via `setProviders(data)` once 4.1 was completed
- [x] 6.2 `aria-hidden="true"` moved to the wrapping `<div>`; `<picture>` element itself carries no ARIA attributes

## 7. Verification

- [x] 7.1 All 6 Login.spec.tsx tests pass (`npx vitest run` in `apps/chat/`)
- [x] 7.2 `npx eslint apps/chat/src/pages/auth/Login.tsx apps/chat/src/pages/auth/Login.spec.tsx` — no errors; repo-wide `nx lint chat` has pre-existing failures in unrelated libs unaffected by this change
- [x] 7.3 TypeScript in `Login.tsx` and `Login.spec.tsx` is error-free; repo-wide `nx typecheck` has pre-existing failures in unrelated libs
- [ ] 7.4 Manual smoke test: start dev server, navigate to `/login`, verify provider buttons appear, each button navigates to the correct BFF URL, background image loads, mobile layout is transparent
