## Context

The navigation sidebar (`apps/chat/src/components/Navigation/Navigation.tsx`) renders a `UserMenu` component at the bottom. Currently `UserMenu` shows only an avatar with a tooltip. There is no way to access settings or log out from the UI. The theme system is already fully wired (`useTheme()` in `ThemeContext.tsx`), and the logout endpoint (`POST /api/v1/auth/logout`) exists and performs a 302 redirect. This change wires those capabilities to a user-facing menu.

## Goals / Non-Goals

**Goals:**
- Avatar becomes a dropdown trigger (`DialDropdown`, `placement="top-end"`) opening above and to the right
- Menu shows: user identity header (avatar + name/email), Settings item, Log out item
- Settings modal (`DialPopup`) lets the user pick a theme via `DialSelect`; selection is immediate (no Save button needed — `setTheme` is synchronous/localStorage-backed)
- Logout confirmation modal (`DialPopup`) with Cancel / Log out buttons; confirm navigates to `ApiEndpoints.AUTH_LOGOUT` via `window.location.href`
- All UI text goes through i18n

**Non-Goals:**
- No new backend endpoints
- No changes to the theme backend or `ThemeContext` internals
- No other settings fields beyond theme in this iteration
- No mobile-specific layout divergence (same dropdown works on mobile via the existing portal drawer)

## Decisions

### D1: `DialDropdown` + `placement="top-end"` over a custom popover
The existing codebase uses `DialDropdown` for all dropdown menus (e.g. `libs/conversation-input`). Using it keeps visual and behavioral consistency (keyboard nav, outside-click close, focus trap). `placement="top-end"` positions the menu above and to the right of the avatar, away from the screen edge.

### D2: Logout via `window.location.href` (not fetch)
The `/api/v1/auth/logout` endpoint returns a 302. `fetch` follows redirects silently and cannot hand off to the IdP end-session page. `window.location.href` triggers a full browser navigation, correctly landing on the IdP logout flow. No CSRF token is needed for a GET-style navigation redirect.

### D3: Theme applies on Confirm, not immediately on selection
`SettingsModal` holds a `pendingTheme` local state initialised to `currentTheme` on open. `setTheme` is called only when the user confirms. This avoids a visible flash if the user changes their mind before confirming, and is consistent with the confirmation-step UX used for other destructive or non-trivial settings changes. The modal uses `DialConfirmationPopup` with `confirmLabel` from `settings.apply`.

### D4: Two separate modal components (`SettingsModal`, `LogoutConfirmationModal`)
Each modal has distinct props, state, and trigger paths. Co-locating them inside `UserMenu` would bloat it. Separate files (`apps/chat/src/components/Settings/SettingsModal.tsx`, `apps/chat/src/components/LogoutConfirmation/LogoutConfirmationModal.tsx`) follow the project's `{ComponentName}/{ComponentName}.tsx` convention and keep each unit independently testable.

### D5: `DialSelect` for theme picker (not radio buttons)
The themes list is dynamic (loaded from the backend via `useTheme().themes`). `DialSelect` handles a variable-length options list naturally. `DialRadioGroup` is better suited for a small, static, labeled set.

## Risks / Trade-offs

- **Theme list loading race** → `useTheme().isLoading` is `true` while themes load. The `DialSelect` should be `disabled` when `isLoading` is true to prevent interaction before options are ready.
- **Logout redirect in dev proxy** → In local dev, `window.location.href = '/api/v1/auth/logout'` proxies to `localhost:5000`. The redirect target (IdP or `/`) must be reachable from the browser; no special handling needed.
- **`top-end` overflow on narrow viewports** → Floating UI (used by `DialDropdown`) has `flip` middleware by default, so the menu will reposition if there is not enough space above. Acceptable fallback.
