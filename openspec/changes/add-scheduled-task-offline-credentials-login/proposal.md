## Why

Scheduled Tasks run unattended, on a cron trigger, with nobody present to
click through an interactive OAuth popup at execution time. DIAL Core's
`0.1.0-dev.37` TypeScript SDK (upgrading from the currently pinned
`0.1.0-dev.31`, see `apps/chat-api/package.json` /
`node_modules/@epam/ai-dial-typescript-sdk`) introduces "offline credentials"
support (`getOfflineCredentials`, `offlineCredentialsSignIn`,
`offlineCredentialsSignOut`, `OfflineCredentialsStatus`,
`OfflineCredentialsSignInRequest`, PR
https://github.com/epam/ai-dial-typescript-sdk/pull/33): a one-time,
interactive OAuth consent (with `offline_access`/refresh-token scope) that
lets DIAL Core mint and store a long-lived credential Core itself can use
later to run the schedule without the user present.

Today a scheduled task can be created and will silently fail every
unattended run if the user never completed this one-time consent — there is
no signal in the Scheduled Tasks UI that tells the user this step is
required. This proposal adds that signal and the login flow.

## Problem

- A Scheduled Task's completions run via the DIAL Scheduler routed deployment
  configured by `SCHEDULER_SERVICE_ID`
  (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`). When the
  upstream schedule executes with no interactive session, DIAL Core needs an
  offline-capable credential; if the user has never granted offline consent,
  the run fails with no actionable feedback surfaced to the user in Chat.
- The existing interactive OAuth flows in this codebase — toolset sign-in
  (`apps/chat/src/hooks/toolsets/useToolsetLogin.ts`,
  `apps/chat/src/utils/toolsets.ts`,
  `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx`) and
  application external-service sign-in
  (`apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts`) — are
  both triggered *reactively*, by a DIAL-Core-pushed `client-channel` event
  mid-completion. Offline-credentials consent has no such trigger: it must be
  solicited *proactively*, the first time an already-authenticated user opens
  the Scheduled Tasks section, since there is no in-flight completion to
  interrupt.

## Solution

- Upgrade `@epam/ai-dial-typescript-sdk` to exactly `0.1.0-dev.37` in
  `package.json`/`package-lock.json` (`apps/chat-api` is the sole consumer,
  per `apps/chat-api/src/dial/dial-client.service.ts`; the SDK is never a
  frontend dependency).
- Add a new backend BFF domain, `apps/chat-api/src/offline-credentials/`,
  modeled on `apps/chat-api/src/external-services/` (closest existing
  OAuth-shaped domain): a `GET /api/v1/offline-credentials` status endpoint
  and a `POST /api/v1/offline-credentials/signin` endpoint, both proxying
  DIAL Core's `GET /v1/user/offline-credentials` and
  `POST /v1/user/offline-credentials/signin` through `DialClientService`
  using the session's bearer access token
  (`apps/chat-api/src/common/utils/auth-header.ts`).
- On the frontend, add a route-level credentials-status check that runs
  whenever an authenticated user enters any Scheduled Tasks route (list,
  create, detail, edit — see `apps/chat/src/app/app.tsx`'s
  `ROUTES.ScheduledTasks*` routes), excluding the OAuth callback route. If
  `available && !connected`, show a modal (built on the ui-kit `Popup`
  component) explaining that logging in is required for scheduled tasks to
  run, with a "Log in" button that starts an OAuth popup flow reusing the
  toolset OAuth popup/callback/`BroadcastChannel` infrastructure
  (`apps/chat/src/utils/toolsets.ts`,
  `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx`),
  extended with a new `OfflineCredentials` member on the existing
  `OAuthResourceKind` discriminated union (the same mechanism that already
  distinguishes `Toolset` from `ExternalService` flows in that file).
- Regenerate `libs/chat-api-client` from the updated OpenAPI spec and add a
  thin `apps/chat/src/server-api/offline-credentials.ts` wrapper (mirroring
  `apps/chat/src/server-api/external-services.ts`) exposing
  `getOfflineCredentials(signal?)` and `signInOfflineCredentials(body)`.

## Non-goals

- Offline-credentials **sign-out** (`offlineCredentialsSignOut` exists in the
  SDK but is out of scope for this change).
- Application external-service consent grant/withdrawal — unrelated existing
  feature, untouched.
- Any other change introduced by SDK PR #33 beyond the offline-credentials
  surface (`getOfflineCredentials`, `offlineCredentialsSignIn`,
  `OfflineCredentialsStatus`, `OfflineCredentialsSignInRequest`) and the
  `DIAL_NATIVE` auth-type addition strictly as needed for the SDK to compile.
- Changes to the primary Chat OIDC session login/logout flow
  (`docs/auth/auth-bff-encrypted-cookie.md` §5.1–5.4).
- Redesigning the toolset or external-service auth UX — this proposal reuses
  their OAuth plumbing as-is, only extending the resource-kind union.
- Blocking access to already-listed Scheduled Tasks after the modal is
  dismissed — dismissing only hides the modal for the current visit; task
  CRUD/pause/resume/run-history stays usable.
- Any change to Scheduled Task CRUD, pause/resume, or run-history contracts
  (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`).
- A new feature flag — the check is gated by the existing
  `scheduledTasksEnabled` feature flag already guarding every Scheduled Tasks
  route/endpoint.
- Persisting OAuth authorization codes or credentials in frontend state,
  Redux, or browser storage beyond the transient callback-popup
  `sessionStorage` entry the toolset flow already uses (cleared immediately
  on read, same as today).
- Unrelated dependency upgrades or refactoring beyond the pinned SDK bump.
- Implementing any of this now — this change produces only the OpenSpec
  proposal/design/spec/tasks artifacts, no application code.

## Acceptance Criteria

1. `@epam/ai-dial-typescript-sdk` is pinned to exactly `0.1.0-dev.37` in
   `package.json` and `package-lock.json`; `apps/chat-api` builds and its
   existing DIAL SDK call sites (`DialClientService` and all its consumers)
   continue to compile and pass tests unchanged in behavior.
2. `GET /api/v1/offline-credentials` returns a camelCase
   `{ available, connected, connect? }` shape, requires a valid session
   (`SessionUser`/`validateServerSession`-equivalent guard already used by
   every versioned `chat-api` controller), is gated by the
   `scheduledTasksEnabled` feature flag, and never caches (`Cache-Control:
   private, no-store`).
3. `POST /api/v1/offline-credentials/signin` accepts `{ code, redirectUri }`,
   validates `redirectUri` against an app-owned allowlist before forwarding
   it to DIAL Core, returns `{ success: true }` only when Core's
   `offlineCredentialsSignIn` call resolves to the literal boolean `true`,
   and maps a literal `false` response to a `502` (never to a `200 success`).
4. Entering `ROUTES.ScheduledTasks`, `ROUTES.ScheduledTaskCreate`,
   `ROUTES.ScheduledTaskDetail`, or `ROUTES.ScheduledTaskEdit` as an
   authenticated user triggers exactly one status check per route entry
   (deduped under React 18 StrictMode), in parallel with each page's own
   data loading, and is skipped entirely on the OAuth callback route.
5. When the check reports `available: true, connected: false`, a modal
   appears explaining that login is required for the user's scheduled tasks
   to run, offering a "Log in" action; the modal does not appear when
   `available` is `false` or `connected` is already `true`; a check failure
   (network/5xx) does not show the "not connected" modal (failure is not
   treated as `connected: false`).
6. Clicking "Log in" opens a same-origin OAuth popup synchronously (no
   `await` ahead of `window.open`) and, on returning from the provider,
   re-fetches offline-credentials status as the authority for closing the
   modal — a raw callback "success" alone does not close it.
7. The modal supports popup-blocked, cancelled, timed-out, and failed retry
   states, keyboard operation (focus trap/restore, Escape), and passes a
   WCAG 2.1 AAA review per `.claude/rules/a11y.md`.
8. `docs/auth/auth-bff-encrypted-cookie.md` gains a subsection (plus updated
   Mermaid diagram) documenting this flow as distinct from OIDC session login,
   toolset sign-in, and external-service sign-in.
9. Existing toolset and external-service OAuth flows have passing regression
   tests confirming no behavior change from the `OAuthResourceKind` extension.

## Alternatives Considered

- **Global app-level context/provider instead of a route-level check.**
  Rejected: offline-credentials only matters inside Scheduled Tasks; a
  global check would run (and rate-limit-consume) on every route for users
  who never touch Scheduled Tasks. A route-level gate/hook scoped to the four
  Scheduled Task routes is cheaper and keeps the concern local, matching how
  `apps/chat/src/context/ActiveScheduledTaskContext.tsx` is already scoped
  rather than global.
- **Repurposing `toolsetId`/`ToolsetCredentialsLevel` directly for the new
  resource instead of extending `OAuthResourceKind`.** Rejected: offline
  credentials are a per-user, non-toolset, non-external-service resource
  with no natural "credentials level" (no GLOBAL/APP variant); forcing it
  through those fields would misuse a type that already carries specific
  semantics for two other resource kinds. A third discriminated-union member
  keeps `waitForToolsetOAuthResult`/`ToolsetAuthCallback` exhaustively typed.
  handled correctly.
- **A dedicated callback route instead of reusing `ROUTES.ToolsetSignIn`.**
  Considered but reuse is used unless the design investigation surfaces a
  conflict (see `design.md` for the final call and its justification) — a
  dedicated route is only introduced if the shared route cannot express the
  new resource kind safely.
- **Blocking Scheduled Tasks CRUD until login completes.** Rejected per
  Non-goals — a hard block increases the blast radius of this change and
  contradicts the existing pattern (interactive toolset sign-in dialogs are
  also dismissible without blocking the rest of the app).

## Backward Compatibility

- Purely additive: new BFF routes, new SDK methods used, one new
  discriminated-union member. No existing endpoint, DTO, Redux/React state
  shape, or route path changes.
- Users who already completed the equivalent consent out-of-band (if any)
  see `connected: true` and never see the modal — no forced re-consent.
- The SDK bump from `0.1.0-dev.31` to `0.1.0-dev.37` is a dev/pre-release
  version range; `design.md` documents the diff surface consumed by
  `apps/chat-api` today (`DialClientService`, `ThemeService`-style fetch
  patterns) to confirm no breaking signature changes hit existing call
  sites, and calls out the new `DIAL_NATIVE` auth type's compile-time impact.

## Migration Impact

- No data migration. No change to persisted Scheduled Task, toolset, or
  external-service records.
- `chat-api-client` (generated OpenAPI client, `libs/chat-api-client`) must
  be regenerated after the Swagger update; any hand-authored code depending
  on generated types picks up the two new operations
  (`getOfflineCredentials`, `signInOfflineCredentials`) without touching
  existing generated types.
- No environment variable is strictly required beyond what
  `AUTH_CALLBACK_BASE_URL` (`apps/chat-api/src/config/environment.config.ts`)
  already provides for redirect-URI allowlisting; `design.md` confirms this
  or specifies a new one if needed.

## Rollback Strategy

- The feature is fully gated behind the existing `scheduledTasksEnabled`
  feature flag (`ENABLED_FEATURES`); disabling that flag hides the entry
  check, the modal, and the new BFF routes' guard passes, without requiring a
  code revert.
- If a regression is found post-merge, reverting the frontend commit(s) that
  wire the route-level check and modal is sufficient to stop the proactive
  prompt while leaving the additive BFF endpoints inert (unused, harmless).
- The SDK version bump is isolated to `apps/chat-api`; rolling it back is a
  single lockfile/package.json revert with no data-shape implications, since
  no persisted data depends on the new SDK types.

## Capabilities

### New Capabilities

- `offline-credentials`: Backend BFF domain proxying DIAL Core's offline
  credentials status/sign-in endpoints (`apps/chat-api/src/offline-credentials/`),
  session-validated, feature-gated, rate-limited, no-cache status reads.
- `scheduled-tasks-offline-credentials-login`: Frontend behavior — the
  route-level status check on Scheduled Tasks routes, the login-required
  modal and its state machine, and the OAuth popup/callback integration that
  reuses the shared toolset OAuth infrastructure.

### Modified Capabilities

_None — no existing OpenSpec capability spec in `openspec/specs/` currently
documents Scheduled Tasks, toolsets, or external-service auth; this change
introduces the two capabilities above as net-new specs rather than deltas
against an existing one._

## Impact

- **Backend (`apps/chat-api`)**: new `src/offline-credentials/` domain
  (controller, service, DTOs, module — mirroring
  `src/external-services/`); `package.json`/`package-lock.json` SDK bump;
  Swagger/OpenAPI regeneration; no changes to `src/scheduled-tasks/` or
  `src/external-services/` beyond what SDK typings require to keep compiling.
- **Generated client (`libs/chat-api-client`)**: two new operations
  (`getOfflineCredentials`, `signInOfflineCredentials`) and their DTOs.
- **Frontend (`apps/chat`)**: new
  `src/server-api/offline-credentials.ts` wrapper registered alongside the
  existing API singletons in `src/server-api/api-client.ts`; a new
  route-level hook/gate wired into `src/app/app.tsx`'s
  `ROUTES.ScheduledTasks`/`ScheduledTaskCreate`/`ScheduledTaskDetail`/
  `ScheduledTaskEdit` routes; extension of
  `OAuthResourceKind`/`ToolsetRedirectState`/`ToolsetOAuthChannelMessage` in
  `src/constants/toolsets.ts`/`src/models/toolsets.ts`; changes to
  `src/utils/toolsets.ts` and `src/pages/ToolsetAuthCallback/
  ToolsetAuthCallback.tsx` to branch on the new resource kind; a new modal
  component (ui-kit `Popup`); new i18n keys under the Scheduled Tasks
  namespace (`src/i18n/locales/*.json`).
- **New API routes**: `GET /api/v1/offline-credentials` and
  `POST /api/v1/offline-credentials/signin`. Both require a valid encrypted
  session cookie (the same `SessionUser`-populating guard every other
  versioned `chat-api` controller relies on — no new auth mechanism) and are
  additionally gated by the `scheduledTasksEnabled` feature flag.
- **Docs**: `docs/auth/auth-bff-encrypted-cookie.md` gains a new subsection
  and an updated/added Mermaid diagram under `docs/auth/auth-diagrams/`.
