## Context

Toolset credential management previously existed only in the Toolset Editor (`apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx`): a self-contained, parent-controlled component (`auth` state + `onAuthChange` patch callback, no react-hook-form, no Redux) that calls `loginToolset`/`logoutToolset` (`server-api/toolsets.ts`) directly, always at `credentialsLevel: ToolsetCredentialsLevel.User`. OAuth goes through `initiateOAuthLogin` → `sessionStorage`-persisted `ToolsetRedirectState` → provider redirect → `ToolsetEditorCallback.tsx` → `loginToolset` with the returned `code`. A prior iteration of this change ported a `USER`-level-only subset of this to the Catalog Details Panel and switched OAuth navigation from a same-tab redirect to a new browser window/tab (see "Corrected conclusions" below and Decision 6).

**Corrected conclusions from the prior iteration.** That iteration scoped down to `USER`-level-only based on two conclusions that turned out to be wrong or incomplete once re-checked against the actual generated API client and backend:
1. *"No `isAdmin` resolution exists anywhere in `apps/chat`."* True at the time, but the fix is small: the provider config already has an `adminRoles: string[]` field (`apps/chat-api/src/auth/providers/provider.types.ts`) that was simply never read. `AuthController.getCurrentUser` now computes `isAdmin` per-request from `adminRoles` ∩ the user's roles claim (`user.claims[rolesClaim]`), added to `UserProfileDto` and the shared `UserProfile` type.
2. *"The toolset list endpoint has no auth-status fields."* This was based on a stale reading of the generated client. `DialToolsetDto.authSettings` (`DialToolsetAuthSettingsDto`, returned by both `GET /toolsets` and `GET /toolsets/:name`) already includes `userLevelAuthStatus` and `globalAuthStatus` — confirmed by reading `libs/chat-api-client/src/generated/src/models/index.ts` directly rather than trusting the earlier research summary. Card/list badges are therefore a pure mapping change with no new network request.

With both blockers resolved, this iteration ports the remaining legacy Marketplace behavior: admin+public "Manage credentials" with two levels, the `getToolsetAuthAction` decision tree, card/list badges, success notifications, list refresh, and the `code_challenge`/FAILED-presignout OAuth details.

The Catalog Details Panel (`libs/catalog/src/components/Details/DetailsPanel.tsx` + `Header/Header.tsx`) and the credentials plumbing already established in the prior iteration (`CredentialsSection`, `Header` trigger button, `onFetchDetails`-based refresh) are extended in place rather than replaced.

## Goals / Non-Goals

**Goals:**
- Match the legacy Marketplace's four-state credentials action: `ManageCredentials` (admin+public), `LoginWithMyCreds` (non-admin, public, not signed in at `USER`), `LogIn` (signed out everywhere else, `GLOBAL` level), `LogOut` (signed in at either level).
- Treat "signed in" as `USER` **or** `GLOBAL` being `SIGNED_IN`, everywhere that matters (header label, badge, logout target).
- Show a card/list credential badge: LOGGED OUT when not signed in at any applicable level; no badge when signed in — deliberately simpler than legacy's LOGGED OUT/MY CREDS/ORG CREDS distinction, per explicit product decision.
- Show success and error notifications after login/logout, and refresh the toolset list (`refetchToolsets()`) in addition to the panel.
- Keep `libs/catalog` free of API clients, auth, and routing knowledge — all admin/public/level resolution happens in `apps/chat` mappers; the lib only receives plain data and callback props.
- Forward `code_challenge`/`code_challenge_method` when configured, and clear a `FAILED` credential state before a fresh login, matching legacy epic behavior.

**Non-Goals:**
- No changes to the backend login/logout endpoints or DTOs (only a new computed `isAdmin` field on the existing `/auth/me` response).
- No cross-window auto-refresh/polling after the OAuth popup closes — still manual-only (unchanged from the prior iteration).
- No publication-credentials or toolset-sharing changes.
- No toolset version selector in the panel.
- No Redux/epics — stays consistent with the rest of `development-1.0` (React hooks + `server-api`).

## Decisions

### 1. Credentials UI stays a lib component below `Header`, extended with an admin accordion (carried over)

