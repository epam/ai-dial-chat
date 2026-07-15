## Why

Toolset OAuth login gives users no feedback: the callback runs in a separate, `noopener` popup that cannot reach the opener tab, so after a successful (or failed) OAuth login the Catalog card, Details panel, and Toolset Editor all keep showing the stale "logged out" state until the user manually reloads or reopens them (#7013, #7777, #7092). The current spec explicitly excuses this by requiring users to reopen/reload after OAuth login — that exemption is the root cause and needs to be removed, not preserved. Separately, favorite toolset cards render no credentials badge at all, unlike the regular grid/list cards, so a signed-out toolset can look interchangeable with a signed-in one when favorited. #7778 additionally asks for positive "logged in" badges; the product decision is to reject that and keep the badge negative-only and consistent everywhere a card is rendered.

## What Changes

- Change `initiateOAuthLogin` to accept only HTTP(S) authorization endpoints, open a same-origin popup synchronously (for reliable popup-blocked detection), make the pending redirect state reachable by the popup's callback context, and explicitly sever the opener relationship before navigating to the cross-origin authorization endpoint — instead of using `noopener` from the start.
- Change `ToolsetEditorCallback` to report a typed success/failure result to the originating tab (e.g. via a same-origin `BroadcastChannel` keyed by the OAuth flow/state id) before closing, instead of silently closing on failure and never notifying on success.
- Update `AuthSection.tsx` (Toolset Editor) to listen for the OAuth result, show a busy state while pending, flip `Log in` to `Log out` on success, and surface translated success/error notifications.
- Update `CatalogView.tsx` to listen for the same OAuth result, refetch toolsets without a full reload, update an open Details panel, and show the existing level-aware (USER/GLOBAL) success or error notification — removing the current early-return that skips `refetchToolsets()` for OAuth.
- Add a `CredentialsBadge` (or equivalent) to `FavoriteCard.tsx` so favorite cards show the same `LOGGED OUT` badge as `Card.tsx`, using the existing negative-only badge rule (no new badge states).
- **BREAKING (spec-level only, no code compat concern):** Remove the `catalog-toolset-credentials` requirement that exempts OAuth from automatic refresh and the language stating users must reopen the panel or reload the list after OAuth login.

## Capabilities

### New Capabilities

(none — this change extends existing catalog/toolset behavior rather than introducing a new domain capability)

### Modified Capabilities

- `catalog-toolset-credentials`: OAuth login/logout must trigger the same automatic Details-panel and card-list refresh that API-key login/logout already triggers (removing the current OAuth exemption and reopen/reload language); the `LOGGED OUT` badge rule must also apply to favorite toolset cards, not only grid/list cards.

## Impact

- **Affected code:** `apps/chat/src/utils/toolsets.ts` (OAuth initiation), `apps/chat/src/pages/ToolsetEditor/ToolsetEditorCallback.tsx`, `apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx`, `apps/chat/src/components/CatalogView/CatalogView.tsx`, `libs/catalog/src/components/Favorites/FavoriteCard.tsx`. Badge logic in `libs/catalog/src/utils/toolset-credentials.ts` is reused as-is (no new badge states).
- **Cross-window communication:** introduces a same-origin `BroadcastChannel` (or equivalent) protocol between the OAuth callback window and its opener; this is new browser-integration surface confined to `apps/chat` (library isolation preserved — `libs/catalog` gains no OAuth/browser-storage knowledge).
- **Spec:** `openspec/specs/catalog-toolset-credentials/spec.md` requirements change (OAuth exemption removed; favorite-card badge scenario added).
- **Tests:** new/updated unit tests for popup creation, blocked-popup detection, redirect-state handoff, OAuth state validation, callback success/failure messaging, `AuthSection` and `CatalogView` post-login sync, and a `FavoriteCard` badge test; at least one test exercising real cross-window messaging rather than same-`sessionStorage` JSDOM shortcuts.
- **No API/DTO changes** — this is frontend-only; no `apps/chat-api` or OpenAPI impact.
