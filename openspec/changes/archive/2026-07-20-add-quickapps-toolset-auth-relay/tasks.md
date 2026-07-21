## 1. Remove superseded popup-based design

- [x] 1.1 Delete `openspec/changes/add-toolset-popup-signin/` (superseded proposal/design/specs)
- [x] 1.2 Remove `isQuickAppsPopup()` branch, `ToolsetPopupState`, `decodeToolsetPopupState`,
      `QUICKAPPS_TOOLSET_AUTH_POPUP_NAME`, `isValidPostMessageOrigin` from
      `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx`,
      `apps/chat/src/types/toolsets.ts`, `apps/chat/src/utils/toolsets.ts`,
      `apps/chat/src/constants/toolsets.ts`
- [x] 1.3 Remove the `toolsetEditor.popup.closeFallback` i18n string and its
      `ToolsetEditorI18nKeys.PopupCloseFallback` key
- [x] 1.4 Update `ToolsetAuthCallback.spec.tsx` and `utils/tests/toolsets.spec.ts` to drop the
      removed popup-flow coverage

## 2. Backend: optional `authenticationType` on logout

- [x] 2.1 Make `ToolsetLogoutBodyDto.authenticationType` optional (`@IsOptional()` +
      `@ApiPropertyOptional`) in `apps/chat-api/src/toolsets/dto/toolset-auth.dto.ts`
- [x] 2.2 Add a `bucket` parameter to `ToolsetsService.logoutToolset`; resolve
      `authenticationType` via the existing `getToolset` lookup when the request omits it,
      before calling DIAL Core's signout
- [x] 2.3 Update `ToolsetsController.logoutToolset` to pass `bucket` from the session user and
      document the new possible `404` response
- [x] 2.4 Regenerate the OpenAPI spec and generated client (`npm run openapi`); verify with
      `npm run openapi:check`
- [x] 2.5 Update `apps/chat-api/src/toolsets/tests/toolsets.service.spec.ts` (bucket arg on all
      existing calls; new tests for the auto-resolve success and unsupported-type failure
      paths) and `toolsets.controller.spec.ts` (body without `authenticationType` returns 200)

## 3. Frontend: shared helpers

- [x] 3.1 Add `encodeToolsetId` to `apps/chat/src/utils/toolsets.ts` (percent-encode each
      `/`-segment of a raw toolset id)
- [x] 3.2 Extract `openToolsetOAuthPopup` and `navigateToolsetOAuthPopup` from the existing
      `initiateOAuthLogin`, preserving `initiateOAuthLogin`'s own validate-before-open behavior
      and existing tests unchanged
- [x] 3.3 Add unit tests for `encodeToolsetId`, `openToolsetOAuthPopup`,
      `navigateToolsetOAuthPopup` in `apps/chat/src/utils/tests/toolsets.spec.ts`

## 4. Frontend: message-relay login/logout in `AppEditorIframe.tsx`

- [x] 4.1 Add `RequestToolsetLogin` / `ToolsetLoginResult` and `RequestToolsetLogout` /
      `ToolsetLogoutResult` to `AppsEditorEvent`, plus `ToolsetLoginResultPayload` /
      `ToolsetLogoutResultPayload` types, in `apps/chat/src/types/apps-editor.ts`
- [x] 4.2 Implement `handleToolsetLoginRequest`: encode id, open popup synchronously, fetch auth
      config via `getToolset`, navigate via `navigateToolsetOAuthPopup`, wait via
      `waitForToolsetOAuthResult`, handle the Cancelled-recheck, post `TOOLSET_LOGIN_RESULT`
- [x] 4.3 Implement `handleToolsetLogoutRequest`: encode id, call `logoutToolset` directly (no
      popup), post `TOOLSET_LOGOUT_RESULT`
- [x] 4.4 Add `fetchToolsetCredentials` (via `getDeploymentDetails` +
      `mapDeploymentDetailsDtoToEntityDetails` + `mapToolsetCredentials`) and include its result
      as `credentials` in both success paths
- [x] 4.5 Wire both request types into the existing `handleMessage` origin-checked dispatcher
- [x] 4.6 Add test coverage in `apps/chat/src/pages/AppsEditor/tests/AppEditorIframe.spec.tsx`
      for both flows: success, each failure reason, the Cancelled-recheck, id encoding/echoing,
      refreshed `credentials`, and cross-origin message rejection

## 5. Verification

- [x] 5.1 `npm exec nx test chat-api` — all toolsets tests passing
- [x] 5.2 `npm exec nx lint chat-api` — clean
- [x] 5.3 `npm exec nx test chat` (AppEditorIframe, utils/toolsets, ToolsetAuthCallback,
      ToolsetEditor suites) — all passing
- [x] 5.4 `npm exec nx lint chat` — clean
- [x] 5.5 `npm run openapi:check` — clean
