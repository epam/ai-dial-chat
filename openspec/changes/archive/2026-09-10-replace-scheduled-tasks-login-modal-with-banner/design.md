## Context

Today, `apps/chat/src/pages/ScheduledTasksRouteGate/ScheduledTasksRouteGate.tsx`
is a shared parent layout `<Route>` element wrapping all four Scheduled Tasks
routes (`ROUTES.ScheduledTasks`/`ScheduledTaskCreate`/`ScheduledTaskDetail`/
`ScheduledTaskEdit`, wired in `apps/chat/src/app/app.tsx:391-439`). It calls
`useOfflineCredentialsGate()` (`apps/chat/src/hooks/offlineCredentials/
useOfflineCredentialsGate.ts`) once per route entry, and renders
`OfflineCredentialsLoginModal` (`apps/chat/src/components/
OfflineCredentialsLoginModal/OfflineCredentialsLoginModal.tsx`, built on the
ui-kit 2.0 `Popup`) automatically whenever the check reports
`available: true, connected: false`. Clicking "Log in" in that modal calls
`useOfflineCredentialsLogin()` (`apps/chat/src/hooks/offlineCredentials/
useOfflineCredentialsLogin.ts`), which opens a same-origin OAuth popup via the
shared toolset OAuth popup/callback/`BroadcastChannel` infrastructure
(`OAuthResourceKind.OfflineCredentials`, `ROUTES.ToolsetSignIn`) and treats a
fresh `GET /api/v1/offline-credentials` refetch — not the raw callback result
— as authoritative for success. This whole flow was specified and implemented
by `openspec/changes/add-scheduled-task-offline-credentials-login/` (its
`tasks.md` shows every task checked off; the code exists exactly as its
`design.md` describes), but that change was never run through `/opsx:archive`,
so `openspec/specs/scheduled-tasks-offline-credentials-login/spec.md` does
not exist — only the change's own delta spec does.

The design reference for this change replaces the automatically-opened modal
with a non-blocking inline banner on the Scheduled Tasks **list** page only,
matching the visual pattern already used for the "no offline credential"
warning in the reference design: an icon, a bold "Log in required." line,
supporting text, and a trailing "Log in" action with a directional arrow.
`libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx`
already renders the list page's header, search/sort toolbar, and content
region as one component; there is no existing seam for the app to inject
banner content between the toolbar and the cards.

`@epam/ai-dial-ui-kit` was inspected through its component manifest and
compiled component constants because its MCP tools were unavailable in this
session. Its 2.0 `Notification` fixes icon and background together per
variant: `Warning` supplies the correct triangle but a yellow surface, while
`General` supplies the reference's neutral surface but a checkmark. Since it
has no icon override, `ScheduledTasksLoginBanner` hand-composes the container
from the same design tokens and typography utilities and uses the supported
ui-kit 2.0 `OutlinedButton` for its action. No new ui-kit-level component is
needed.

## Goals / Non-Goals

**Goals:**

- Replace the automatic modal with a non-blocking inline banner, shown only
  on the Scheduled Tasks list page, between the toolbar and the cards.
- Reuse `useOfflineCredentialsLogin` and the OAuth popup/callback/
  `BroadcastChannel` infrastructure unchanged, while extending
  `useOfflineCredentialsGate` with an explicit disconnected-but-unavailable
  status.
- Give `libs/scheduled-tasks` a host-agnostic slot for the banner rather than
  teaching the lib anything about auth, OAuth, or BFF status.
- Preserve every retry/accessibility guarantee the modal had (popup-blocked,
  cancelled, timed-out, failed retry states; keyboard operability;
  `aria-live` outcome announcements) in the new banner shape.
- Keep the backend/BFF/API contract and runtime behavior unchanged apart from
  diagnostic debug logs that expose Core's response status/body without
  logging bearer tokens or authorization codes.

**Non-Goals:**

- Adding a login-required prompt to the create/detail/edit Scheduled Task
  pages in any form (banner or otherwise) — see Decision 1 for why removing
  the modal there is an accepted, documented narrowing rather than a like-for-like
  port.
- A dismiss/close action on the banner. The modal's dismiss button hid it for
  the current route visit; the reference banner has no such control, and the
  requirement text does not ask for one — the banner simply reflects current
  status and disappears once `connected: true`.
