## Why

The existing login page was a minimal, unstyled form with no visual branding and no support for multiple identity providers. Users had no clear orientation about which application they were logging into, and the page could not surface multiple sign-in options (Keycloak, Auth0, Azure AD B2C, Okta, Google, GitLab, Cognito, etc.) when the deployment exposes more than one OIDC provider. This change replaces it with a branded, fully responsive page that dynamically renders the available providers from the BFF, aligning with the Figma design in [DIAL-Chat — Login & System Pages](https://www.figma.com/design/lanGLcbM14QxEPWEqYIdN8/DIAL-Chat--Login---System-Pages?node-id=1-1351) and resolving [#7021](https://github.com/epam/ai-dial-chat/issues/7021).

## What Changes

- **Full-screen themed background**: Two sets of static images (`768_login_*`, `1920_login_*`) for light and dark themes, served via a `<picture>` element with a `(min-width: 1920px)` media query; hidden on mobile where the card is transparent.
- **Branded card**: Semi-transparent, rounded card centered on the page. Uses `bg-blackout`. Shows the theme favicon at the top when configured. Hidden background and transparent layout on mobile.
- **Dynamic provider list**: Fetches `ProviderInfoDto[]` from `GET /api/v1/auth/providers` (via `authApi.listProviders()`) on mount. Each provider renders as a full-width button navigating to `/api/v1/auth/login/{providerId}?callbackUrl=...`.
- **Provider icons**: SVG icons loaded from the `authjs.dev` CDN (`https://authjs.dev/img/providers/{id}.svg`); hidden on load error.
- **Loading and error states**: Shows a loading message while the providers request is in-flight; shows an error message if the request fails.
- **New i18n keys**: `auth.loginTitle`, `auth.loginDescription`, `auth.loading`, `auth.providersError`, `auth.providerButtonLabel` added to `AuthI18nKeys` and `en.json`.

**Non-goals**: changes to the BFF `auth` endpoints, logout flow, session handling, provider CRUD, or any page other than the login page.

## Capabilities

### New Capabilities

- `login-page-redesign`: Branded, full-screen login page with responsive layout, themed background images, and a card containing the theme favicon and page title.
- `provider-listing-on-login`: Dynamically fetches and renders available identity providers as sign-in buttons, each linking to the BFF OAuth redirect endpoint with the correct `callbackUrl`.

### Modified Capabilities

- `login-page`: Previously a plain form; replaced entirely by the new branded layout. The `callbackUrl` forwarding contract (`/api/v1/auth/login/{id}?callbackUrl=`) is preserved.

## Impact

- **Modified**: `apps/chat/src/pages/auth/Login.tsx` — full rewrite
- **Added**: `apps/chat/src/pages/auth/Login.spec.tsx` — test suite
- **Added**: `apps/chat/public/1920_login_dark mode.png`, `apps/chat/public/1920_login_light mode.png` — large-screen background images
- **Added**: `apps/chat/public/768_login_dark mode.png`, `apps/chat/public/768_login_light mode.png` — mid-size background images
- **Added**: `apps/chat/public/auth-providers/` — SVG icons for `auth0`, `azure-ad`, `azure-ad-b2c`, `cognito`, `dialx-entra`, `gitlab`, `google`, `keycloak`, `okta`
- **Modified**: `apps/chat/src/constants/translation-keys.ts` — `AuthI18nKeys` extended with `LoginTitle`, `LoginDescription`, `Loading`, `ProviderButtonLabel`, `ProvidersError`
- **Modified**: `apps/chat/src/i18n/locales/en.json` — matching English strings
- **Rollback**: revert `Login.tsx`, remove public assets, revert translation keys; no database or API contract changes
