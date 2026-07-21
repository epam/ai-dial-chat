## Why

QuickApps (an app schema type embedded via `<iframe>` in `/apps-editor`, see
`AppEditorIframe.tsx`) can use toolsets that require OAuth or API-key login, but the iframe
has no way to drive a toolset login/logout itself: it cannot open the same admin OAuth popup
flow ToolsetEditor/Catalog use, and it must never be handed the toolset's stored OAuth client
config (client id/secret, authorization/token endpoints) directly, since that config belongs
to the host app, not to arbitrary embedded iframe content. This change adds a message-relay
so QuickApps can request a login/logout by `toolsetId` alone and the host performs the actual
OAuth/API work on its behalf, reusing the existing admin login machinery. It also fixes a
prior blocker: the toolsets API requires already-percent-encoded ids, while QuickApps only
knows the raw, human-readable id, causing every request to 400.

An earlier design (`add-toolset-popup-signin`, since removed) had QuickApps build and open its
own OAuth popup and land on the shared `/toolset-editor/callback` route directly. That design
required QuickApps to duplicate OAuth client config handling and never worked reliably
end-to-end; this change replaces it entirely with a simpler contract where QuickApps never
touches OAuth details at all.

## What Changes

- Add a `postMessage` contract between the QuickApps iframe and `AppEditorIframe.tsx`:
  `REQUEST_TOOLSET_LOGIN` / `REQUEST_TOOLSET_LOGOUT` (iframe → host, carrying only
  `{ toolsetId }`) and `TOOLSET_LOGIN_RESULT` / `TOOLSET_LOGOUT_RESULT` (host → iframe,
  carrying `{ toolsetId, success, credentialsLevel?, reason?, credentials? }`).
- Login: the host opens the OAuth popup, fetches the toolset's stored auth config, drives the
  existing admin OAuth handshake (same `sessionStorage`/`BroadcastChannel`/callback-route
  machinery `AuthSection`'s admin Log In button already uses — the callback route itself is
  unchanged), and reports the outcome back to the iframe. Includes the existing
  Cancelled-recheck safeguard (re-fetch the toolset's real status when the popup-close race
  makes a successful login look cancelled).
- Logout: the host calls the existing logout endpoint directly by `toolsetId` — no popup, no
  OAuth round-trip.
- Both flows refresh and return `credentials` (the same shape/lookup Catalog's Details panel
  already uses) so QuickApps can reflect up-to-date sign-in status without a second round-trip.
- **BREAKING (internal only, not a public API contract)**: `ToolsetsService.logoutToolset`
  gains a required `bucket` parameter and resolves `authenticationType` server-side when the
  request omits it.
- Backend: `ToolsetLogoutBodyDto.authenticationType` becomes optional — the server looks up
  the toolset's own stored authentication type when the caller (QuickApps, via the host) omits
  it, so a caller that only knows a `toolsetId` doesn't need a separate lookup call first.
- Add `encodeToolsetId` (percent-encode each `/`-segment of a raw toolset id) since the raw id
  QuickApps sends (e.g. containing a literal space) is not the pre-encoded form the toolsets
  API requires.
- Removed: the superseded `add-toolset-popup-signin` design and all of its code
  (`ToolsetPopupState`, `decodeToolsetPopupState`, `QUICKAPPS_TOOLSET_AUTH_POPUP_NAME`,
  `isValidPostMessageOrigin`, the `isQuickAppsPopup()` branch in the callback component, the
  `toolsetEditor.popup.closeFallback` i18n string).

## Capabilities

### New Capabilities

(none — this extends the existing toolset auth capability with a new trigger surface rather
than introducing a new domain concept)

### Modified Capabilities

- `toolset-authentication`: adds the QuickApps message-relay login/logout flow alongside the
  existing ToolsetEditor/Catalog flow, and relaxes the logout request contract
  (`authenticationType` now optional, server-resolved when omitted).

## Impact

- **Frontend**: `apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx` (message handlers),
  `apps/chat/src/types/apps-editor.ts` (new event/payload types), `apps/chat/src/utils/toolsets.ts`
  (`encodeToolsetId`, `openToolsetOAuthPopup`, `navigateToolsetOAuthPopup` extracted from
  `initiateOAuthLogin`), `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx`
  (reverted to admin-only flow after removing the superseded popup-based branch).
- **Backend**: `apps/chat-api/src/toolsets/dto/toolset-auth.dto.ts`,
  `apps/chat-api/src/toolsets/toolsets.service.ts`, `apps/chat-api/src/toolsets/toolsets.controller.ts`.
- **Generated client**: `libs/chat-api-client` regenerated (`npm run openapi`) —
  `ToolsetLogoutBodyDto.authenticationType` is now optional in the SDK type.
- **Cross-repo**: `ai-dial-quickapps-frontend` (out of scope for this repo/change) must send
  `REQUEST_TOOLSET_LOGIN`/`REQUEST_TOOLSET_LOGOUT` and handle the result messages per the
  contract documented in `design.md`.
- **Tests**: `apps/chat/src/pages/AppsEditor/tests/AppEditorIframe.spec.tsx`,
  `apps/chat/src/utils/tests/toolsets.spec.ts`,
  `apps/chat-api/src/toolsets/tests/toolsets.service.spec.ts`,
  `apps/chat-api/src/toolsets/tests/toolsets.controller.spec.ts` — all passing.