- Any contract or functional change to `apps/chat-api`'s offline-credentials
  BFF domain, its DTOs, or `libs/chat-api-client`; diagnostic service logging
  is the only backend edit.
- Any change to `OAuthResourceKind`, `ToolsetAuthCallback`, or the shared
  OAuth popup/`BroadcastChannel` utilities.
- A new feature flag — still gated by the existing `scheduledTasksEnabled`
  flag, unchanged (the list page renders `NotFoundPage` when the flag is
  off). Note this only gates the rendered UI: `useOfflineCredentialsGate`
  and `useOfflineCredentialsLogin` are called unconditionally at the top of
  `ScheduledTasksPage`, before the flag check, so the `GET
  /api/v1/offline-credentials` request still fires once even when the flag
  is off — carried over unchanged from the deleted `ScheduledTasksRouteGate`,
  which had the identical unconditional call.

## Decisions

### 1. Delete `ScheduledTasksRouteGate`; scope the check to the list page only

`ScheduledTasksRouteGate`'s only responsibility was rendering the modal across
all four routes. Once the modal is gone, the wrapper renders nothing but
`<Outlet />` — a layer that does nothing is dead code, not an abstraction
worth preserving "just in case." This design deletes the file and its `lazy()`
import/route wrapper in `app.tsx`, and moves the four child `<Route>` entries
(`ScheduledTasksPage`/`ScheduledTaskCreatePage`/`ScheduledTaskDetailPage`/
`ScheduledTaskEditPage`) to be top-level siblings of the other routes — each
already independently wrapped in its own `RouteErrorBoundary`/`Suspense`
(`app.tsx:400-439`), so no error-boundary coverage is lost.

`useOfflineCredentialsGate()`/`useOfflineCredentialsLogin()` move into
`ScheduledTasksPage.tsx` directly — the only page that still needs them.

**Explicit, accepted impact:** `ScheduledTaskCreatePage`, `ScheduledTaskDetailPage`,
and `ScheduledTaskEditPage` stop running the offline-credentials status check
and stop showing any login-required UI after this change. This is a direct
consequence of the two explicit requirements "scope the new banner to the
Scheduled Tasks list page" and "do not automatically open a modal or popup
when the page loads" — there is no remaining UI on those three pages for the
check to drive, and the requirement author's "document any such impact
explicitly" instruction is satisfied by this paragraph, `proposal.md`'s
Impact section, and the REMOVED requirement in
`specs/scheduled-tasks-offline-credentials-login/spec.md`.

