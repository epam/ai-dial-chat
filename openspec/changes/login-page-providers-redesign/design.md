## Context

`apps/chat/src/pages/auth/Login.tsx` is a Next.js-style page component mounted at the `/login` route. The page sits outside the authenticated shell; `useAuthRedirect` (from `apps/chat/src/hooks/auth/useAuthRedirect.ts`) redirects already-authenticated users away before anything is rendered. The BFF exposes `GET /api/v1/auth/providers` (via `authApi.listProviders()`) which returns `ProviderInfoDto[]` from `@epam/chat-api-client`, and `GET /api/v1/auth/login/{providerId}?callbackUrl=` which initiates the OAuth redirect — no changes to either BFF endpoint in this change. Theme state is provided by `useTheme()` from `apps/chat/src/context/ThemeContext.tsx`.

## Goals / Non-Goals

**Goals:**

- Branded, visually rich login page matching the Figma design
- Dynamic provider list from `authApi.listProviders()` with loading and error states
- Responsive layout: full-screen background on tablet/desktop, transparent card on mobile
- Theme-aware background images and favicon
- Per-provider SVG icons with two-stage fallback
- i18n for all visible strings; `callbackUrl` forwarding preserved

**Non-goals:** BFF auth endpoint changes, logout/session handling, provider CRUD, multi-language background image variants, animated transitions.

## Decisions

### D1 — `<picture>` element for responsive themed background

**Decision:** Use a single `<picture>` element with one `<source>` for `(min-width: 1920px)` and an `<img>` fallback for the 768-px asset. Theme (light/dark) is encoded in the filename via a `themeSlug` variable derived from `currentTheme`. The picture is hidden on mobile (`mobile:hidden`) where no background is shown.

**Rationale:** `<picture>` is the semantic HTML mechanism for art-direction breakpoints and avoids loading both resolutions. Encoding theme in the filename keeps the switch to a single conditional string with no JS image loading logic.

**Alternatives considered:**

- CSS `background-image` with media queries: would require the image paths in a `style` prop or Tailwind arbitrary values, losing semantic alt text and making theme switching more complex.
- Separate `<img>` elements toggled by CSS: loads both images; not art-direction-friendly.

### D2 — Semi-transparent card with `bg-blackout`

**Decision:** The card `div` applies `bg-blackout` unconditionally. Card is `rounded-xl p-16` on desktop and `rounded-none bg-transparent p-0` on mobile.

**Rationale:** The Figma design shows a frosted-glass panel over the background image. `bg-blackout` is an existing design-token class that provides the correct opacity. The mobile layout has no background image, so the card background must be transparent there.

**Alternatives considered:**

- Tailwind `backdrop-blur` on the card: requires the card to be above a visible background, which is not stable across all browsers for PNG backgrounds.
- Single `bg-blackout` + `opacity-*` on the background: loses independent control of card vs. background opacity.

### D3 — Provider anchor as `<a>` linking to BFF redirect endpoint

**Decision:** Each provider renders as:
```tsx
<a
  href={`/api/v1/auth/login/${encodeURIComponent(provider.id)}?callbackUrl=${encodeURIComponent(callbackUrl)}`}
  className="flex h-10 w-full items-center justify-center gap-2 rounded border border-primary px-3 text-sm font-semibold text-controls-neutral hover:bg-layer-3"
>
  <img src={`/auth-providers/${provider.id}.svg`} ... />
  {provider.label}
</a>
```

**Rationale:** A plain anchor performs a full navigation to the BFF redirect URL, which is the correct OAuth entry point. Using `<button>` + `router.push` or `window.location` would be semantically wrong and skip browser native link behaviour (middle-click to open in tab, etc.). `encodeURIComponent` on `provider.id` prevents path injection if an id ever contains a `/` or `?`.

**Alternatives considered:**

- `<button onClick={() => window.location.href = ...}`: loses native link semantics.
- `<Link>` from React Router: performs client-side navigation, which bypasses the BFF redirect.

