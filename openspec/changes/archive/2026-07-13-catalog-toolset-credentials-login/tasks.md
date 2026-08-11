## 1. Investigation (initial conclusions — CORRECTED in §7, see below)

- [x] 1.1 ~~Confirmed: the toolset list DTO has no auth-status field~~ — **WRONG, corrected in §7.1**: `DialToolsetAuthSettingsDto` (returned by both `GET /toolsets` and `GET /toolsets/:name`) does include `userLevelAuthStatus`/`globalAuthStatus`; this was a misreading during the original investigation. Card/list badges are implemented in §7.
- [x] 1.2 ~~Confirmed: no `isAdmin`/toolset-`isPublic` helper exists~~ — **CORRECTED in §7.2**: no helper existed, but a computed `isAdmin` was straightforward to add server-side from the provider's existing `adminRoles` config; `isPublicToolsetId` was added client-side. Admin/`GLOBAL` flow is implemented in §7.

## 2. `libs/catalog` models and types

- [x] 2.1 Add `CatalogItemCredentials` type (`authenticationType: 'NONE' | 'API_KEY' | 'OAUTH'`, `status?: 'SIGNED_IN' | 'SIGNED_OUT' | 'FAILED'`) to `libs/catalog/src/models/` and an optional `credentials?: CatalogItemCredentials` field on `CatalogItem`.
- [x] 2.2 Add `onLogin?: (item: CatalogItem, params: { apiKey?: string }) => void` and `onLogout?: (item: CatalogItem) => void` to `CatalogProps` (`catalog-props.ts`) and `DetailsPanelProps` (`item-details-props.ts`).
- [x] 2.3 Add text override fields to `ItemDetailsTexts`: `loginActionLabel`, `logoutActionLabel`, `credentialsSignedInLabel`, `credentialsSignedOutLabel`, `logoutConfirmMessage`, `apiKeyFieldLabel`, all optional with English defaults.

## 3. `libs/catalog` components

- [x] 3.1 Add `Header.tsx` trigger button ("Log in" / "Log out") next to Edit/Share, gated by `credentials?.authenticationType !== 'NONE'` and toggling a local `isCredentialsOpen` state owned by `DetailsPanel.tsx`.
- [x] 3.2 Implement `CredentialsSection` component (`libs/catalog/src/components/Details/Credentials/CredentialsSection.tsx`): shows current status, an API key input + submit for `API_KEY` auth, a "Log in" button for `OAUTH` auth, and "Log out" when signed in.
- [x] 3.3 Implement the inline login form submit handling: `API_KEY` calls `onLogin(item, { apiKey })`; `OAUTH` calls `onLogin(item, {})` (no `apiKey`).
- [x] 3.4 Implement the logout confirmation dialog (reuse existing confirm-dialog component from the design system) gating the `onLogout` call.
- [x] 3.5 Apply RTL logical properties throughout new components; mirror any directional icons with `rtl:scale-x-[-1]`.
- [x] 3.6 Add ARIA roles/labels for the expandable section and the confirmation dialog; ensure keyboard navigation (tab order, Enter/Space to toggle, Escape to close confirmation).
- [x] 3.7 Add unit tests for `CredentialsSection` and the trigger button visibility logic.

## 4. `apps/chat` wiring

- [x] 4.1 In `map-entity-details-to-catalog.ts`, map `authStatus.userLevel` + `authenticationType` into the new `credentials` shape on the panel's `CatalogItemTabData`/`CatalogItem`, and remove the now-redundant inert "Sign-in status" text spec row (superseded by the interactive section).
- [x] 4.2 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, implement `onLogin` (API_KEY: call `loginToolset` via `server-api/toolsets.ts`, await, `useNotification` on error/success; OAUTH: call `initiateOAuthLogin(auth, toolsetId)` — no level argument, defaults to `USER`; see task 6 for the new-window navigation change) and `onLogout` (call `logoutToolset`, `useNotification` on error/success).
- [x] 4.3 On successful login/logout, re-invoke the existing `onFetchDetails` path for the open panel so `credentials.status` refreshes without a full reload.
- [x] 4.4 Pass the new `detailsTexts` overrides (or omit to use lib defaults) from `CatalogView.tsx`.
- [x] 4.5 Add i18n keys to `translation-keys.ts` and `apps/chat/src/i18n/locales/en.json` / `ar.json` for all new user-visible strings (button labels, status labels, confirmation dialog text).