**Alternative considered and rejected:** keep `ScheduledTasksRouteGate`
running the status check on all four routes (for some future re-use) while
only the list page renders a banner from it via context. Rejected: this
reintroduces the exact global-vs-route-scoped trade-off the original design
already resolved in favor of narrow scoping (`add-scheduled-task-offline-
credentials-login/design.md` Decision 3 — "irrelevant outside Scheduled
Tasks... burns a BFF call + rate-limit budget"), except now scoped to three
routes with no UI consumer at all — strictly worse than not checking. If a
future change needs the equivalent nudge on create/detail/edit, it can re-add
a route-scoped hook call there deliberately, informed by whatever UI that
change actually wants (a banner, an inline note, etc.) rather than inheriting
this change's list-page banner assumptions.

### 2. `banner` slot on `libs/scheduled-tasks`'s `ScheduledTasksProps`

Add:

```ts
export interface ScheduledTasksProps {
  // ...existing fields unchanged...
  /** Optional content rendered between the search/sort toolbar and the content region (e.g. a status banner). Renders nothing when omitted. */
  banner?: ReactNode;
}
```

Rendered in `ScheduledTasks.tsx` immediately after the existing toolbar
`<div className="flex flex-wrap items-center gap-3">...</div>` block and
before the `<span role="status" aria-live="polite">` status-message span and
content region — i.e. exactly "between the toolbar/search area and the
scheduled-task cards" per the requirement. The lib takes no opinion on what
`banner` contains (no auth import, no `OfflineCredentials*` type) — it is a
plain `ReactNode` slot, identical in spirit to how the lib already accepts
`onCreateClick`/`onRetry` as opaque callbacks. This keeps the Library
Isolation rule intact: all offline-credentials/auth/OAuth knowledge stays in
`apps/chat`.

**Alternative considered and rejected:** a boolean-plus-props API
(`showLoginBanner`, `onLoginBannerAction`, `loginBannerLabels`, etc.) that
lets the lib render its own banner markup. Rejected: this would force the
lib to know the banner is specifically about "login," own its icon/variant
choice, and grow a labels/colors/typography surface for one narrow app
concern — exactly the kind of host-owned detail the Library Isolation rule
keeps out of `libs/*`. A `ReactNode` slot is strictly simpler and needs no
lib-side i18n/labels at all.

### 3. `ScheduledTasksLoginBanner` — new app-local component, hand-composed from ui-kit primitives

New file: `apps/chat/src/components/ScheduledTasksLoginBanner/
ScheduledTasksLoginBanner.tsx`. Plain, typed-props component (no SDK/route/
context import), structurally parallel to the deleted
`OfflineCredentialsLoginModal` but rendering inline instead of in a `Popup`:

```tsx
<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-layer-sunken p-3">
  <div className="flex min-w-0 flex-1 items-center gap-2">
    <IconAlertTriangleFilled aria-hidden size={DIAL_ICON_SIZE.LG} className="shrink-0 text-warning-icon" />
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-primary">
      <span className="dial-small-paragraph-semi-text min-w-0 break-words">{title}</span>   {/* "Log in required." */}
      <span className="dial-small-paragraph-text min-w-0 break-words">{body}</span>          {/* "Scheduled tasks need authorization to run offline." — constant, per the requirement's literal fixed copy; never replaced by a retry message */}
    </div>
  </div>
  {onLogIn && (
    <OutlinedButton
      label={isLoggingIn ? loggingInLabel : isRetry ? retryButtonLabel : loginButtonLabel}
      disabled={isLoggingIn}
      iconAfter={<IconArrowRight size={DIAL_ICON_SIZE.SM} stroke={DIAL_KIT_ICON_STROKE} aria-hidden className="rtl:scale-x-[-1]" />}
      onClick={onLogIn}
      className="min-h-11 min-w-11 shrink-0"
    />
  )}
  <span role="status" aria-live="polite" className="sr-only">{isRetry ? retryMessage : ''}</span>
</div>
```

**Correction discovered against the Figma reference (`https://www.figma.com/design/
QMWaL8m8tFmoekQKxIH569/DIAL-Chat-2.0--Scheduled-tasks?node-id=630-13770`,
supplied as a screenshot — no Figma MCP tool was connected in this session, so
the frame was read from the pasted image, not fetched via `get_design_context`):
the banner initially wrapped the ui-kit 2.0 `Notification` component
(`variant={NotificationVariant.Warning}`, `type={NotificationType
.SectionMessage}`), which couples one fixed background to one fixed icon per
variant (`Warning` → `bg-warning` (`#faf0cf`, pale yellow) + `IconAlertTriangleFilled`
tinted `text-warning`; confirmed from `notificationVariantClassNameMap`/
`variantIcons` in `node_modules/@epam/ai-dial-ui-kit/dist/components/New/
Notification/constants.js`). The reference design instead pairs a **neutral**
surface (`bg-layer-sunken`, `#eef1f7`) with the warning triangle icon — a
combination no single `NotificationVariant` produces (`General`, the
variant that does use `bg-layer-sunken`, renders a checkmark icon instead).
Since `Notification` exposes no icon-override prop, and forcing its
background/icon color via `!important`-prefixed override classes would fight
the component's own variant coupling rather than compose with it, the banner
is hand-rolled instead: a `role="alert"` container with the same
`items-center justify-between gap-3 rounded-xl p-3` shape `Notification`
itself uses (mirrored from its `alertBaseClassName`), `bg-layer-sunken` for
the surface, `IconAlertTriangleFilled` explicitly colored via the confirmed
`text-warning-icon` utility class (`#eec840`), and the exact same
`dial-small-paragraph-semi-text`/`dial-small-paragraph-text` title/message
pairing `Notification`'s own `SectionMessage` mode renders internally (so the
typography stays identical to what the ui-kit component would have produced
— only the color pairing changes). This keeps every color and typography
value a real design-system token; nothing is a hand-picked hex.

