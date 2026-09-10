## 1. `libs/scheduled-tasks`: add the `banner` slot

- [x] 1.1 In `libs/scheduled-tasks/src/models/scheduled-tasks-props.ts`, add
      `banner?: ReactNode` to `ScheduledTasksProps` (import `ReactNode` from
      `react`), with a JSDoc comment stating it renders between the toolbar
      and content region, and nothing when omitted.
- [x] 1.2 In `libs/scheduled-tasks/src/components/ScheduledTasks/
      ScheduledTasks.tsx`, destructure `banner` from props and render
      `{banner}` immediately after the existing
      `<div className="flex flex-wrap items-center gap-3">...</div>` toolbar
      block and before the `<span role="status" aria-live="polite">` status
      span / content region.
- [x] 1.3 Add/extend `libs/scheduled-tasks/src/components/ScheduledTasks/
      tests/ScheduledTasks.spec.tsx` with cases: banner renders between
      toolbar and content when passed; nothing extra renders when omitted;
      banner renders during loading/error/empty states too (per the new
      spec scenarios in `specs/scheduled-tasks-page-ui/spec.md`).
- [x] 1.4 Update `libs/scheduled-tasks/README.md`'s `ScheduledTasks` usage
      example/description to mention the new `banner` prop.
      Verify: `npm exec nx test scheduled-tasks`, `npm exec nx lint
      scheduled-tasks`, `npm run validate:docs`

## 2. New app-local component: `ScheduledTasksLoginBanner`

- [x] 2.1 Create `apps/chat/src/components/ScheduledTasksLoginBanner/
      ScheduledTasksLoginBanner.tsx` exporting
      `ScheduledTasksLoginBannerState` enum (`Shown`, `LoginInProgress`,
      `RetryPopupBlocked`, `RetryCancelled`, `RetryTimeout`, `RetryFailed`)
      and a `Props` interface (`state: ScheduledTasksLoginBannerState |
      undefined`, `title`, `body`, `loginButtonLabel`, `retryButtonLabel`,
      `loggingInLabel`, `popupBlockedMessage`, `cancelledMessage`,
      `timeoutMessage`, `failedMessage`, `liveAnnouncement`, `onLogIn?: () =>
      void`), following `apps/chat/AGENTS.md`'s `apps/*` component
      conventions (`FC<Props>`, `export default memo(...)`).