## 5. Verification

- [x] 5.1 `npm exec nx lint @epam/ai-dial-catalog` and `npm exec nx test @epam/ai-dial-catalog`.
- [x] 5.2 `npm exec nx run-many -t lint -p catalog chat`.
- [x] 5.3 `npm exec nx test chat -- --testPathPattern=<relevant-spec-names>` for `CatalogView` and `map-entity-details-to-catalog`.
- [x] 5.4 Manually verified in the already-running dev app (real DIAL session) via Playwright: opening a Toolset card shows "Log in" for a signed-out OAuth toolset with no API key field; clicking it expands the inline "Signed out" section; clicking the inline "Log in" button navigates to the real provider's OAuth authorize URL (`clientId`/`authorizationEndpoint` correctly sourced from the toolsets list); `GET /api/v1/toolsets` and `GET /api/v1/deployments/.../details` both returned 200 with no new console errors. **Not verified live** (no suitable fixture toolset found / would require completing a real third-party OAuth consent or a live full reload cycle): API_KEY login/logout submit, logout confirmation dialog, NONE-auth toolset hiding the button (covered instead by `Header.spec.tsx` unit tests), post-login/logout panel refresh, and RTL/Arabic layout (`ar.json` does not exist on this branch).
- [x] 5.5 Confirm editor OAuth/API_KEY login still works with the new-window navigation change (see task 6) — `AuthSection.tsx`'s API_KEY flow is untouched; its OAuth flow now opens a new window/tab like the Catalog, verified via `ToolsetEditorCallback.spec.tsx` (updated for `window.close()`).

## 6. OAuth login opens in a new window (follow-up, both Editor and Catalog)

- [x] 6.1 Change `initiateOAuthLogin` (`apps/chat/src/utils/toolsets.ts`) to open the provider authorization URL via `window.open(url, '_blank')` (setting `authWindow.opener = null`) instead of `window.location.href = url`; drop the now-unused `callbackUrl` parameter and the `ToolsetRedirectState.callbackUrl` field.
- [x] 6.2 Update `ToolsetEditorCallback.tsx` to call `window.close()` on every exit path (missing state/code, CSRF mismatch, login success, login failure) instead of `navigate(...)`; remove the now-unused `useNavigate`/`ROUTES.Catalog` fallback logic.
- [x] 6.3 Update call sites: `AuthSection.tsx` and `CatalogView.tsx` drop the `callbackUrl`/`window.location.href` argument from `initiateOAuthLogin`.
- [x] 6.4 Update `ToolsetEditorCallback.spec.tsx` to assert `window.close()` instead of `navigate(...)`.
- [x] 6.5 Update `catalog-toolset-credentials` and `toolset-authentication` (MODIFIED) specs, design.md, and proposal.md to describe the new-window behavior and its manual-only (no auto-refresh) refresh model.
- [x] 6.6 Manually verified live: clicking "Log in" on an OAuth toolset in the Catalog opens a second browser tab to the real provider's login page while the Catalog tab stays on `/catalog` (confirmed via `browser_tabs list` showing both tabs).

## 7. Full legacy parity pass (admin/GLOBAL, badges, notifications, list refresh, OAuth details)

### 7.1 Backend: computed `isAdmin`

- [x] 7.1.1 `apps/chat-api/src/auth/auth.controller.ts`: add `computeIsAdmin(user)` reading `ProviderConfig.adminRoles`/`rolesClaim` via `ProviderRegistryService.getProvider`, intersected with `user.claims[rolesClaim]`; add `isAdmin` to `getCurrentUser`'s response.
- [x] 7.1.2 `apps/chat-api/src/openapi/openapi-response.dto.ts`: add `isAdmin: boolean` to `UserProfileDto`.
- [x] 7.1.3 Regenerate the OpenAPI client (`npm run openapi`, `npm run openapi:check`) and build/lint `chat-api-client`.
- [x] 7.1.4 `libs/chat-shared/src/models/auth.ts`: add `isAdmin: boolean` to `UserProfile`; update all `UserProfile`/mock-user literals across `apps/chat/src` test files that now require the field.
- [x] 7.1.5 Unit tests: `auth.controller.spec.ts` — `isAdmin` true when roles intersect `adminRoles`, false when they don't, false when no `adminRoles` configured.

