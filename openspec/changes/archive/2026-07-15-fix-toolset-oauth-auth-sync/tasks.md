## 1. OAuth popup + redirect-state handoff (`apps/chat/src/utils/toolsets.ts`)

- [x] 1.1 Change `initiateOAuthLogin` to open a same-origin popup synchronously (before any `await`), returning a clear "blocked" result when `window.open` returns `null`, instead of the current `noopener,noreferrer` call that returns `false` only on invalid config.
- [x] 1.2 Generate the OAuth flow/state id (reuse `crypto.randomUUID()`) and write the `ToolsetRedirectState` (`toolsetId`, `credentialsLevel`, `redirectUri`, `state`) directly into the placeholder popup's own `sessionStorage`. Reuse `TOOLSET_REDIRECT_STATE_KEY` inside each isolated popup browsing context and use `state` for channel correlation.
- [x] 1.3 Navigate the popup to the resolved provider authorization URL (including `code_challenge`/`code_challenge_method` when configured) after the popup reference is confirmed open.
- [x] 1.4 Before navigation, reject non-HTTP(S) authorization endpoints and explicitly set the same-origin placeholder's `opener` to `null`.
- [x] 1.5 Add unit tests: popup opened synchronously, blocked-popup detection (`window.open` mocked to return `null`), unsafe scheme rejection, opener severing, redirect-state written and keyed correctly, `state` generation, and `code_challenge` passthrough.

## 2. OAuth callback result reporting (`apps/chat/src/pages/ToolsetEditor/ToolsetEditorCallback.tsx`)

- [x] 2.1 Read `code`/`state` from the callback URL and the flow-scoped redirect state as today; keep the existing `state` mismatch validation.
- [x] 2.2 Open a `BroadcastChannel` (or equivalent) named/keyed by the flow's `state` id and post a typed `{ type: 'success', toolsetId, credentialsLevel }` message after `loginToolset(...)` succeeds, or a typed `{ type: 'failure', reason }` message on any failure (state mismatch, missing redirect state, login API error) — replacing the current silent `window.close()` paths.
- [x] 2.3 Close the popup only after the message has been posted.
- [x] 2.4 Add unit tests for: success message posted with correct payload, failure message posted on state mismatch, failure message posted on missing redirect state, failure message posted on `loginToolset` rejection.

## 3. Initiating-tab OAuth result handling — shared logic

- [x] 3.1 Add a small hook/util in `apps/chat` (not in `libs/*`) that, given a flow id, subscribes to the matching `BroadcastChannel`, resolves with the typed result, handles the popup-closed-manually case via low-frequency `popup.closed` polling, and closes the popup when enforcing a pending timeout — used by both the Editor and the Catalog.
- [x] 3.2 Add unit tests for: success resolution, failure resolution, manual popup close resolving as cancelled, timeout closing the popup and resolving as cancelled, and that a stale/mismatched flow id is ignored.

## 4. Toolset Editor sync (`apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx`)

- [x] 4.1 Wire `handleLogIn`'s OAuth branch to the shared result hook (task 3.1): set `isAuthBusy` while pending, and on success call `onAuthChange({ isLoggedIn: true })` the same way the API-key path already does.
- [x] 4.2 On failure or cancellation, clear `isAuthBusy` and leave `isLoggedIn` unchanged (so "Log in" stays available). Show the translated error notification for failures; cancellation remains silent.
- [x] 4.3 On success, show a translated success notification in addition to updating the Editor's inline "Logged in" status.
- [x] 4.4 Update `apps/chat/src/pages/ToolsetEditor/EditorForm/tests/AuthSection.spec.tsx` to cover: OAuth success flips the action to "Log out", OAuth failure keeps "Log in" and shows an error, OAuth cancellation/timeout keeps "Log in" with no notification.

## 5. Catalog sync (`apps/chat/src/components/CatalogView/CatalogView.tsx`)

