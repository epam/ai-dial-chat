## 1. Shared helper for refetching auth settings

- [x] 1.1 In `apps/chat/src/utils/toolsets.ts`, add a small helper that fetches a toolset by id
      and maps its `authSettings` onto a `ToolsetAuthFormData` patch (reusing the existing
      `toolsetDtoToForm`/auth-mapping logic already used on initial load), so it can be shared
      between the new dynamic-registration login path and the existing OAuth `Cancelled`-result
      reconciliation in `AuthSection.tsx`.
- [x] 1.2 Refactor the existing `Cancelled`-result branch in `AuthSection.tsx` (`handleLogIn`,
      around the `getToolset(savedToolsetId)` call) to use this helper instead of hand-mapping
      `authSettings` inline, if it isn't already a straight passthrough.

## 2. Fix the OAuth "With Login" dynamic-registration path

- [x] 2.1 In `AuthSection.tsx`'s `handleLogIn`, detect when the OAuth branch is in "With Login"
      mode with no manually configured `clientId` in current `auth` state (same condition already
      used to decide whether to render the manual client fields).
- [x] 2.2 For that case, call `openToolsetOAuthPopup()` synchronously at the top of the OAuth
      branch (before `onEnsureSaved()`), matching the QuickApps relay's existing pattern for
      popups whose config isn't known yet.
- [x] 2.3 After `onEnsureSaved()` resolves the toolset id, fetch the toolset's current
      `authSettings` via the new helper from Task 1.1 and merge the Core-issued
      `clientId`/`authorizationEndpoint` into a local `resolvedAuth` value (and into `auth` state
      via `onAuthChange`, per the design's state-consistency decision).
- [x] 2.4 Call `navigateToolsetOAuthPopup(popup, resolvedAuth, savedToolsetId, ...)` instead of
      `initiateOAuthLogin` for this case, and route its result through the same
      `waitForToolsetOAuthResult` handling already used for the non-dynamic path (success/failure/
      cancelled branches unchanged).
- [x] 2.5 If the popup fails to open (`openToolsetOAuthPopup()` returns `null`), show the existing
      `ErrorPopupBlocked` notification and skip the persist/fetch/navigate steps, matching current
      popup-blocked handling for the non-dynamic path.
- [x] 2.6 Leave the existing `initiateOAuthLogin(auth, savedToolsetId)` call path unchanged for:
      OAuth "With Login & Config" (manual client already in `auth`), and re-login on an
      already-saved toolset (auth state already loaded from `toolsetDtoToForm`).

## 3. Tests

- [x] 3.1 Add/extend a test in `AuthSection`'s test folder covering: creating a new toolset,
      selecting OAuth "With Login" with no manual client config, clicking "Log in", and asserting
      the popup is opened synchronously, the toolset is persisted, `getToolset` is called to
      resolve `authSettings`, and the popup is navigated to an authorize URL built from the
      fetched `clientId`/`authorizationEndpoint` (regression test for the bug).
- [x] 3.2 Add a test asserting the "With Login & Config" and already-saved-toolset paths still
      call `initiateOAuthLogin` directly with no extra `getToolset` call before navigation.
- [x] 3.3 Add a test asserting `openToolsetOAuthPopup()` returning `null` shows the
      `ErrorPopupBlocked` notification and performs no persist/fetch call.
- [x] 3.4 Update or add a test for the shared helper from Task 1.1 (fetch + map `authSettings`).

## 4. Verification

- [x] 4.1 Run `npm exec nx test chat` (or the narrower affected test target) and confirm all
      `AuthSection`/`toolsets.ts` tests pass.
- [x] 4.2 Run `npm exec nx lint chat`.
- [x] 4.3 Manually verify in the running app: create a new toolset pointed at a real MCP endpoint
      that relies on dynamic client registration, select OAuth "With Login", click "Log in", and
      confirm the provider's authorization page opens instead of the "Failed to log in" toast.