### 7.2 `apps/chat`: `isPublicToolsetId` + credential decision reuse

- [x] 7.2.1 `apps/chat/src/utils/toolsets.ts`: add `isPublicToolsetId(toolsetId)` (bucket-segment-equals-`public` check, mirrors legacy `isEntityIdPublic`).
- [x] 7.2.2 Confirm the `getToolsetAuthAction` decision logic is ported as pure lib functions (`getCredentialsUiState`, `getCredentialsBadgeState`, `getSignedInLevel` in `libs/catalog/src/utils/toolset-credentials.ts`) rather than duplicated in `apps/chat` — confirmed, no separate app-level `getToolsetAuthAction` needed. `getCredentialsBadgeState` intentionally does not port `CredentialsStatusIndicator`'s MY CREDS/ORG CREDS states — see 7.3.9b.

### 7.3 `libs/catalog`: dual status, admin accordion, badges

- [x] 7.3.1 Extend `CatalogItemCredentials` with `userStatus`, `globalStatus` (replacing `status`), `isPublic`, `isManageableByAdmin`, `apiKeyHeader`.
- [x] 7.3.2 Add `CredentialsLevel`, `CredentialsUiState`, `CredentialsBadgeState` enums to `libs/catalog/src/types/toolset-auth.ts`.
- [x] 7.3.3 Add `getCredentialsUiState`, `getCredentialsBadgeState`, `getSignedInLevel` pure functions + unit tests (`toolset-credentials.ts`/`.spec.ts`).
- [x] 7.3.4 Update `onLogin`/`onLogout` signatures (`item-details-props.ts`, `catalog-props.ts`) to carry `{ level: CredentialsLevel; apiKey? }` / `{ level: CredentialsLevel }`.
- [x] 7.3.5 Add text override fields: `manageCredentialsActionLabel`, `loginWithMyCredsActionLabel`, `myCredentialsSectionLabel`, `organizationCredentialsSectionLabel`, `apiKeyFieldHint`, `credentialsBadgeLoggedOutLabel`.
- [x] 7.3.6 `Header.tsx`: resolve `credentialsUiState` via `getCredentialsUiState`, pick label/icon per state, add `onRequestLogout` prop for the direct-logout path when state is `LogOut`.
- [x] 7.3.7 `CredentialsSection.tsx`: branch on `isManageableByAdmin` to render two `Accordion` sections (`LevelForm` sub-component per level) vs. a single section at the resolved level; show the API-key hint via `apiKeyFieldHint`.
- [x] 7.3.8 `DetailsPanel.tsx`: add direct-logout confirmation state/handler (`handleRequestLogout`/`handleConfirmDirectLogout` using `getSignedInLevel`).
- [x] 7.3.9 Add `CredentialsBadge` component; wire into `Card.tsx` (grid) and `NameCellRenderer.tsx` (list, via `GridContext`); thread the `credentialsBadgeLoggedOutLabel` override through `CardGridTitles`/`CardRowData`/`ListViewProps`/`CardProps`.
- [x] 7.3.9b **Simplified per explicit product decision**: the card/list badge shows only "LOGGED OUT" (signed-out state); the MY CREDS/ORG CREDS signed-in states and the secondary org-creds badge were removed from `CredentialsBadgeState`, `getCredentialsBadgeState`, `CredentialsBadge`, and all label-threading props (`hasAdditionalOrgCredsBadge` deleted; `credentialsBadgeMyCredsLabel`/`credentialsBadgeOrgCredsLabel` removed everywhere, including i18n keys `CredentialsBadgeMyCreds`/`CredentialsBadgeOrgCreds`).
- [x] 7.3.10 Update/extend unit tests: `Header.spec.tsx` (Manage credentials / Login with my creds / direct-logout), `CredentialsSection.spec.tsx` (admin accordion, per-level submit, API-key hint), `DetailsPanel.spec.tsx` mocks, `toolset-credentials.spec.ts` (badge returns `undefined` when signed in at any level).
- [x] 7.3.11 Export new symbols (`CredentialsLevel`, `CredentialsUiState`, `CredentialsBadgeState`, decision helpers, `CredentialsBadge`) from `libs/catalog/src/index.ts`.