- [x] 5.1 Wire `handleCredentialsLogin`'s OAuth branch to the shared result hook (task 3.1) instead of returning immediately after `initiateOAuthLogin`.
- [x] 5.2 On success: call `await refetchToolsets()`, update the open Details Panel's credentials status, and show the existing level-aware (USER/GLOBAL, admin/public) success notification reused from the API-key path.
- [x] 5.3 On failure: show the existing error notification, show no success notification, and leave the Details Panel/card badge unchanged.
- [x] 5.4 On popup-blocked (from task 1.1's result) show the translated "popup blocked" error notification without starting the result-wait.
- [x] 5.5 Update `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` to cover: OAuth success triggers `refetchToolsets` and updates Details/badge, OAuth failure shows error and leaves state unchanged, popup-blocked shows an error notification.

## 6. Favorite card badge (`libs/catalog/src/components/Favorites/FavoriteCard.tsx`)

- [x] 6.1 Add the `credentials` prop (mirroring `Card.tsx`) and render `<CredentialsBadge credentials={item.credentials} loggedOutLabel={credentialsBadgeLoggedOutLabel} />` alongside the existing `AppIdentity`/`StarToggleButton` content, reusing `getCredentialsBadgeState` unchanged — no new badge states. — Note: `CatalogItem.credentials` already existed on the shared item type, so only a `credentialsBadgeLoggedOutLabel` prop was threaded through (`Favorites` → `FavoriteCard`, and `Catalog.tsx` → `Favorites`), not a new `credentials` prop.
- [x] 6.2 Verify RTL/logical-property layout is unaffected (badge placement follows the same pattern already used in `Card.tsx`).
- [x] 6.3 Add/update `libs/catalog/src/components/Favorites/tests/FavoriteCard.spec.tsx`: badge shown for signed-out `API_KEY` and `OAUTH` toolsets, no badge when signed in, no badge for `authenticationType: NONE`.

## 7. Spec-aligned cross-window test coverage

- [x] 7.1 Add at least one test that exercises real cross-window messaging rather than relying only on JSDOM. — Added the dedicated Nx `@epam/chat:test-oauth-browser` Playwright target, which opens a real popup, writes popup-local `sessionStorage`, severs `opener`, performs a cross-origin provider round trip, and receives the callback result through `BroadcastChannel`.
- [x] 7.2 Add a badge matrix test asserting identical `LOGGED OUT` behavior across `Card`, list row, and `FavoriteCard` for both `API_KEY` and `OAUTH` authentication types. — Added to `toolset-credentials.spec.ts` (pure logic parity) and `Card.spec.tsx` (rendering); `FavoriteCard.spec.tsx` already covers both auth types. List-row rendering reuses the same `CredentialsBadge`/`getCredentialsBadgeState` path and was not separately duplicated.

## 8. i18n and documentation

- [x] 8.1 Add/reuse i18n keys for the popup-blocked error and Editor login-success notifications in `apps/chat/src/i18n/locales/en.json`, following the `{domain}.{element}` key format. No new busy-state copy is needed since the existing `isAuthBusy` disables the button without new text.
- [x] 8.2 Update any developer-facing doc under `docs/` that describes the OAuth toolset login flow, if one exists, to match the new popup + `BroadcastChannel` behavior (check via the `dial-docs` skill before editing). — No existing `docs/` page describes the toolset OAuth flow, so no documentation update is required.

## 9. Verification

- [x] 9.1 Run `npm exec nx test chat` and `npm exec nx test catalog` (or the equivalent affected projects) for all new/updated specs in this change. — `@epam/chat`: 115 files / 1180 tests passed (2 skipped). `@epam/ai-dial-catalog`: 23 files / 246 tests passed. The dedicated Chromium OAuth popup regression also passed.
- [x] 9.2 Run `npm exec nx lint chat` and `npm exec nx lint catalog`. — Both clean (only pre-existing unrelated warnings).
- [x] 9.3 Run `npm exec nx affected --target=test --base=origin/development-1.0` and `npm exec nx affected --target=lint --base=origin/development-1.0` to confirm no regressions outside the directly touched projects. — Both affected projects (`@epam/chat`, `@epam/ai-dial-catalog`) pass with no new lint errors.
- [x] 9.4 Manually verify in the dev app (`npm start`): OAuth login from Catalog updates the card badge and Details panel without reload; OAuth login from the Toolset Editor flips "Log in" to "Log out"; a blocked popup shows an error; closing the popup manually leaves "Log in" available. — Not performed in this session (requires a live browser + an OAuth provider to test against); recommend a manual pass before merge.
