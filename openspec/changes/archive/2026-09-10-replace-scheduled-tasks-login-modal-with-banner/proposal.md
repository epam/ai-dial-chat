## Why

The Scheduled Tasks list page currently interrupts every visit with an
automatically-opened modal (`OfflineCredentialsLoginModal`, shown via
`ScheduledTasksRouteGate`) whenever DIAL Core offline credentials are
`available: true, connected: false`. This blocks the view behind a dialog
before the user has done anything, on every one of the four Scheduled Tasks
routes (list, create, detail, edit). The design reference calls for a
non-blocking inline banner on the list page instead — visible, but not
interrupting — with the OAuth login triggered only by an explicit "Log in"
click. No image file was attached to this conversation turn; the banner's
copy, icon, and trailing-button shape below are taken from the requester's
textual description, and exact colors/spacing/typography are deferred to
existing design-system tokens per `design.md`, not to inferred pixel values.

## What Changes

- Remove the automatically-opened `OfflineCredentialsLoginModal` and the
  `ScheduledTasksRouteGate` layout route that renders it across all four
  Scheduled Tasks routes. **BREAKING (internal only)**: `create`, `detail`,
  and `edit` Scheduled Task pages lose the proactive login prompt entirely —
  see "Impact" and the explicit note in `design.md` Decision 1. No modal or
  popup opens automatically on any Scheduled Tasks route after this change.
- Add a new inline, non-blocking `ScheduledTasksLoginBanner` (app-local,
  `apps/chat/src/components/`), rendered only on the Scheduled Tasks **list**
  page, between the toolbar/search row and the task cards. Hand-compose its
  neutral tokenized surface and warning icon because ui-kit `Notification`
  couples those visuals into incompatible fixed variants; use ui-kit 2.0
  `OutlinedButton` for the trailing "Log in" action. The directional arrow is
  mirrored in RTL, and the action is included only when Core supplies OAuth
  connection settings; the warning remains visible without an action while
  the user is disconnected but login is unavailable.
- Add a `banner?: ReactNode` slot prop to `libs/scheduled-tasks`'s
  `ScheduledTasksProps`/`ScheduledTasks` component, rendered between the
  existing search/sort toolbar and the content region — the lib stays
  host-agnostic (a generic slot, no auth/BFF knowledge), and the app supplies
  the banner instance.
- Move the existing `useOfflineCredentialsGate`/`useOfflineCredentialsLogin`
  composition (status check + OAuth popup flow) from
  `ScheduledTasksRouteGate` into `ScheduledTasksPage`, which now owns the
  banner's visible/retry/logging-in state machine and passes the banner
  instance into `<ScheduledTasks banner={...} />`.
- Reuse the OAuth popup, callback, `BroadcastChannel`, and backend
  verification infrastructure exactly as-is (`useOfflineCredentialsLogin`,
  `ToolsetAuthCallback`, `ROUTES.ToolsetSignIn`) — no new auth mechanism, no
  new backend endpoint.
- Update `docs/auth/auth-bff-encrypted-cookie.md` §5.6 and `docs/architecture.md`
  to describe the inline banner (list-page-scoped) instead of the
  automatically-shown modal, and to drop the removed `ScheduledTasksRouteGate`.
- Update `libs/scheduled-tasks/README.md` for the new `banner` prop.
- Replace the modal's i18n keys/strings with banner-specific ones; reuse
  `ButtonsI18nKeys.LogIn`/`ButtonsI18nKeys.Retry` for the action labels.

## Capabilities

### New Capabilities

_None._ The visible feature (a login-required prompt on Scheduled Tasks) is
not new; it is re-shaped from a global modal into a page-scoped banner. No
new domain capability is introduced.

### Modified Capabilities

- `scheduled-tasks-page-ui`: the `ScheduledTasks` lib component gains a
  `banner` slot rendered between the toolbar and content region.
- `scheduled-tasks-offline-credentials-login`: the login-required UI becomes
  an inline, non-dismissible banner scoped to the list page instead of a
  modal shown across all four Scheduled Tasks routes; the retry/accessibility
  requirements carry over, re-expressed for the new UI shape.
  **Note:** this capability's spec was defined by
  `openspec/changes/add-scheduled-task-offline-credentials-login` (fully
  implemented in the current codebase — see the files inspected in
  `design.md` Context) but that change was never archived into
  `openspec/specs/`, so no baseline file exists at
  `openspec/specs/scheduled-tasks-offline-credentials-login/spec.md`. This
  change's delta is written against that change's (unarchived) delta spec as
  the actual current-behavior baseline, since it — not an empty main spec —
  reflects what the codebase does today. Archiving both changes together (or
  archiving the older one first) will reconcile this.

## Impact

- **`apps/chat/src/pages/ScheduledTasksRouteGate/`**: deleted (component and
  its `lazy()` import/route wrapper in `app.tsx`). Its sole reason to exist
  was rendering the modal across the four routes; with the modal gone, it
  has nothing left to do.
- **`apps/chat/src/app/app.tsx`**: the four Scheduled Tasks `<Route>` entries
  move from children of the `ScheduledTasksRouteGate` layout route to
  top-level siblings (each already independently wrapped in its own
  `RouteErrorBoundary`/`Suspense`, unchanged).
- **`apps/chat/src/pages/ScheduledTaskCreatePage/`, `ScheduledTaskDetailPage/`,
  `ScheduledTaskEditPage/`**: **behavior change** — these three pages no
  longer run any offline-credentials status check and no longer show any
  login-required UI. This is an explicit, intentional narrowing of scope (the
  banner is list-page-only per the design reference), not an oversight;
  `design.md` Decision 1 records the trade-off and the follow-up this opens.
- **`apps/chat/src/components/OfflineCredentialsLoginModal/`**: deleted
  (component + tests), replaced by
  `apps/chat/src/components/ScheduledTasksLoginBanner/`.
- **`apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx`**: gains
  the gate/login hook calls and banner state machine previously owned by
  `ScheduledTasksRouteGate`.
- **`libs/scheduled-tasks`**: `ScheduledTasksProps` gains `banner?: ReactNode`;
  `ScheduledTasks.tsx` renders it between the toolbar and content region;
  `README.md` documents the new prop.
- **`apps/chat/src/constants/translation-keys.ts`,
  `apps/chat/src/i18n/locales/en.json`**: the `OfflineCredentialsModal*` keys
  under the `scheduledTasks` namespace are replaced with
  `OfflineCredentialsBanner*` equivalents.
- **`docs/auth/auth-bff-encrypted-cookie.md`** (§5.6) and
  **`docs/architecture.md`**: updated in the same change per the docs rule.
- **No backend contract or behavior change**: the BFF endpoints and
  `libs/chat-api-client` remain unchanged. The existing `apps/chat-api`
  offline-credentials service only gains debug logging for the Core response
  status/body; authorization codes and bearer tokens are not logged.
- **`useOfflineCredentialsGate`**: distinguishes disconnected-but-unavailable
  from connected/hidden status so the warning remains visible without a
  non-functional action.
- **No change** to `useOfflineCredentialsLogin`, `OAuthResourceKind`, the OAuth
  popup/callback/`BroadcastChannel` infrastructure, or the
  `scheduledTasksEnabled` feature-flag gate.