`libs/catalog/src/components/Details/Credentials/CredentialsSection.tsx` (rendered by `DetailsPanel.tsx`) now branches on `credentials.isManageableByAdmin`: when true, it renders two `Accordion` sections ("My credentials" / "Entire organization credentials"), each with an independent `LevelForm` (status, API-key/OAuth input, logout confirm) bound to `USER`/`GLOBAL` respectively; when false, it renders a single `LevelForm` at the level resolved by `getCredentialsUiState` (see Decision 4).
- **Why**: keeps the two-level admin case visually and structurally close to the legacy `ToolsetLoginDialog`'s `credsTabs` accordion, without introducing a modal.
- **Alternative considered**: two separate top-level toggle buttons (one per level) instead of one "Manage credentials" trigger + accordion. Rejected — the legacy UX (and the acceptance criteria) expects one entry point, matching `LoginButton.tsx`'s `isOrganizationView` gate.

### 2. `CatalogItemCredentials` gains dual status, public/admin flags, and the API-key header hint

```ts
interface CatalogItemCredentials {
  authenticationType: ToolsetAuthenticationType;
  userStatus?: CredentialStatus;
  globalStatus?: CredentialStatus;
  isPublic?: boolean;
  isManageableByAdmin?: boolean;
  apiKeyHeader?: string;
}
```
This replaces the prior iteration's single `status` field. `libs/catalog` still never imports app-owned DTOs or enums — `isPublic`/`isManageableByAdmin` are plain booleans the app mapper resolves once (from `isPublicToolsetId` + the caller-supplied `isAdmin`), and `apiKeyHeader` is a plain string passed straight through for the hint text.
- **Why**: dual status is required to fix the "signed in via `GLOBAL` only" bug and to support the admin accordion; `isPublic`/`isManageableByAdmin` let the lib pick the right UI state without knowing *why* (no admin/public domain concepts inside `libs/catalog`).
- **Alternative considered**: keep `status` as a single field and add a separate `level` indicator. Rejected — the admin accordion needs both levels' status simultaneously, not just "the" status.

### 3. New pure decision helpers in `libs/catalog/src/utils/toolset-credentials.ts`

```ts
getCredentialsUiState(credentials): CredentialsUiState // ManageCredentials | LoginWithMyCreds | LogIn | LogOut
getCredentialsBadgeState(credentials): CredentialsBadgeState | undefined // LoggedOut, or undefined when signed in / NONE auth
getSignedInLevel(credentials): CredentialsLevel // USER if signed in there, else GLOBAL
```
These port `getToolsetAuthAction`'s exact boolean logic (see proposal) as framework-free functions operating only on the lib's own `CatalogItemCredentials` shape, reused by `Header` (trigger label), `CredentialsSection` (level resolution for the non-admin single-form path and the direct-logout path), and `CredentialsBadge` (card/list badge). `getCredentialsBadgeState` deliberately does not port `CredentialsStatusIndicator`'s MY CREDS/ORG CREDS distinction — only the signed-out state renders a badge, per explicit product decision to simplify the card/list badge to a single state.
- **Why**: the decision logic is identical across three call sites (header label, badge, direct-logout level) — centralizing it in the lib as pure functions (unit-tested directly) avoids re-deriving it in `apps/chat` or duplicating it across components, while staying within library isolation (no app types involved).
- **Alternative considered**: compute the UI state in `apps/chat` and pass a resolved enum/string down as a prop. Rejected — the same `CatalogItemCredentials` object already carries everything needed; adding a redundant derived prop would require keeping two representations in sync.

### 4. `onLogin`/`onLogout` now carry an explicit `level: CredentialsLevel`

```ts
onLogin?: (item, params: { level: CredentialsLevel; apiKey?: string }) => Promise<void> | void;
onLogout?: (item, params: { level: CredentialsLevel }) => Promise<void> | void;
```
The lib always resolves and supplies the level (via `getCredentialsUiState`/`getSignedInLevel` for the non-admin path, or directly from which accordion section was submitted for the admin path) — `apps/chat` never has to re-derive it. `CatalogView.handleLogin`/`handleLogout` map `CredentialsLevel.User`/`Global` (lib enum) to `ToolsetCredentialsLevel.User`/`Global` (app enum, same string values) and pass it straight to `loginToolset`/`logoutToolset`/`initiateOAuthLogin`.
- **Why**: this was flagged as an additive, non-breaking change in the prior design specifically to support this follow-up — confirmed here.

### 5. Header direct-logout path reuses `getSignedInLevel`

