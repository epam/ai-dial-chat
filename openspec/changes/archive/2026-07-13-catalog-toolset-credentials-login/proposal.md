## Why

Toolset credential management (API key / OAuth login, logout, and credential-status visibility) only existed inside the Toolset Editor's `AuthSection`, hardcoded to the current user's own (`USER`-level) credentials. Users browsing the Catalog could not authenticate a toolset (API key or OAuth) or see whether it was already authenticated at all — the Details Panel was read-only for auth, only surfacing "Sign-in status" as inert text. Admins on public toolsets also had no way to set organization-wide (`GLOBAL`) credentials outside the Editor, and there was no visibility into a toolset's credential status from the Catalog grid.

**Scope history**: the initial version of this change intentionally scoped down to `USER`-level login/logout only, deferring the admin/`GLOBAL` flow and card badges based on two conclusions reached during planning: (a) no `isAdmin` signal existed on the frontend, and (b) the toolset list endpoint appeared to lack auth-status fields. Both conclusions were revisited during this parity pass and found to be **wrong or incomplete**: `DialToolsetDto.authSettings` (returned by both the list and single-item toolset endpoints) already includes `userLevelAuthStatus` and `globalAuthStatus`, and a computed `isAdmin` signal was straightforward to add to the existing `GET /api/v1/auth/me` response from the provider's already-existing `adminRoles` config. This proposal now brings the Catalog toolset credentials UX to **full parity** with the legacy Marketplace flow (branch `development`), superseding the USER-only scope.

## What Changes

- **Admin + public "Manage credentials"**: an admin viewing a public toolset sees a "Manage credentials" action that expands two independent sections — "My credentials" (`USER`) and "Entire organization credentials" (`GLOBAL`) — each with its own status, login form, and logout confirmation.
- **Non-admin / non-public behavior**: mirrors the legacy `getToolsetAuthAction` decision tree —
  - a non-admin on a **public** toolset who is not personally signed in sees "Login with my creds" (`USER` level);
  - otherwise, a signed-out toolset shows "Log in" (`GLOBAL` level, the legacy default for a single-form regular user);
  - a toolset signed in at any applicable level shows "Log out", scoped to whichever level is active.
- **Signed-in detection uses both levels**: "signed in" is true if either `USER` or `GLOBAL` is `SIGNED_IN`, matching legacy `isToolsetSignedIn` semantics — fixes a bug where a user with only organization-wide credentials appeared signed out.
- **Card and list credential badge**: toolset cards (grid) and rows (list view) show a LOGGED OUT badge when not signed in at any applicable level; no badge is shown when signed in (at `USER` and/or `GLOBAL` level) — deliberately simpler than legacy `CredentialsStatusIndicator`, which also distinguished MY CREDS/ORG CREDS states.
- **API key field hint**: the inline API-key input shows `Enter your API key value for "{header}" header`, naming the toolset's configured key header.
- **Success and error notifications**: login/logout show a success toast (title + name/version message, with an organization-wide variant for admin+public `GLOBAL` actions) in addition to the existing error toast.
- **List refresh after login/logout**: `refetchToolsets()` is called after every API-key login/logout so card/list badges update immediately, in addition to the existing panel re-fetch.
- **OAuth improvements**: `code_challenge`/`code_challenge_method` (if configured on the toolset) are forwarded to the authorize URL; a toolset whose credentials are in a `FAILED` state at the target level is signed out before a fresh login is attempted (mirrors the legacy pre-signout guard). OAuth still opens the provider in a new browser window/tab (unchanged from the prior iteration) with manual-only refresh after the popup closes.
- Toolsets with `authenticationType: NONE` show no login UI or badge, at any admin/public combination.

### Non-Goals

- No backend changes to the login/logout endpoints or DTOs themselves — only a new computed `isAdmin` field on `GET /api/v1/auth/me`.
- No cross-window auto-refresh/polling after the OAuth popup closes — still manual-only, per the prior decision; only the synchronous API-key path calls `refetchToolsets()`.
- No changes to publication credentials or toolset sharing.
- No toolset version selector in the panel.

## Capabilities

### New Capabilities

- `catalog-toolset-credentials`: full-parity login/logout/manage-credentials UI inside the Catalog Details Panel for toolsets — admin+public two-level accordion, non-admin single-level flow with `USER`/`GLOBAL` resolution matching legacy, logout confirmation, in-panel status, API-key hint, success/error notifications, a simplified LOGGED-OUT-only card/list badge, and list refresh after login/logout.

### Modified Capabilities

- `toolset-authentication`: the OAuth redirect/callback requirement's `credentialsLevel` is caller-supplied (`USER` for the Editor; `USER` or `GLOBAL` for the Catalog) rather than hardcoded to `USER`; the authorize URL now forwards `code_challenge`/`code_challenge_method` when configured; a `FAILED` credential state at the target level is cleared via sign-out before a new login attempt. The OAuth navigation mechanism (new window/tab, popup closes on completion) is unchanged from the prior iteration.

## Impact

- **`apps/chat-api`**: `AuthController.getCurrentUser` gains a computed `isAdmin: boolean` (provider `adminRoles` ∩ the user's roles claim); `UserProfileDto` gains the corresponding field. Regenerated OpenAPI client (`libs/chat-api-client`).
- **`libs/chat-shared`**: `UserProfile` gains `isAdmin: boolean`.
- **`libs/catalog`**: `CatalogItemCredentials` gains `userStatus`, `globalStatus` (replacing the single `status` field), `isPublic`, `isManageableByAdmin`, `apiKeyHeader`; new `CredentialsLevel`/`CredentialsUiState`/`CredentialsBadgeState` enums and pure decision helpers (`getCredentialsUiState`, `getCredentialsBadgeState`, `getSignedInLevel`); `CredentialsBadgeState` has a single `LoggedOut` member — `getCredentialsBadgeState` returns it only when signed out at every level, `undefined` otherwise (no MY CREDS/ORG CREDS badge states); `onLogin`/`onLogout` now carry an explicit `level: CredentialsLevel` parameter; `CredentialsSection` renders a two-level `Accordion` UI for admin+public; new `CredentialsBadge` component (LOGGED OUT only) wired into `Card` (grid) and `NameCellRenderer` (list). All additive/optional except the `status` → `userStatus`/`globalStatus` rename on `CatalogItemCredentials`, an internal-to-this-change type not yet consumed elsewhere.
- **`apps/chat`**: new `isPublicToolsetId` helper (`utils/toolsets.ts`); `mapToolsetCredentials` (both the list-mapper and the details-mapper variants) now take `isAdmin` and compute the full credential shape; `CatalogView.tsx` resolves `isAdmin` via `useUser()`, threads the caller-supplied `level` through to `loginToolset`/`logoutToolset`, shows success/error notifications, and calls `refetchToolsets()` after login/logout; `initiateOAuthLogin`/`buildToolsetAuthorizeUrl` take an explicit `credentialsLevel` and forward `code_challenge`/`code_challenge_method`.
- **i18n**: new keys in `translation-keys.ts` and `en.json` for admin/public labels, badges, and success/error messages (`ar.json` does not exist on this branch).
