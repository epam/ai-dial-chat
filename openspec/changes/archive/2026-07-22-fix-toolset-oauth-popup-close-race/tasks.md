## 1. Opener closes the popup on message receipt

- [x] 1.1 In `apps/chat/src/utils/toolsets.ts`, update `waitForToolsetOAuthResult`'s
      `channel.onmessage` handler to call `popup.close()` immediately after resolving the
      result via `finish(...)`.
- [x] 1.2 Confirm the existing `popup.closed` poll + `closeGraceMs` grace-period branch is left
      unchanged (it still exists solely to detect a genuine manual cancellation where no message
      was ever posted).
- [x] 1.3 Confirm the existing timeout branch (`timeoutId` firing after `timeoutMs`) still calls
      `popup.close()` itself — unaffected by this change since no message was ever expected there
      either.

## 2. Callback popup stops self-closing on a fixed timer

- [x] 2.1 In `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx`, remove the
      `window.close()` call that currently fires ~50ms after `postMessage` on the success/failure
      path.
- [x] 2.2 Add a bounded safety-net timer (e.g. `setTimeout`, 3–5s) started right after
      `postMessage`, that calls `window.close()` only if the window is still open when it fires —
      covers the case where the opener tab was closed/navigated away and can never close the
      popup itself.
- [x] 2.3 Keep the existing immediate `window.close()` for the "no valid stored redirect state"
      path unchanged — no result is posted there, so there is nothing for the opener to react to.
- [x] 2.4 Update the callback route's UI state so the popup shows a distinct "Completing sign-in…"
      (or existing "success"/"failure") state while waiting to be closed, so it doesn't render a
      dead/blank screen during the (usually sub-second) wait. (`RouteFallback`'s spinner already
      renders for the whole lifecycle — not a blank screen — so no separate state was added; the
      wait is sub-second in the common case and bounded by the 4s safety net otherwise.)

## 3. API-key login success notification (Toolset Editor)

- [x] 3.1 In `apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx`, add
      `showNotification({ variant: NotificationVariant.Success, message: t(...) })` on the
      API-key `handleLogIn` success path, matching the OAuth branch's existing notification and
      reusing (or adding, per `.claude/rules/all-ts.md` i18n conventions) the appropriate
      `ToolsetEditorI18nKeys.LoginSuccess` key.

## 4. Tests

- [x] 4.1 Add/update a unit test for `waitForToolsetOAuthResult` in
      `apps/chat/src/utils/tests/toolsets.spec.ts` (or equivalent) covering: popup closes via the
      opener after a `Success`/`Failure` message; a manual cancel (popup closes with no message
      ever posted) still resolves `Cancelled` via the existing grace period.
- [x] 4.2 Update `apps/chat/src/pages/ToolsetAuthCallback/tests/ToolsetAuthCallback.spec.tsx` to
      assert `window.close()` is not called immediately after `postMessage`, and that the
      safety-net timer does call `window.close()` once it elapses without external closure.
- [x] 4.3 Add a test for the new API-key success notification in `AuthSection`'s test suite.

## 5. Verification

- [x] 5.1 `npm exec nx test chat`
- [x] 5.2 `npm exec nx lint chat`
- [x] 5.3 Manual smoke test: complete an OAuth toolset login from both the Catalog Details Panel
      and the Toolset Editor's Auth section, confirming the success notification and
      list/capabilities refresh happen reliably (repeat a few times to probe the previously
      intermittent race).
