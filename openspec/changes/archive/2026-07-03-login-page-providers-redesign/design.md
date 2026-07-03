## Context

`apps/chat/src/pages/auth/Login.tsx` is a Next.js-style page component mounted at the `/login` route. The page sits outside the authenticated shell; `useAuthRedirect` (from `apps/chat/src/hooks/auth/useAuthRedirect.ts`) redirects already-authenticated users away before anything is rendered. The BFF exposes `GET /api/v1/auth/providers` (via `authApi.listProviders()`) which returns `ProviderInfoDto[]` from `@epam/chat-api-client`, and `GET /api/v1/auth/login/{providerId}?callbackUrl=` which initiates the OAuth redirect — no changes to either BFF endpoint in this change. Theme state is provided by `useTheme()` from `apps/chat/src/context/ThemeContext.tsx`.

## Goals / Non-Goals

**Goals:**

- Branded, visually rich login page matching the Figma design
- Dynamic provider list from `authApi.listProviders()` with loading and error states
- Responsive layout: full-screen background on desktop, transparent card on mobile
- Theme favicon shown when configured; single background image set (no light/dark variants)
- Per-provider SVG icons loaded from the Auth.js CDN with hide-on-error fallback
- i18n for all visible strings; `callbackUrl` forwarding preserved

**Non-goals:** BFF auth endpoint changes, logout/session handling, provider CRUD, theme-variant background images, animated transitions.

## Decisions

### D1 — `<picture>` element for responsive background; no theme variants

**Decision:** Use a single `<picture>` element with one `<source>` for `(min-width: 1920px)` (`/1920_login.png`) and an `<img>` fallback for the 768-px asset (`/768_login.png`). The picture is hidden on mobile (`mobile:hidden`) where no background is shown. No light/dark theme variants — a single image pair is served regardless of active theme.

**Rationale:** `<picture>` is the semantic HTML mechanism for art-direction breakpoints and avoids loading both resolutions. Providing theme variants would double the asset count and require runtime theme-to-filename mapping; the design does not require it.

**Alternatives considered:**

- Theme-encoded filenames (`768_login_light.png`, `768_login_dark.png`): doubles asset count, adds a JS conditional for the filename — rejected as over-engineering for the current design.
- CSS `background-image` with media queries: loses semantic alt text and makes art-direction more complex.
- Separate `<img>` elements toggled by CSS: loads both resolutions simultaneously.

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

### D4 — Provider icons loaded from the Auth.js CDN (`authjs.dev`)

**Decision:** Provider icons are loaded at runtime from `https://authjs.dev/img/providers/{id}.svg`. The `id` has trailing digits stripped (`/[1-9]\d*$/`) to normalize versioned provider IDs (e.g. `azure-ad2` → `azure-ad`). A single-stage `handleIconError` handler hides the image element if the URL fails to load (`e.currentTarget.style.display = 'none'`).

**Why `authjs.dev` is acceptable:**
Auth.js (formerly NextAuth.js) is the de-facto open-source OAuth/OIDC library for JavaScript. Its CDN at `authjs.dev/img/providers/` is the canonical public source of OAuth provider SVG icons, used in Auth.js's own documentation and referenced by a large number of open-source projects. The icons cover all common OIDC providers (Keycloak, Auth0, Azure AD, Okta, Cognito, Google, GitLab, etc.) and the URL scheme is stable.

**Rationale:** Hosting provider icons in the repository creates a maintenance burden (keeping icons current, adding new providers, correct licensing per icon). The Auth.js CDN is maintained by the Auth.js team and always reflects the current set of providers. Icons are optional decoration — the button functions correctly without them, so a CDN dependency for a non-critical asset is acceptable.

**Alternatives considered:**

- Bundled SVG icons in `apps/chat/public/auth-providers/`: requires manual updates per provider, per icon design change. Removed in favour of the CDN approach.
- React state for icon error: would require per-provider state, complicating the `renderProviders` helper and causing re-renders on error.
- Two-stage fallback (error → keycloak.svg → hide): adds complexity for no clear gain; hiding the missing icon is sufficient.

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

### D8 — Tailwind breakpoints: `mobile` (max-width 768px) and `desktop` (min-width 769px)

**Decision:** The project uses two named breakpoints in `tailwind.config.js`, unchanged by this feature:
- `mobile`: `{ max: '768px' }` — applies at ≤768 px (the only max-width breakpoint)
- `desktop`: `{ min: '769px' }` — applies at ≥769 px (all non-mobile sizes)

Art-direction between 769–1919 px and ≥1920 px is handled purely via the `<picture>` / `<source media="(min-width: 1920px)">` element without a separate Tailwind breakpoint.

**Rationale:** The project deliberately keeps a two-breakpoint vocabulary (`mobile` / `desktop`) to keep responsive code simple. `desktop:` means "not mobile" — it does not imply a minimum of 1920 px. Adding a `tablet` breakpoint was considered and explicitly rejected to avoid a three-tier breakpoint proliferation across unrelated components.

## Risks / Trade-offs

- **Hardcoded provider list** — the branch currently ignores the API response and uses a hardcoded stub. Shipping this to production would prevent dynamic provider configuration. This is explicitly tracked as a task.
- **Background image file size** — each PNG is ~1–2 MB. They are served as static assets; consider adding HTTP caching headers (`Cache-Control: public, max-age=31536000, immutable`) at the hosting layer to avoid repeated downloads.
- **`console.error` in catch block** — violates the project convention of not using `console.*` in production code. Must be removed before merge.
- **`mobile:` breakpoint is max-width** — `mobile:` is the only max-width breakpoint in the project. This is intentional (mobile-first: `mobile:` overrides the base style for small screens) but is the inverse of the other breakpoints. Developers adding classes to this file must be aware of the direction.

## Open Questions

_(none — API path, fallback strategy, and breakpoint values are confirmed above)_