### D4 — Two-stage icon fallback via `onError` handler

**Decision:** `handleIconError` is a module-level function (not a hook) that:
1. On first error (`img.dataset.fallback !== 'true'`): sets `img.src = '/auth-providers/keycloak.svg'` and marks `dataset.fallback = 'true'`.
2. On second error: sets `img.style.display = 'none'`.

**Rationale:** Provider icons are optional decoration; missing an SVG must not break the button. Keycloak is the most common fallback provider in DIAL deployments. The `dataset` flag avoids an infinite error loop if the fallback itself is missing.

**Alternatives considered:**

- React state for icon error: would require per-provider state, complicating the `renderProviders` helper and causing re-renders.
- CSS `onerror` inline attribute: not recommended in React.

### D5 — `renderProviders` as a module-level helper function

**Decision:** The provider list markup is extracted into a `const renderProviders = (providers, callbackUrl, signInLabel) => JSX.Element` function at module scope, not a component.

**Rationale:** The function has no hooks and is called only from one place with three stable arguments. Keeping it as a render helper avoids a needless component boundary and keeps the component tree flat.

**Alternatives considered:**

- Inline JSX in the component body: would make `LoginPage` harder to read.
- Separate `ProviderList` component: adds a file for what is currently a single-use, hook-free fragment.

### D6 — Provider data: API-driven with hardcoded stub during development

**Decision:** `loadProviders` calls `getProviders()` (which calls `authApi.listProviders()`). During the development phase the returned `data` is replaced by a hardcoded list so the UI can be built and reviewed independently of the BFF endpoint being ready. The real API wiring (`setProviders(data)`) must be restored before merge.

**Rationale:** Decouples UI development from backend availability while preserving the API integration path in the code. The commented-out line `// if (!signal.isCancelled) setProviders(data);` is the exact line that must be uncommented to complete the integration.

### D7 — `callbackUrl` from search params with origin fallback

**Decision:** Read `callbackUrl` from `searchParams.get('callbackUrl')`; fall back to `${window.location.origin}/` when absent.

**Rationale:** The app router may append a `callbackUrl` when redirecting unauthenticated users to `/login`. The fallback ensures a valid post-login destination in direct navigation scenarios.

### D8 — Tailwind breakpoints: `mobile` (max-width), `tablet` (min-width 769px), `desktop` (min-width 1920px)

**Decision:** Three breakpoints are added/adjusted in `tailwind.config.js`:
- `mobile`: `{ max: '768px' }` — max-width, so `mobile:` prefixes apply at ≤768 px
- `tablet`: `{ min: '769px' }` — min-width baseline
- `desktop`: `{ min: '1920px' }` — large-screen override (bumped from previous 769 px)

**Rationale:** The login page Figma design has three distinct layouts: full-mobile (≤768 px), tablet/mid-desktop (769–1919 px), and large-desktop (≥1920 px). The existing `desktop` breakpoint at 769 px conflated all non-mobile sizes, making the 1920-px art-direction impossible without a new breakpoint.

## Risks / Trade-offs

- **Hardcoded provider list** — the branch currently ignores the API response and uses a hardcoded stub. Shipping this to production would prevent dynamic provider configuration. This is explicitly tracked as a task.
- **Background image file size** — each PNG is ~1–2 MB. They are served as static assets; consider adding HTTP caching headers (`Cache-Control: public, max-age=31536000, immutable`) at the hosting layer to avoid repeated downloads.
- **`console.error` in catch block** — violates the project convention of not using `console.*` in production code. Must be removed before merge.
- **`mobile:` breakpoint is max-width** — `mobile:` is the only max-width breakpoint in the project. This is intentional (mobile-first: `mobile:` overrides the base style for small screens) but is the inverse of the other breakpoints. Developers adding classes to this file must be aware of the direction.

## Open Questions

_(none — API path, fallback strategy, and breakpoint values are confirmed above)_