When `getCredentialsUiState` resolves to `LogOut` (non-admin case), `Header`'s `onClick` calls `onRequestLogout` instead of toggling the section (carried over from the prior iteration); `DetailsPanel` resolves the level to log out via `getSignedInLevel(item.credentials)` before calling `onLogout`.
- **Why**: keeps the "one click straight to the confirm dialog" legacy UX without needing the caller to separately track which level is active.

### 6. OAuth login opens the provider in a new browser window/tab (carried over, unmodified this iteration)

`initiateOAuthLogin`/`ToolsetEditorCallback` still open a new window and close it on completion rather than navigating the current tab, per the prior iteration's explicit direction. This iteration adds a `credentialsLevel` parameter (previously hardcoded to `USER`) so the Catalog can request `GLOBAL` logins for the admin accordion's organization-wide section, and forwards `code_challenge`/`code_challenge_method` when the toolset's stored OAuth config includes them (mirrors the legacy epic's conditional URL params — the client never generates its own PKCE verifier, it only forwards what the toolset config already has).
- **Why**: `credentialsLevel` needed to stop being implicitly `USER` now that the admin accordion exists; `code_challenge` support was flagged as a P2 gap and is a small, additive change to `buildToolsetAuthorizeUrl`.

### 7. FAILED-state pre-signout guard

Before an API-key or OAuth login attempt, `CatalogView.handleLogin` checks whether the target level's current status is `CredentialStatus.Failed`; if so, it calls `logoutToolset` for that level first (mirrors the legacy `startSignInProcessEpic`'s forced sign-out before retrying a broken auth state).
- **Why**: without this, a toolset stuck in `FAILED` (e.g. an expired OAuth token) could not be re-authenticated cleanly — matches a legacy behavior explicitly called out as needing porting.

### 8. Success notifications and list refresh

`CatalogView` now shows a success `showNotification` after both login and logout (title + templated message using `item.name`/`item.version`), with a `USER` variant, a `GLOBAL` variant, and an "organization" `GLOBAL` variant used specifically when `isAdmin && item.credentials?.isPublic` — porting `getLoginSuccessMessage`/`getLogoutSuccessMessage`'s three-way branch. Both handlers also call `refetchToolsets()` (already exposed by `DeploymentsContext`) after a successful API-key login/logout so `catalogItems` (and therefore card/list badges) update without a full reload. OAuth's popup-based flow does not get this treatment (manual-only refresh, per Decision 6/Non-Goals).
- **Why**: `refetchToolsets` already exists and already drives the same `catalogItems` memo the badges render from — reusing it is the smallest change that makes badges reflect a fresh login/logout.

## Risks / Trade-offs

- **[Risk] `isAdmin` is recomputed on every `/auth/me` request from provider config** (not cached in the session) → Mitigation: intentional — a provider's `adminRoles` can change without requiring re-login; the computation is a cheap array-intersection, no additional network calls.
- **[Risk] `GLOBAL`-level login/logout changes organization-wide credentials — broader blast radius than personal login** → Mitigation: the "Entire organization credentials" section is gated strictly on `isManageableByAdmin` (`isAdmin && isPublic`, resolved server/app-side, never trusted from the client alone since `isAdmin` comes from the authenticated session); logout still requires confirmation at either level.
- **[Risk] Card/list badges reintroduce a "was this actually free" assumption** → Mitigation: explicitly re-verified this iteration by reading the generated client type directly (`DialToolsetAuthSettingsDto` has `userLevelAuthStatus`/`globalAuthStatus`) rather than trusting the prior summary; confirmed no new network request is needed.
- **[Trade-off] No auto-refresh after OAuth popup closes** — unchanged from the prior iteration, still accepted; only synchronous API-key login/logout gets the toast + refetch treatment.

## Migration Plan

Additive-only change; no data migration beyond the new computed `isAdmin` field (derived, not stored).
1. Backend: add `isAdmin` computation + DTO field, regenerate the OpenAPI client (`npm run openapi`), update `UserProfile` shared type.
2. `libs/catalog`: extend `CatalogItemCredentials`, add decision helpers, extend `CredentialsSection`/`Header`, add `CredentialsBadge` and wire into `Card`/`NameCellRenderer`.
3. `apps/chat`: extend mappers with `isAdmin`/`isPublic`, wire `CatalogView` levels/notifications/refetch, extend OAuth utils.
4. i18n keys.
5. No rollback complexity beyond a standard revert — no schema/DTO breaking changes ship with this change (the `CatalogItemCredentials.status` → `userStatus`/`globalStatus` rename is internal to this still-unreleased feature).

## Open Questions

None outstanding.