- [x] 2.2 Implement the component per `design.md` Decision 3: `state ===
      undefined` renders only the `sr-only` `role="status" aria-live="polite"`
      span carrying `liveAnnouncement` (mirrors the deleted modal's
      "renders nothing visible" contract); otherwise hand-compose a
      `role="alert"` banner with the reference's neutral `bg-layer-sunken`
      surface, `IconAlertTriangleFilled` warning icon, shared typography
      utilities, a nested `sr-only` `role="status" aria-live="polite"` span
      carrying the active retry message, and a ui-kit 2.0 `OutlinedButton`
      child whose visible `label` is
      `loginButtonLabel`/`retryButtonLabel`/`loggingInLabel` depending on
      state (never a separate `aria-label` — the real `Button` takes its
      accessible name from a string `label` first, per `design.md` Decision
      3's correction), `disabled` while `LoginInProgress`, with a trailing
      `IconArrowRight` (`@tabler/icons-react`, `size={DIAL_ICON_SIZE.SM}`,
      `stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden`,
      `className="rtl:scale-x-[-1]"`) and `min-h-11 min-w-11` sizing.
- [x] 2.3 Add `apps/chat/src/components/ScheduledTasksLoginBanner/tests/
      ScheduledTasksLoginBanner.spec.tsx` covering: renders nothing visible
      when `state` is `undefined` (but announces a pending
      `liveAnnouncement`); shows title/body/"Log in" button when `Shown`;
      calls `onLogIn` on click; disables the button and swaps its visible
      label to `loggingInLabel` during `LoginInProgress`; for each retry
      state (`RetryPopupBlocked`/`RetryCancelled`/`RetryTimeout`/
      `RetryFailed`) shows a "Retry" button that also calls `onLogIn` and
      announces the matching message via the nested polite region (title/body
      stay unchanged — assert the visible title/body text does NOT change on
      a retry transition); the container carries `role="alert"` when shown
      (assert via `getByRole('alert')`). Follow `.claude/rules/spec.md`
      selector priority and exercise the real ui-kit `OutlinedButton`.
      Verify: `npm run test:file -- apps/chat/src/components/
      ScheduledTasksLoginBanner/tests/ScheduledTasksLoginBanner.spec.tsx`
- [x] 2.4 Corrected the banner's visual treatment against the Figma reference
      (`https://www.figma.com/design/QMWaL8m8tFmoekQKxIH569/DIAL-Chat-2.0--
      Scheduled-tasks?node-id=630-13770`, read from a pasted screenshot — no
      Figma MCP tool was connected in this session): replaced the
      `Notification`-wrapped markup with a hand-composed `role="alert"`
      container (`bg-layer-sunken` surface, `IconAlertTriangleFilled` tinted
      via `text-warning-icon`, the same `dial-small-paragraph-semi-text`/
      `dial-small-paragraph-text` title/body pairing `Notification`'s
      `SectionMessage` mode renders internally) per `design.md` Decision 3's
      correction — no single `NotificationVariant` pairs a neutral
      background with a warning icon. `libs/scheduled-tasks/src/components/
      ScheduledTasks/ScheduledTasks.tsx`'s existing `gap-6` vertical rhythm
      already matched the reference's spacing around the banner slot; no lib
      change was needed.
      Verify: `npx eslint apps/chat/src/components/ScheduledTasksLoginBanner/
      ScheduledTasksLoginBanner.tsx`, `npm run test:file -- apps/chat/src/
      components/ScheduledTasksLoginBanner/tests/
      ScheduledTasksLoginBanner.spec.tsx`, `npm run test:file -- apps/chat/
      src/pages/ScheduledTasksPage/tests/ScheduledTasksPage.spec.tsx`

## 3. i18n

- [x] 3.1 In `apps/chat/src/constants/translation-keys.ts`, remove
      `OfflineCredentialsModalTitle`, `OfflineCredentialsModalBody`,
      `OfflineCredentialsModalDismissButtonLabel`,
      `OfflineCredentialsModalCloseAriaLabel` from `ScheduledTasksI18nKeys`;
      add `OfflineCredentialsBannerTitle`, `OfflineCredentialsBannerBody`,
      `OfflineCredentialsBannerPopupBlockedMessage`,
      `OfflineCredentialsBannerCancelledMessage`,
      `OfflineCredentialsBannerTimeoutMessage`,
      `OfflineCredentialsBannerFailedMessage`,
      `OfflineCredentialsBannerSuccessAnnouncement`,
      `OfflineCredentialsBannerLoggingInLabel`; rename
      `OfflineCredentialsModalLoggingInAriaLabel` to
      `OfflineCredentialsBannerLoggingInLabel` rather than adding a
      duplicate. `retryButtonLabel` keeps reusing `ButtonsI18nKeys.Retry`,
      unchanged from the modal.
- [x] 3.2 In `apps/chat/src/i18n/locales/en.json`, rename the
      `scheduledTasks.offlineCredentialsModal` object to
      `scheduledTasks.offlineCredentialsBanner`, drop the `title`
      key's old wording, and set: `title` → `"Log in required."`, `body` →
      `"Scheduled tasks need authorization to run offline."`; keep
      `popupBlockedMessage`/`cancelledMessage`/`timeoutMessage`/
      `failedMessage`/`successAnnouncement` values unchanged; rename
      `loggingInAriaLabel` to `loggingInLabel` (same value, e.g.
      `"Logging in…"` — it is now a visible button label, not an
      `aria-label`); drop `dismissButtonLabel`/`closeAriaLabel`.
      Verify: `npm exec nx lint chat` (catches unused/undeclared key
      references)

## 4. Move gate/login state into `ScheduledTasksPage`

- [x] 4.1 In `apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx`,
      import and call `useOfflineCredentialsGate()` and
      `useOfflineCredentialsLogin()` (both from
      `apps/chat/src/hooks/offlineCredentials/`; the gate gains an explicit
      disconnected-but-unavailable status, while the login hook is unchanged).
- [x] 4.2 Port `resolveModalState`/`handleLogIn` from the current
      `ScheduledTasksRouteGate.tsx` into `ScheduledTasksPage.tsx` as
      `resolveBannerState`/`handleLogIn`, per `design.md` Decision 4:
      drop the `isDismissed` state and the pathname-keyed reset effect (no
      longer needed — the page unmounts/remounts on route change).
- [x] 4.3 Render `<ScheduledTasksLoginBanner state={...} .../>` and pass it
      into `<ScheduledTasks banner={<ScheduledTasksLoginBanner .../>} .../>`,
      resolving every label via `t(ScheduledTasksI18nKeys...)`/
      `t(ButtonsI18nKeys.LogIn)`/`t(ButtonsI18nKeys.Retry)`.
- [x] 4.4 Update `apps/chat/src/pages/ScheduledTasksPage/tests/
      ScheduledTasksPage.spec.tsx`: mock `useOfflineCredentialsGate`/
      `useOfflineCredentialsLogin` (new `vi.mock` blocks, following the
      existing mock pattern for `useScheduledTasks`/`useFeatureFlag` already
      in this file) and add cases mirroring the deleted route-gate/modal
      behavior: banner hidden while checking/connected; banner shown without
      a login action when unavailable-and-disconnected; banner shown with
      "Log in required."/"Log in" when available-and-disconnected;
      clicking "Log in" calls the login hook; each retry outcome
      (blocked/cancelled/timeout/failed) keeps the banner visible with the
      matching message and a working retry click; a successful outcome
      (login hook resolves and a refetch reports `connected: true`) hides
      the banner without a route change; the list/search/sort/create/card
      actions remain clickable while the banner is shown.
      Verify: `npm run test:file -- apps/chat/src/pages/ScheduledTasksPage/
      tests/ScheduledTasksPage.spec.tsx`

## 5. Remove `ScheduledTasksRouteGate` and flatten routes

- [x] 5.1 In `apps/chat/src/app/app.tsx`, delete the `ScheduledTasksRouteGate`
      `lazy()` import (lines ~81-83) and the wrapping `<Route element={<...
      ScheduledTasksRouteGate .../>}>` layout route (lines ~391-439),
      promoting the four child `<Route path={ROUTES.ScheduledTasks*} .../>`
      entries (each already independently wrapped in its own
      `RouteErrorBoundary`/`Suspense`) to top-level siblings at the same
      nesting level as the routes around them.
- [x] 5.2 Delete `apps/chat/src/pages/ScheduledTasksRouteGate/
      ScheduledTasksRouteGate.tsx` and its (empty) directory.
      Verify: `npm exec nx build chat` (route tree still compiles/bundles);
      `grep -r "ScheduledTasksRouteGate" apps/chat/src` returns no matches

## 6. Delete the modal

- [x] 6.1 Delete `apps/chat/src/components/OfflineCredentialsLoginModal/`
      (component file and its `tests/OfflineCredentialsLoginModal.spec.tsx`)
      in full.
      Verify: `grep -r "OfflineCredentialsLoginModal" apps/chat/src`
      returns no matches

## 7. Docs

- [x] 7.1 In `docs/auth/auth-bff-encrypted-cookie.md` §5.6, replace "When the
      check reports `available: true, connected: false`, a modal
      (`OfflineCredentialsLoginModal`) explains that logging in is required
      for scheduled tasks to run and offers a "Log in" action." with a
      description of the inline `ScheduledTasksLoginBanner`, and add that
      the check (and banner) are scoped to the Scheduled Tasks **list**
      route only — `ScheduledTasksRouteGate` no longer exists, and
      create/detail/edit no longer run the check. Update the last bullet
      ("Dismissing the modal only hides it for the current visit...") to
      describe the banner instead — remove the dismiss-specific wording
      since the banner has no dismiss action, and state that it hides once
      `connected` is confirmed `true`.

- [x] 7.2 Update `docs/auth/auth-diagrams/10-offline-credentials-consent.mmd`
      (and its rendered `.svg`, if the diagram depicts the modal/route-gate
      by name) to reflect the banner and the list-page-only scope; re-check
      `docs/auth/auth-diagrams/README.md`'s description of that diagram if it
      names the modal.
- [x] 7.3 In `docs/architecture.md`, remove `ScheduledTasksRouteGate` from
      the `pages/` routes list (the line enumerating
      `ScheduledTasksPage`/`ScheduledTasksRouteGate`/
      `ScheduledTaskCreatePage`/...).
      Verify: `npm run validate:docs`

## 8. Full verification

- [x] 8.1 Run the changed-slice verification and the full non-mutating
      verification: `npm run verify:changed`, then `npm run verify:full`
      before considering the change complete (per the `lean-verification`
      skill) — covers `nx affected -t lint,test,build` for `chat` and
      `scheduled-tasks`, plus `npm run validate:docs`.
      **Deviation, documented rather than silently worked around:**
      `npm run verify:changed`'s `nx affected` invocation is blocked
      workspace-wide by pre-existing breakage unrelated to this change —
      confirmed via `git stash` that `apps/chat-api` has 309 pre-existing
      `tsc` errors on `development` with none of this change's edits
      applied, and separately that `@epam/ai-dial-chat-hooks`'s `typecheck`
      target (an upstream dependency of `@epam/chat`'s build/lint) fails on
      a `mcp-apps`-related module resolution error also present with none
      of this change's edits applied (tracked by the separate, in-progress
      `mcp-apps-support` change at 43/71 tasks per `openspec list`). Neither
      is touched or caused by this change. Ran targeted equivalents instead:
      `npx tsc --noEmit -p apps/chat/tsconfig.app.json --skipLibCheck`
      (clean, apart from the same two pre-existing `mcp-apps`/unrelated
      errors), `npx eslint` on every file this change touches (clean),
      `npm run test:file` on every touched/added spec (all pass), `npm exec
      nx build @epam/chat -- --skip-nx-cache` (the `chat` bundle itself
      builds; the reported failure is the same upstream
      `chat-hooks:typecheck` dependency issue), and `npm run validate:docs`
      (passes).
- [ ] 8.2 Manually exercise the list page in a running app
      (`npm run start:all`) with a stubbed/mocked `available: true,
      connected: false` response: confirm the banner appears without any
      popup opening automatically, the list/search/sort/create/cards stay
      usable, clicking "Log in" opens the OAuth popup, and completing/
      cancelling/blocking the popup drives the banner through the expected
      retry states; then confirm visiting `ROUTES.ScheduledTaskCreate`/
      `ScheduledTaskDetail`/`ScheduledTaskEdit` shows no login-required UI
      and issues no `offline-credentials` request (Network tab).

## 9. Disconnected-but-unavailable status

- [x] 9.1 Add `OfflineCredentialsGateStatus.Unavailable` for
      `{ available: false, connected: false }`, render the warning banner for
      that state, and omit its login action because Core supplies no OAuth
      `connect` settings. Keep the banner hidden only after `connected: true`
      is confirmed.
- [x] 9.2 Cover the hook, page composition, and app-local banner component
      with focused tests for the unavailable state, and update the auth doc,
      diagram source/rendered SVG, proposal, design, and delta spec.
- [x] 9.3 Add diagnostic debug logs around the BFF's Core status/sign-in
      responses, including status and response payload while explicitly
      excluding bearer tokens and authorization-code values; cover the
      redaction requirement with focused backend tests.