### 7.4 `apps/chat`: mappers, `CatalogView`, OAuth details

- [x] 7.4.1 `map-deployment-to-catalog-item.ts`: `mapToolsetCredentials(toolsetId, authSettings, isAdmin)` computes `userStatus`/`globalStatus`/`isPublic`/`isManageableByAdmin`/`apiKeyHeader`; `mapToolsetToCatalogItem` takes `isAdmin`.
- [x] 7.4.2 `map-entity-details-to-catalog.ts`: `mapToolsetCredentials(toolsetId, data, isAdmin)` (details-refresh variant) computes the same shape from `ToolsetEntityDetails`; `ToolsetAuthStatus`/`mapToolsetAuthStatus` gain `apiKeyHeader`.
- [x] 7.4.3 `CatalogView.tsx`: resolve `isAdmin` via `useUser()`; thread `params.level` through to `loginToolset`/`logoutToolset`/`initiateOAuthLogin`; add `getLevelStatus`/`showLoginSuccess`/`showLogoutSuccess` helpers; call `refetchToolsets()` after API-key login/logout; pass new `detailsTexts`.
- [x] 7.4.4 `utils/toolsets.ts`: `initiateOAuthLogin`/`buildToolsetAuthorizeUrl` take an explicit `credentialsLevel`; forward `code_challenge`/`code_challenge_method` when present on `ToolsetAuthFormData`.
- [x] 7.4.5 `CatalogView.handleLogin`: sign out the target level first when its current status is `FAILED`, before attempting a new login.
- [x] 7.4.6 i18n: add all new keys to `translation-keys.ts` and `en.json` (admin/public labels, badge labels, success/error message templates, API-key hint). `ar.json` does not exist on this branch.
- [x] 7.4.7 Tests: `map-deployment-to-catalog-item.spec.ts` (isPublic/isManageableByAdmin/dual status/apiKeyHeader, both toolset-level and standalone `mapToolsetCredentials`); `CatalogView.spec.tsx` (USER vs GLOBAL level login/logout, `refetchToolsets` called, error notification).

### 7.5 Verification

- [x] 7.5.1 `npm exec nx test chat-api` — 1059 tests pass, including new `isAdmin` cases.
- [x] 7.5.2 `npm exec nx lint chat-api` — no new errors (one pre-existing unrelated import-order error in `share.service.spec.ts`).
- [x] 7.5.3 `npm exec nx test @epam/ai-dial-catalog` and `npm exec nx lint @epam/ai-dial-catalog` — all green.
- [x] 7.5.4 `npm exec nx test chat` and `npm exec nx lint chat` — all green (974 tests).
- [x] 7.5.5 Manual/live verification (Playwright, real DIAL session): confirmed `GET /api/v1/auth/me` returns the new `isAdmin` field (`false` for this non-admin user); confirmed toolset cards in the Catalog grid render "LOGGED OUT" badges from real `authSettings` data; confirmed a public toolset's Details Panel shows "Login with my creds" (not generic "Log in") for a non-admin, non-signed-in user — validates the four-state decision tree end-to-end; confirmed the inline section expands to the correct OAuth/API-key form for the resolved level. **Not verified live** (no admin session available in this environment): the admin+public "Manage credentials" two-level accordion, `GLOBAL`-level login/logout, and the "organization" success-notification variant — covered instead by unit tests (`Header.spec.tsx`, `CredentialsSection.spec.tsx`, `CatalogView.spec.tsx`); recommend a follow-up live check with an admin account before merge.
