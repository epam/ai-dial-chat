# Proposal: add-sign-out-action-for-external-scheduler-auth-service

## Why

DIAL Core stores a per-user offline-credentials OAuth grant that lets scheduled tasks run without the user's live session. The login flow (issue: `scheduled-tasks-offline-credentials-login` change) lets the user create that grant, but there is no way to revoke it: Core exposes `POST /v1/user/offline-credentials/signout` (SDK op `offlineCredentialsSignOut`, unused in this repo) and neither chat-api nor the app proxies it. Signing out of DIAL Chat does not revoke the grant, so scheduled tasks keep running under a stale external-service grant with no user control.

GitHub issue: [epam/ai-dial-chat#9108](https://github.com/epam/ai-dial-chat/issues/9108).

## What Changes

- **BFF:** new `POST /api/v1/offline-credentials/signout` in the existing `offline-credentials` domain, proxying Core's `POST /v1/user/offline-credentials/signout` via `DialClientService` with the session bearer token. A Core 404 is treated as idempotent success (no grant left to revoke). No request body; no secrets logged.
- **Generated client + wrapper:** regenerate `@epam/ai-dial-chat-api-client` (adds `signOutOfflineCredentials`); add the wrapper in `apps/chat/src/server-api/offline-credentials.ts`.
- **Gate hook:** `useOfflineCredentialsGate` result additionally exposes the last resolved `connected` boolean (alongside `status`), so the disconnect affordance's render condition is an explicit contract.
- **Lib:** `@epam/ai-dial-scheduled-tasks`' `ScheduledTasks` header gains an optional second action button ("Disconnect"), rendered only when the host passes the callback; mobile collapse refactored into one shared CSS class pair applied to both header buttons.
- **App:** `ScheduledTasksPage` renders the Disconnect button (next to "+ New task") only when the gate reports `connected: true`, behind a `ConfirmationPopup`; on confirm it calls signout, refetches the gate (authoritative), closes the dialog, and announces success — after which the existing login banner reappears.
- **Docs:** `docs/auth/auth-bff-encrypted-cookie.md` endpoint enumeration for the domain; `docs/architecture.md` prose check; lib README.

## Non-goals

- Automatic signout on a broken/revoked-upstream grant (issue #9108 open question 1 — needs architecture input; not part of this change).
- Any change to the login flow, banner behavior, or gate check timing.
- Server-side scheduled-task cancellation on signout — running tasks are Core's concern.

## Capabilities

### New Capabilities

- `scheduled-tasks-offline-credentials-signout`: the app-level signout flow — gate-exposed `connected` driving the disconnect affordance, the confirmation dialog, the refetch-authoritative signout handler, banner reappearance, accessibility announcements, and i18n keys.

### Modified Capabilities

- `offline-credentials`: the BFF domain gains a requirement for the signout endpoint (Core proxy, 404-idempotent, feature-gated, session auth).
- `scheduled-tasks-page-ui`: the `ScheduledTasks` lib header requirement gains the optional second action (conditional render, label/aria from `labels`, shared mobile-collapse class, no host imports).

## Impact

- **Code:** `apps/chat-api/src/offline-credentials/` (controller, service, existing specs), `libs/chat-api-client` (generated — regen via `npm run openapi`), `apps/chat/src/server-api/offline-credentials.ts`, `apps/chat/src/hooks/offlineCredentials/useOfflineCredentialsGate.ts` (+ spec), `libs/scheduled-tasks` (props model, header JSX, `ScheduledTasks.module.scss`, README, tests), `apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx` (+ spec).
- **Scope-creep flag (shared lib touched):** `libs/scheduled-tasks` changes are additive and host-agnostic — the lib receives `onDisconnectClick?: () => void` + label fields via props and renders nothing without the callback; no feature-flag, auth, API, or routing knowledge enters the lib (isolation rule respected).
- **i18n:** new user-visible strings — dialog title, dialog description (states the consequence: future scheduled tasks stop running), disconnect button label, success announcement. Keys under the `scheduledTasks` namespace in `ScheduledTasksI18nKeys`; generic values reused from `ButtonsI18nKeys` where they exist (e.g. Cancel). Only `en.json` exists today.
- **API compatibility:** purely additive endpoint + client operation + optional props. No breaking change.

## Alternatives considered

- **Gate consumers could use `status === Hidden` as the connected signal** (technically equivalent today) — rejected: it couples the affordance to an enum member named "no UI needed"; the explicit `connected` boolean is the contract the button renders on.
- **In-row confirm (no dialog), mirroring `libs/catalog`'s `ApplicationCredentialRow`** — rejected: the repo's closest *page-level* destructive-action precedent (`LogoutConfirmationModal`, `ScheduledTaskDeleteConfirmation`) uses a dialog, and revoking silently stops future scheduled runs.
- **Status chip in the page body instead of a header button** — rejected by user decision (issue #9108 conversation): the action belongs in the header row next to "+ New task", where task management actions live.

## Acceptance criteria

- Signout revokes the grant: the gate refetch reports `connected: false` and the login banner reappears.
- The Disconnect button renders only when `connected: true`; nothing renders otherwise.
- Confirmation is required before the revoke; failure keeps the dialog open.
- The endpoint is gated by `scheduledTasksEnabled`/`liveChatInteraction`, requires a session, treats Core 404 as success, and logs no secrets.
- Unit tests cover controller, service, gate, lib, and page; docs updated in the same change (`to-be-documented` label on #9108).

## Rollback / backward compatibility

Additive only — revert by removing the endpoint, regenerating the client, and dropping the optional props; no existing consumer changes behavior. The lib's optional props default to "render nothing extra".
