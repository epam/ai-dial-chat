# Design: add-sign-out-action-for-external-scheduler-auth-service

## Context

The offline-credentials login flow (`scheduled-tasks-offline-credentials-login` change, on branch `fix/no-indication-when-external-scheduler-auth-service-logged-out`) delivers: `GET /api/v1/offline-credentials` (gate check), `POST /api/v1/offline-credentials/signin` (Core code exchange), `useOfflineCredentialsGate`/`useOfflineCredentialsLogin`, and `ScheduledTasksLoginBanner`. Core additionally exposes `POST /v1/user/offline-credentials/signout` (SDK `offlineCredentialsSignOut`, no body, boolean response, 400/401/500 error shape) — unused anywhere in this repo. This change adds the symmetric revoke chain. NestJS conventions per `apps/chat-api/AGENTS.md` apply throughout; this design does not restate them.

## Goals / Non-Goals

**Goals:**
- A user can revoke the per-user offline-credentials grant from the Scheduled Tasks list page, with confirmation, and re-establish it through the existing login flow.
- The revocation is authoritative: a fresh gate refetch (not the POST's own 200) decides what the UI shows next.

**Non-Goals:**
- Auto-signout on a broken/revoked-upstream grant (#9108 open question 1 — needs architecture input).
- Changes to the login flow, banner behavior, or gate check timing.
- Server-side task cancellation on signout (Core's concern).

## Decisions

### D1 — BFF endpoint mirrors `signin`, 404-idempotent
`POST /api/v1/offline-credentials/signout` in `OfflineCredentialsController` + `OfflineCredentialsService.signOut(accessToken)` calling `dialClient.client.offlineCredentialsSignOut({ headers })`. No body. Returns the existing `OfflineCredentialsAuthResultDto` (`{ success: boolean }`) — no new DTO. A Core **404 is idempotent success** (no grant left), mirroring `ExternalServicesService.signOut` (`apps/chat-api/src/external-services/external-services.service.ts:249-293`); other errors map via `mapDialHttpStatus`/`handleDialFetchError` exactly as `signIn` does. Falsy Core data → 502, mirroring `signIn`'s guard. Authorization: session-authenticated user; `@RequireFeature(ScheduledTasksEnabled, LiveChatInteraction)` per-handler (class-level placement silently no-ops per the controller's own comment).
*Alternative rejected:* separate `OfflineCredentialsSignoutResultDto` — the shape is identical; reuse.

### D2 — Generated-client regen, no `ApiEndpoints` entry
`npm run openapi` regenerates `libs/chat-api-client` (spec built in-process; no running server needed). Wrapper `signOutOfflineCredentials()` in `apps/chat/src/server-api/offline-credentials.ts`, mirroring `signInOfflineCredentials`. No `ApiEndpoints` enum entry — offline-credentials is a generated-client domain; `base.ts` is for hand-written helpers only.

### D3 — Gate exposes `connected` explicitly
`UseOfflineCredentialsGateResult` gains `connected: boolean`, tracked as state next to `status` and set in `fetchStatus` from the same Core response (same field name as `OfflineCredentialsStatusResult.connected`). The Disconnect affordance renders on `connected === true`.
*Alternative rejected:* keying off `status === Hidden` — equivalent today but couples the affordance to an enum member named "no UI needed". Only two consumers exist (the page; `useOfflineCredentialsLogin`'s use of `refetch`).

### D4 — Lib stays host-agnostic; app owns the flow
`@epam/ai-dial-scheduled-tasks` `ScheduledTasks` gains optional `onDisconnectClick?: () => void` + `disconnectButtonLabel`/`disconnectAriaLabel` on `ScheduledTasksLabels`; nothing renders without the callback. Host knowledge (gate state, feature flags, API) stays in `ScheduledTasksPage` — the lib receives a callback and strings, same contract as `onCreateClick` (AGENTS.md §Library isolation satisfied). Button: secondary kit button next to `PrimaryButton` in a right-side `flex gap-2 shrink-0` wrapper; `IconLogout` (`@tabler/icons-react` — the repo's existing logout glyph, `libs/catalog/src/components/Details/Header/Header.tsx:869`, symmetric → no RTL mirror), `aria-hidden`, `DIAL_KIT_ICON_STROKE`.
Mobile collapse: refactor `ScheduledTasks.module.scss`'s `.createButtonLabel`/`.createButton` rules (label-span hide below 1280px, 40px-circle pill below 1280px, self-chained specificity + `MOBILE_MAX_WIDTH_PX` comment) into one shared class pair applied to **both** header buttons — no duplicated media-query blocks.

### D5 — Confirmation dialog mirrors `LogoutConfirmationModal`
App-level ui-kit 2.0 `ConfirmationPopup` (header/description/confirmLabel/onConfirm/onCancel/onClose) — the repo's closest page-level "log out" confirm (`apps/chat/src/components/LogoutConfirmation/LogoutConfirmationModal.tsx:37-47`). Open/close via `useState`; async-guard confirm handler mirrors `ScheduledTaskDetailPage`'s delete flow (`isDisconnecting` guard; re-entry blocked while in flight).
*Alternative rejected:* in-row confirm mirroring `libs/catalog`'s `ApplicationCredentialRow` — that pattern lives in a dense table row, not a page header.

### D6 — Refetch is authoritative, banner reappears for free
`handleDisconnect`: `await signOutOfflineCredentials()` → `await refetchCredentials()` → close dialog + `setLiveAnnouncement(...)`. On refetch reporting `connected: false`, `resolveBannerState` already returns `Shown` — the login banner reappears through existing machinery. The success announcement flows through the banner component's existing `liveAnnouncement` polite region. Failure keeps the dialog open; no state change to the button beyond the in-flight disable. I18n: new keys under the `scheduledTasks` namespace in `ScheduledTasksI18nKeys` (dialog title, dialog description stating the consequence — future scheduled tasks stop running — button label, success announcement); `ButtonsI18nKeys.Cancel` reused; `en.json` grepped for existing generic values before any new short label (duplicate-value rule).

## Risks / Trade-offs

- [Core returns `false` (boolean) without an error] → treated like `signIn`'s falsy-data guard: 502 "Core reported failure". The user sees the failure state and can retry; nothing is silently reported as revoked.
- [Signout POST succeeds but refetch fails] → dialog stays open with an error; gate stays on last known state; the banner does not falsely appear (matches the login flow's "refetch is the only authority" rule).
- [User revokes while tasks are mid-run] → the dialog description states the consequence up front; running-task cancellation is out of scope (Core's concern).
- [Two header circles on narrow viewports] → shared collapse class keeps both buttons at 40px; the header row's existing `flex justify-between` absorbs it.

## Migration Plan

Additive; no migration. Implementation slices (each verified and confirmed before the next): 0 — branch `feat/add-sign-out-action-for-external-scheduler-auth-service` off the login-indication branch; 1 — BFF endpoint + tests; 2 — client regen + wrapper + docs; 3 — gate `connected`; 4 — lib header action; 5 — app confirmation + handler + i18n; 6 — full test/doc sweep + five-axis review. Rollback: remove the endpoint, regenerate the client, drop optional props — no existing consumer changes.

## Open Questions

- Dialog/button wording ("Disconnect" vs "Sign out") — resolved during the i18n slice by grepping `en.json` for existing values per the duplicate-key rule.
- Whether `docs/auth/auth-diagrams/10-offline-credentials-consent.*` needs a signout leg — checked during the docs slice; redraw only if the diagram would otherwise misrepresent the flow.