`OutlinedButton` is the ui-kit 2.0 wrapper for the supported neutral outlined
combination and matches the reference's compact outlined action. It avoids
the unsupported `ButtonVariant.Secondary` + `ButtonAppearance.Outlined`
combination, which falls back to primary-solid styling at runtime.

**Correction discovered during implementation:** the deleted modal passed a
separate `aria-label` alongside a stable string `label` to convey the
logging-in state without changing the visible label — but the real 2.0
`Button` (`node_modules/@epam/ai-dial-ui-kit/dist/src/components/New/Button/
Button.d.ts`) takes its accessible name from a **string** `label` first;
`aria-label` is only consulted when `label` is absent or a non-string
`ReactNode`. Since this component's `label` is always a string, an `aria-label`
alongside it would be silently ignored for the accessible name. The banner
therefore swaps the button's **visible** `label` itself to `loggingInLabel`
during `LoginInProgress` (there is no separate `loggingInAriaLabel` prop) —
simpler, and correct against the component actually used, satisfying
"meaningful button labeling" without relying on a precedence rule the real
component doesn't implement. `specs/scheduled-tasks-offline-credentials-
login/spec.md`'s "Logging-in state is exposed on the button" scenario is
written against this corrected behavior.

`liveAnnouncement` itself is rendered from a *different* early-return branch —
when `state === undefined` (banner not shown), exactly mirroring the deleted
modal's "renders nothing visible" contract, so a transient post-hide success
announcement (e.g. "You're logged in.") can still reach assistive tech after
the banner itself has unmounted:

```tsx
if (state === undefined) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {liveAnnouncement}
    </span>
  );
}
```

Because `title`/`body` never change value across retry-state transitions,
and the `retryMessage` text lives only in the nested `sr-only` polite span, a
retry transition mutates only that one nested node — the outer `role="alert"`
container's own title/body text is untouched, so the transition does not
re-trigger the container's own assertive announcement. This is the mechanism
behind the "Retry-state transitions are announced politely...without
re-triggering the banner's own assertive `role="alert"` announcement"
requirement in `specs/scheduled-tasks-offline-credentials-login/spec.md`.

State enum, carried over from `OfflineCredentialsModalState` minus the
dismiss-only concept (no `Available`/`isDismissed` split — the banner has no
dismiss action, so "available" is just "shown"):

```ts
export enum ScheduledTasksLoginBannerState {
  Shown = 'shown',
  LoginInProgress = 'login-in-progress',
  RetryPopupBlocked = 'retry-popup-blocked',
  RetryCancelled = 'retry-cancelled',
  RetryTimeout = 'retry-timeout',
  RetryFailed = 'retry-failed',
}
```

`state: ScheduledTasksLoginBannerState | undefined` — `undefined` renders
nothing (matching the modal's own contract for its "checking/hidden/error"
gate states), so `ScheduledTasksPage` decides *whether* to render the banner
at all, and the banner component itself only ever decides *which* message/
button-label pair to show. The banner is never dismissible — every render
where `state !== undefined` shows the icon/title/message, while the button is
rendered only when the optional `onLogIn` callback is present. There is no
`onClose` prop. `ScheduledTasksPage` omits `onLogIn` when Core reports
`available: false` because the response contains no usable `connect` settings.

The action uses ui-kit 2.0 `OutlinedButton`, whose predefined neutral outlined
combination matches the reference's outline pill and is supported by the
installed design system.

### 4. State ownership moves to `ScheduledTasksPage`

`ScheduledTasksPage.tsx` gains the same state machine
`ScheduledTasksRouteGate` used to own (`retryState`, `isLoggingIn`,
`liveAnnouncement` — no `isDismissed`, per Decision 3), driven by
`useOfflineCredentialsGate()`/`useOfflineCredentialsLogin()` called directly
in the page. `resolveModalState` becomes `resolveBannerState`, dropping the
`isDismissed` branch:

```ts
const resolveBannerState = ({
  isLoggingIn,
  retryState,
  status,
}: {
  isLoggingIn: boolean;
  retryState: ScheduledTasksLoginBannerState | undefined;
  status: OfflineCredentialsGateStatus;
}): ScheduledTasksLoginBannerState | undefined => {
  if (isLoggingIn) return ScheduledTasksLoginBannerState.LoginInProgress;
  if (retryState) return retryState;
  if (
    status === OfflineCredentialsGateStatus.Available ||
    status === OfflineCredentialsGateStatus.Unavailable
  ) {
    return ScheduledTasksLoginBannerState.Shown;
  }
  return undefined;
};
```

No pathname-keyed reset effect is needed (the gate's own `useLocation`-keyed
refetch in `useOfflineCredentialsGate` already re-runs on navigation into the
list route; `ScheduledTasksPage` itself unmounts/remounts on route change like
any other route element, so its local `retryState`/`isLoggingIn` state is
naturally fresh on each entry — the old gate's dismiss-reset effect existed
only to un-dismiss the modal across sibling-route navigation *without*
remounting the gate, which no longer applies once there is no shared parent
route).

`useOfflineCredentialsGate` adds an explicit `Unavailable` state for
`available: false, connected: false`; `Hidden` is now reserved for a confirmed
`connected: true` response. `useOfflineCredentialsLogin` remains unchanged.

### 5. No Redux store domain

Unchanged from the original design (`add-scheduled-task-offline-credentials-
login/design.md` Decision 4): this remains route-local UI state, now owned by
`ScheduledTasksPage` instead of `ScheduledTasksRouteGate`, not a store domain.

### 6. Accessibility (WCAG 2.1 AAA)

- The banner's own `role="alert"` (assertive, chosen to match the severity
  `Notification`'s `notificationVariantRoleMap[Warning]` would have assigned)
  announces itself once, on becoming visible, which is correct for a
  page-load-time warning the user has not yet acted on. The retry-state
  transitions inside an already-visible banner use a nested
  `role="status" aria-live="polite"` span (Decision 3's `retryMessage` span,
  distinct from the `liveAnnouncement` span used only while the banner is
  hidden) so a blocked/cancelled/timeout/failed transition is announced
  without re-triggering the assertive top-level alert semantics on every
  retry.
- `aria-busy` is not applicable in the same way the modal used it (no
  container semantics change while logging in); instead the "Log in" button
  itself exposes its busy state by changing its own visible label to
  `loggingInLabel` while `disabled` (see Decision 3's correction — not via
  `aria-label`, which the real `Button` component would ignore alongside a
  string `label`).
- The "Log in"/"Retry" button is ≥44×44 CSS px (`min-h-11 min-w-11`, same
  convention the modal used).
- No focus-trap/restore logic is needed — unlike the modal, the banner is
  inline page content, not an overlay; standard tab order applies.
- The banner's icon is `aria-hidden` (decorative, redundant with the
  `role="alert"` region's own text) per `.claude/rules/a11y.md`.
- All spacing/layout inside the new component uses logical properties
  (`ms-*`/`me-*`/`gap-*`, no `ml-*`/`mr-*`); the trailing arrow icon is
  mirrored via `rtl:scale-x-[-1]`, matching the existing pattern in
  `ScheduledTaskConversationBanner.tsx:130-135` and
  `NotFound.tsx:99` for the same "forward" affordance.
- Mobile/desktop: the banner's mobile-first `flex flex-wrap` container and
  `min-w-0 break-words` text allow the action to wrap below long copy at narrow
  widths rather than truncating; no unsupported breakpoint prefixes or direct
  viewport reads are introduced. A live 360px visual check remains in task
  8.2.

### 7. i18n

Replace, under the existing `ScheduledTasksI18nKeys` enum
(`apps/chat/src/constants/translation-keys.ts`) and the `scheduledTasks`
namespace in `apps/chat/src/i18n/locales/en.json`:

**Removed** (the modal-only keys, no banner equivalent needed):
`OfflineCredentialsModalTitle`, `OfflineCredentialsModalBody`,
`OfflineCredentialsModalDismissButtonLabel`,
`OfflineCredentialsModalCloseAriaLabel`.

**Added**, under a new `offlineCredentialsBanner` JSON key (title/body copy
match the requirement's literal reference text; retry/announcement copy
carries the modal's existing wording forward unchanged since those messages
are still accurate):

- `OfflineCredentialsBannerTitle` → `"Log in required."`
- `OfflineCredentialsBannerBody` → `"Scheduled tasks need authorization to run offline."`
- `OfflineCredentialsBannerPopupBlockedMessage`
- `OfflineCredentialsBannerCancelledMessage`
- `OfflineCredentialsBannerTimeoutMessage`
- `OfflineCredentialsBannerFailedMessage`
- `OfflineCredentialsBannerSuccessAnnouncement`
- `OfflineCredentialsBannerLoggingInLabel` (the button's own visible label
  while logging in — see Decision 3's correction; not an `aria-label`)

**Reused unchanged** (per the "avoid duplicate translation values" rule):
`ButtonsI18nKeys.LogIn` (`"Log in"`) for the primary action label,
`ButtonsI18nKeys.Retry` (`"Retry"`) for the retry action label — the banner
never re-declares these as feature-scoped keys.

Only `en.json` exists today (`apps/chat/src/i18n/locales/` has no other
locale files yet, confirmed by listing the directory), so no `ar.json`
update is needed; RTL layout correctness (Decision 6) is independent of
locale-file presence.

## Risks / Trade-offs

- **[Risk]** Removing the check from create/detail/edit means a user who
  never visits the list page (e.g. always deep-links to a task's detail page)
  gets no nudge at all to complete offline-credentials consent, and their
  scheduled task keeps silently failing unattended. → **Mitigation**: this
  is the explicit scope the requirement asked for; the original design's
  Risk section already accepted "no further nudge beyond the current page
  visit" as out of scope for run-failure surfacing (a run-history/
  notification concern). This change does not make that risk worse for users
  who do visit the list — it only removes a redundant prompt from three
  pages that had no purpose-built UI for it in the reference design.
- **[Risk]** Hand-rolling the banner's markup instead of delegating to
  `Notification` duplicates a small amount of layout/typography the kit
  component would otherwise own, and a future kit-wide visual refresh to
  `Notification` would not automatically propagate here. → **Mitigation**:
  every class used (`bg-layer-sunken`, `text-warning-icon`,
  `dial-small-paragraph-semi-text`/`dial-small-paragraph-text`) is a real,
  confirmed design-system token, not an invented value, so a token-level
  theme change (e.g. a new `--bg-layer-sunken` value) still propagates
  automatically; only a *structural* kit change (a new spacing/typography
  scale) would need a matching manual update here, caught by visual review.
- **[Trade-off]** No single `NotificationVariant` pairs a neutral background
  with a warning icon, so this component cannot be swapped back to
  `Notification` without either losing the reference design's neutral
  surface or its warning icon. → **Mitigation**: flagged to the ui-kit team
  as a potential gap (a `Warning`-icon + neutral-background combination, or
  an icon-override prop on `Notification`) rather than silently worked
  around with `!important` overrides on a semantic variant.
- **[Trade-off]** The banner is not dismissible, unlike the modal. This
  matches the requirement's description (no dismiss/close button mentioned)
  and is simpler to reason about (one fewer piece of state), at the cost of
  the banner persisting until the user either logs in or navigates away —
  accepted as intentional, matching "Keep the banner visible... allow retry."

## Migration Plan

1. Add the `banner` slot to `libs/scheduled-tasks` (additive, non-breaking —
   existing consumers that don't pass `banner` see no change).
2. Build `ScheduledTasksLoginBanner` and wire it into `ScheduledTasksPage`
   alongside the moved gate/login hooks; verify the list page behaves
   identically in status/OAuth terms to today, just with a banner instead of
   a modal.
3. Remove `ScheduledTasksRouteGate` and flatten the four routes in `app.tsx`.
4. Delete `OfflineCredentialsLoginModal` + its test, and the now-unused
   modal-only i18n keys.
5. Update `docs/auth/auth-bff-encrypted-cookie.md` §5.6 and
   `docs/architecture.md` in the same change (per AGENTS.md's docs rule).
6. Rollback: revert the frontend and diagnostic-logging edits; there is no API
   contract, data migration, or feature-flag change, so a plain revert restores
   the modal/gate behavior exactly.

## Open Questions

- Whether `ScheduledTaskCreatePage`/`DetailPage`/`EditPage` should eventually
  get their own equivalent nudge (banner or otherwise) now that
  `ScheduledTasksRouteGate` is gone. Out of scope for this change per the
  explicit requirement; left as a follow-up for whoever owns that decision.
