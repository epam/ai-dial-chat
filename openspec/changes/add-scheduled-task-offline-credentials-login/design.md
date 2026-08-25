## Context

Scheduled Tasks (`apps/chat-api/src/scheduled-tasks/`,
`apps/chat/src/pages/ScheduledTasksPage/` et al.) run a chat completion on a
cron trigger via the DIAL Scheduler routed deployment
(`SCHEDULER_SERVICE_ID`). Because there is no interactive session at run
time, DIAL Core needs the user to have pre-granted an offline-capable OAuth
credential (`offline_access` scope) before the schedule can execute
unattended. `@epam/ai-dial-typescript-sdk@0.1.0-dev.37` (bumped from the
currently pinned `0.1.0-dev.31`) adds exactly this surface.

This document is the technical design for surfacing that requirement to the
user the first time they enter the Scheduled Tasks section, and for wiring
the one-time consent flow using the same OAuth popup/callback machinery the
codebase already uses for toolset sign-in
(`apps/chat/src/hooks/toolsets/useToolsetLogin.ts`,
`apps/chat/src/utils/toolsets.ts`,
`apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx`) and
application external-service sign-in
(`apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts`).

Backend reference domain: `apps/chat-api/src/external-services/` is the
closest existing OAuth-shaped BFF domain (controller
`external-services.controller.ts`, service `external-services.service.ts`,
DTOs `dto/external-service.dto.ts`, module `external-services.module.ts`,
mapper `external-services.mapper.ts`) and is the pattern this design mirrors
for the new `offline-credentials` domain.

## Goals / Non-Goals

**Goals:**

- Pin `@epam/ai-dial-typescript-sdk` to exactly `0.1.0-dev.37` for
  `apps/chat-api` only; confirm the exported surface used here
  (`getOfflineCredentials`, `offlineCredentialsSignIn`,
  `OfflineCredentialsStatus`, `OfflineCredentialsSignInRequest`) and any
  compile-time impact from the SDK's new `DIAL_NATIVE` auth-type member.
- Add a session-validated, feature-gated, rate-limited BFF domain proxying
  DIAL Core's offline-credentials status/sign-in endpoints.
- Add a route-level status check on the four Scheduled Task routes that
  shows a login-required modal when appropriate, without blocking existing
  page functionality.
- Extend the existing toolset OAuth popup/callback infrastructure with a
  new `OAuthResourceKind` member instead of forking it.
- Keep the change accessible (WCAG 2.1 AAA), RTL-correct, and documented.

**Non-Goals:** (see proposal.md's "Non-goals" for the full list — carried
here for design scoping)

- Offline-credentials sign-out.
- Any Redux store domain — this is component/route-local state, not global
  app state (see Decision 4).
- A new feature flag; reuses `scheduledTasksEnabled`.
- Changes to primary OIDC session login/logout.

## Decisions

### 1. Exact SDK surface and version impact

`package.json`/`package-lock.json`: bump
`"@epam/ai-dial-typescript-sdk": "0.1.0-dev.31"` (currently declared only in
`apps/chat-api/package.json`, consumed exclusively through
`apps/chat-api/src/dial/dial-client.service.ts`'s `createSDK({ baseUrl })`)
to `"0.1.0-dev.37"`. This SDK is never imported by `apps/chat` — the
existing pattern is strict (frontend only ever talks to `chat-api`'s BFF
routes, never to DIAL Core or its SDK directly), and this change preserves
it: `getOfflineCredentials`/`offlineCredentialsSignIn` are called only from
the new `apps/chat-api/src/offline-credentials/offline-credentials.service.ts`,
through `this.dialClient.client.getOfflineCredentials(...)` /
`this.dialClient.client.offlineCredentialsSignIn(...)`, exactly like
`ExternalServicesService.getExternalService`/`.signIn` call
`this.dialClient.client.getExternalService`/`.externalServiceSignIn`
(`apps/chat-api/src/external-services/external-services.service.ts`).

New SDK members consumed:

- `getOfflineCredentials({ headers })` → `GET /v1/user/offline-credentials`
- `offlineCredentialsSignIn({ headers, body })` →
  `POST /v1/user/offline-credentials/signin`
- `OfflineCredentialsStatus` — response schema type
- `OfflineCredentialsSignInRequest` — request body schema type
- `offlineCredentialsSignOut` exists in the SDK but is **not called** by any
  code in this change (Non-goal).

Compile-time impact: SDK `0.1.0-dev.37` (PR #33) adds a `DIAL_NATIVE` member
to whatever discriminated auth-type union the SDK exports for its own
internal client configuration. Task 1 (SDK upgrade) must run
`npm exec nx build chat-api` after bumping the version and fix any
`exhaustive switch`/`never` narrowing the compiler flags in
`apps/chat-api` code that pattern-matches over an SDK-exported auth-type
union (none is currently known to exist in `DialClientService` or the
`external-services`/`scheduled-tasks` domains, but this must be re-verified
against the installed `0.1.0-dev.37` `.d.ts` files as the first sub-step of
that task, not assumed).

### 2. Upstream and BFF contracts

**Upstream (DIAL Core), via `DialClientService`:**

```
GET /v1/user/offline-credentials
→ dialClient.client.getOfflineCredentials({ headers: bearerHeaders })
{
  "available": true,
  "connected": false,
  "connect": {
    "authorization_endpoint": "https://identity.example.com/authorize",
    "client_id": "dial-chat",
    "redirect_uri": "https://chat.example.com/auth/toolset-signin",
    "scopes": ["openid", "offline_access"]
  }
}
```

```
POST /v1/user/offline-credentials/signin
→ dialClient.client.offlineCredentialsSignIn({ headers: bearerHeaders, body: { code, redirectUri } })
Request:  { "code": "authorization-code", "redirectUri": "https://chat.example.com/auth/toolset-signin" }
Response: true | false   (a bare boolean — treat `false` as failed sign-in, mapped to 502, never as success)
```

All upstream fields are optional (`available`/`connected`/`connect` may be
absent); the service must apply safe defaults rather than assume presence.

**BFF (`apps/chat-api`), new domain `src/offline-credentials/`:**

```
GET /api/v1/offline-credentials      (operationId: getOfflineCredentials)
→ { "available": true, "connected": false,
    "connect": { "authorizationEndpoint": "...", "clientId": "...",
                 "redirectUri": "...", "scopes": ["openid", "offline_access"] } }

POST /api/v1/offline-credentials/signin  (operationId: signInOfflineCredentials)
Request:  { "code": "authorization-code", "redirectUri": "https://chat.example.com/auth/toolset-signin" }
Response: { "success": true }
```

**DTO mapping table (snake_case upstream → camelCase BFF/frontend):**

| Upstream field                    | BFF/frontend field   |
| ---------------------------------- | -------------------- |
| `available`                        | `available`           |
| `connected`                        | `connected`            |
| `connect.authorization_endpoint`   | `connect.authorizationEndpoint` |
| `connect.client_id`                | `connect.clientId`     |
| `connect.redirect_uri`             | `connect.redirectUri`  |
| `connect.scopes`                   | `connect.scopes`       |
| *(sign-in success, bare `true`)*   | `{ success: true }`   |

**Controller (mirrors `ExternalServicesController`):**

```ts
@ApiTags('offline-credentials')
@Controller({ path: 'offline-credentials', version: '1' })
@UseGuards(FeatureGuard)
@RequireFeature(FeatureKey.ScheduledTasksEnabled)
export class OfflineCredentialsController {
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ operationId: 'getOfflineCredentials', ... })
  getOfflineCredentials(@Req() req: Request): Promise<GetOfflineCredentialsResponseDto> { ... }

  @Post('signin')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ operationId: 'signInOfflineCredentials', ... })
  signIn(@Req() req: Request, @Body() body: OfflineCredentialsSigninBodyDto): Promise<OfflineCredentialsAuthResultDto> { ... }
}
```

Rate limits are copied verbatim from `ExternalServicesController`
(`apps/chat-api/src/external-services/external-services.controller.ts:37,90`):
60/min for the read, 10/min for the sign-in mutation — no evidence in this
investigation calls for different limits, since both are single-user,
low-frequency operations of the same shape.

Reused, not reinvented: `FeatureGuard`/`RequireFeature(FeatureKey
.ScheduledTasksEnabled)` (same guard `ScheduledTasksController` already
uses, `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts:45-46`)
gates both endpoints — offline credentials only matter when Scheduled Tasks
is enabled, so no new feature flag is introduced. Both routes require the
session guard that already populates `req.user as SessionUser` on every
versioned controller (see `getExternalService`/`listScheduledTasks` reading
`const { at } = req.user as SessionUser`) — unauthenticated calls 401 before
reaching the handler, same as every other `chat-api` business route.

**Error mapping** (via the shared `mapDialHttpStatus`/`handleDialFetchError`
helpers, `apps/chat-api/src/common/dial/dial-error.mapper.ts`):

| Upstream/internal condition                        | HTTP status | Exception |
| --------------------------------------------------- | ----------- | --------- |
| Invalid `redirectUri` (fails allowlist)              | 400         | `BadRequestException` (via `ValidationPipe`) |
| No session cookie                                    | 401         | `UnauthorizedException` |
| `scheduledTasksEnabled` flag off for caller           | 403         | `ForbiddenException` (via `FeatureGuard`) |
| Rate limit exceeded                                  | 429         | Nest `ThrottlerGuard` |
| DIAL Core 4xx/5xx (`response.error`)                 | 502         | `BadGatewayException` |
| DIAL Core sign-in resolves to `false`                | 502         | `BadGatewayException` ("Core reported failure" — mirrors `ExternalServicesService.signIn`'s identical `!response.data` branch) |
| DIAL Core unreachable/timeout (`handleDialFetchError`)| 503         | `ServiceUnavailableException` |

`Cache-Control: private, no-store` on the `GET` (status must never be
cached — mirrors `listScheduledTasks`'s `@Header('Cache-Control', 'private,
no-store')` at `scheduled-tasks.controller.ts:59`, chosen over that
controller's 30s server-side cache since offline-credentials status changes
exactly once per user and must reflect the just-completed OAuth round trip
immediately). CSRF protection is inherited automatically: the frontend's
`api-client.ts` `csrfMiddleware` (`apps/chat/src/server-api/api-client.ts:29-53`)
attaches `X-CSRF-Token` to every non-GET request through the shared
`Configuration`/`Middleware` pipeline, so the new `signin` POST is protected
the same way `POST /api/v1/toolsets/{id}/login` already is, with no
additional BFF-side wiring required.

**`redirectUri` allowlist validation (new, stricter than the existing
`ExternalServiceSigninBodyDto.redirectUri`):** The existing external-service
DTO only applies `@IsString() @IsNotEmpty()` to `redirectUri`
(`apps/chat-api/src/external-services/dto/external-service.dto.ts:90-99`) —
no allowlist. This design tightens that for the new DTO: `redirectUri` MUST
resolve, after `new URL(value)`, to the same origin as
`AUTH_CALLBACK_BASE_URL` (already declared and validated in
`apps/chat-api/src/config/environment.config.ts:106-107`) and to one of the
app-owned callback paths (`/auth/toolset-signin` or
`/toolset-editor/callback`, i.e. `ROUTES.ToolsetSignIn`/
`ROUTES.ToolsetEditorCallback` from `apps/chat/src/types/routes.ts:20-21`).
A custom `class-validator` decorator (or a `@Validate()` class-validator
constraint) performs this check inside the DTO so it fails with a `400`
before the service layer runs, consistent with the "validate before use"
rule in `apps/chat-api/AGENTS.md` §5 for any string headed into an outbound
URL. This is stricter than the existing sibling DTO on purpose, since this
endpoint is new and the design brief explicitly calls for allowlisting; the
existing external-service DTO is out of scope for retrofitting here (Non-goal).

### 3. Route-level state ownership (not a global context)

The status check is owned by a new hook,
`apps/chat/src/hooks/offlineCredentials/useOfflineCredentialsGate.ts`,
called once from each of the four Scheduled Task route components
(`ScheduledTasksPage`, `ScheduledTaskCreatePage`, `ScheduledTaskDetailPage`,
`ScheduledTaskEditPage`) or, to avoid four call sites, from one thin wrapper
route element (`ScheduledTasksRouteGate`) rendered as the shared parent
`element` for all four `<Route>` entries in `apps/chat/src/app/app.tsx`
(sibling in shape to `ActiveScheduledTaskProvider` wrapping, but scoped only
to the Scheduled Tasks subtree, not the whole app). This mirrors how
`ActiveScheduledTaskContext` (`apps/chat/src/context/
ActiveScheduledTaskContext.tsx`) is already scoped rather than global, and
is preferred over a global `AppConfigContext`-level check because:

- Offline-credentials status is irrelevant outside Scheduled Tasks; checking
  it globally would burn one BFF call + rate-limit budget per navigation for
  users who never open that section.
- Scoping to the route subtree makes "excluded from the OAuth callback
  route" trivial — the callback routes (`ROUTES.ToolsetSignIn`,
  `ROUTES.ToolsetEditorCallback`) are siblings outside this subtree in
  `app.tsx`, never descendants, so no explicit exclusion branch is needed
  inside the gate itself.

The hook:

- Fires the `GET /api/v1/offline-credentials` request via
  `apps/chat/src/server-api/offline-credentials.ts` on mount, in parallel
  with whichever page-specific data hook already runs (e.g.
  `useScheduledTasks` in `ScheduledTasksPage.tsx:36-45`) — not sequenced
  after it, so entering a Scheduled Task route doesn't add to perceived list
  load time.
- Uses a `useRef` StrictMode-dedup guard identical in shape to
  `ToolsetAuthCallback.tsx:132-134`'s `hasRun` ref, adapted to allow re-fire
  on route re-entry (a `useEffect` keyed on pathname) rather than a
  once-ever guard, since the user can navigate in and out of Scheduled Tasks
  repeatedly within a session and the modal must reflect current status
  each time, not just the first.
- Passes an `AbortController` signal into `getOfflineCredentials(signal)` and
  aborts on unmount/route change, matching the codebase's existing
  cancellation pattern for route-scoped fetches.
- On fetch failure, sets an explicit `error` state — the gate must not
  collapse a network failure into `connected: false`, since that would
  incorrectly trigger the "please log in" modal for a user who's actually
  fine but hit a transient BFF error. The gate shows nothing on `error`
  (Non-goal: no separate error-modal UX beyond letting the page render as
  normal — task 8/tasks.md's modal state table treats `shown-error` as a
  distinct, dismiss-only state, not a retry-status prompt).

### 4. No Redux store domain

This state is route-local UI state (open/closed modal, checking/checked
status), not shared across the app and not persisted — it does not warrant
a `store/offline-credentials/` slice+epic+selector set. This mirrors how
`ToolsetAuthCallback`/`useToolsetLogin` also keep their OAuth-flow state
local to hooks/components rather than in Redux. (Per `openspec/config.yaml`
rules, a task that *did* add a store domain would need all six wiring
steps — none apply here since no store domain is added.)

### 5. Modal state machine

```
idle
  → checking            (gate's fetch in flight)
    → hidden             (available:false OR connected:true) — page renders normally
    → shown-available    (available:true, connected:false)   — "log in required" modal
    → shown-error        (fetch failed)                       — no modal; page renders normally, no retry prompt (Non-goal)
shown-available
  → login-in-progress    (user clicks "Log in"; popup opens synchronously)
    → success-closes     (post-callback refetch confirms connected:true) → hidden
    → retry-popup-blocked   (window.open returned null)         → shown-available (inline blocked message + retry action)
    → retry-cancelled       (user closed popup / focus-return cancel) → shown-available (inline cancelled message + retry action)
    → retry-timeout         (5-minute waitForToolsetOAuthResult timeout) → shown-available (inline timeout message + retry action)
    → retry-failed          (BFF signin call itself failed/502)  → shown-available (inline failed message + retry action)
```

The modal closes **only** after a fresh `GET /api/v1/offline-credentials`
call following the OAuth callback reports `connected === true` — the
callback's own reported `Success`/`Failure` outcome is a hint, not the
authority, exactly matching `useToolsetLogin.loginWithOAuth`'s existing
"treat the backend as final authority" re-verification
(`apps/chat/src/hooks/toolsets/useToolsetLogin.ts:172-186`). A callback that
reports `Success` but a status refetch that still reads `connected: false`
keeps the modal in `shown-available` with the failed-retry message, not
`success-closes`.

### 6. OAuth popup + callback sequence — reuse vs. extend vs. new

**Reused verbatim:**

- `openToolsetOAuthPopup()` / `navigateToolsetOAuthPopup()` /
  `waitForToolsetOAuthResult()` / `getToolsetOAuthChannelName()`
  (`apps/chat/src/utils/toolsets.ts:200-330`) — the popup lifecycle,
  `BroadcastChannel` handshake, and URL-polling fallback are resource-kind
  agnostic already (they only require `toolsetId`/`credentialsLevel` as a
  correlation key, not toolset semantics), exactly as `useExternalServiceLogin`
  already reuses them today (`apps/chat/src/hooks/externalServices/
  useExternalServiceLogin.ts:141-160`) by passing a synthetic
  `correlationId` in place of a real toolset id.
- `ToolsetAuthCallback.tsx` as the callback route component — it already
  branches on `redirectState.resourceKind` (`OAuthResourceKind.Toolset` vs.
  `OAuthResourceKind.ExternalService`) at line ~183, so adding an
  `OfflineCredentials` branch is additive to an existing `if`/`else if`
  chain, not a new file.
- `ROUTES.ToolsetSignIn` (`/auth/toolset-signin`) as the redirect_uri.
  Reuse is safe and preferred over a dedicated route because: (a) it is
  already the registered, https-only, app-owned callback path the BFF's new
  `redirectUri` allowlist (Decision 2) validates against; (b) the route
  already handles being opened only inside a popup, never navigated to
  directly by the opener tab, which is exactly this flow's shape too; (c)
  introducing a second callback route would require registering a second
  redirect_uri with every IdP offline-credentials might connect through,
  multiplying operational config for no functional gain. A dedicated route
  is **not** introduced.

**Extended (discriminated union, not new fields on existing types):**

- `OAuthResourceKind` (`apps/chat/src/constants/toolsets.ts`) gains a third
  member, `OfflineCredentials = 'offline-credentials'`, alongside `Toolset`
  and `ExternalService`.
- `ToolsetRedirectState` (`apps/chat/src/models/toolsets.ts`) already carries
  `resourceKind` generically; no field shape change needed, but its
  `toolsetId` field is repurposed as the flow's opaque correlation id for
  this kind too (a fixed sentinel string, e.g. `'offline-credentials'`, since
  there is no per-resource id to encode — unlike the external-service kind's
  composite scope id) — **not** `toolsetId` semantics, purely the
  pre-existing generic string slot, consistent with how the design brief
  asks for a discriminated union "instead of repurposing `toolsetId`"
  *semantically* (the field still exists structurally on the shared type;
  what changes is that call sites for this kind never read it as a real
  toolset id, mirroring how `useExternalServiceLogin` already treats it as
  an opaque `correlationId`, not a toolset id, today).
- `ToolsetOAuthChannelMessage`'s `Success` variant already carries
  `toolsetId`/`credentialsLevel` generically — reused unchanged, since the
  new callback branch only needs to signal success/failure, not resource
  details, back through the channel.
- `ToolsetAuthCallback.tsx`'s branching `if` gets one more `else if
  (redirectState.resourceKind === OAuthResourceKind.OfflineCredentials)`
  calling the new `signInOfflineCredentials({ code, redirectUri })` wrapper
  instead of `loginToolset`/`signInExternalService`.

**New:**

- `apps/chat/src/hooks/offlineCredentials/useOfflineCredentialsLogin.ts` — a
  thin hook, structurally parallel to `useExternalServiceLogin`'s
  `loginWithOAuth` (no API-key branch needed here, since offline credentials
  are OAuth-only): opens the popup synchronously, calls
  `navigateToolsetOAuthPopup(popup, authFormData, 'offline-credentials',
  ToolsetCredentialsLevel.User, OAuthResourceKind.OfflineCredentials)`,
  awaits `waitForToolsetOAuthResult`, and on any non-`Success` result still
  triggers the authoritative status refetch (Decision 5) rather than
  trusting the channel result alone.
- `apps/chat/src/server-api/offline-credentials.ts` — thin wrapper (see
  Decision 7).
- `apps/chat/src/hooks/offlineCredentials/useOfflineCredentialsGate.ts` and
  the `ScheduledTasksRouteGate` route element (Decision 3).
- The modal component itself (Decision 8).

### 7. Generated-client impact

- Swagger: the new controller's `@ApiOperation`/`@ApiResponse` annotations
  (per `apps/chat-api/AGENTS.md` §2–3) drive `npm run openapi` to emit
  `getOfflineCredentials`/`signInOfflineCredentials` into
  `libs/chat-api-client`'s generated `OfflineCredentialsApi` client class
  and its response/request DTO types, matching how `ToolsetsApi`/
  `ExternalServicesApi` are already generated and re-exported from
  `@epam/ai-dial-chat-api-client`.
- `apps/chat/src/server-api/api-client.ts` gains one new singleton line,
  `export const offlineCredentialsApi = new OfflineCredentialsApi(config);`,
  alongside the existing `toolsetsApi`/`scheduledTasksApi` exports
  (`api-client.ts:170-179`) — no change to the shared `Configuration`,
  `csrfMiddleware`, or `unauthorizedMiddleware`, since those are
  transport-level and resource-agnostic already.
- `apps/chat/src/server-api/offline-credentials.ts` exposes exactly two
  thin functions, mirroring `apps/chat/src/server-api/external-services.ts`'s
  shape:
  ```ts
  export const getOfflineCredentials = (signal?: AbortSignal) =>
    offlineCredentialsApi.getOfflineCredentials({ signal });
  export const signInOfflineCredentials = (body: OfflineCredentialsSigninBodyDto) =>
    offlineCredentialsApi.signInOfflineCredentials({ offlineCredentialsSigninBodyDto: body });
  ```
- Regeneration/build/lint order: `npm run openapi` → `npm run openapi:check`
  → `npm exec nx build chat-api-client -- --skip-nx-cache` →
  `npm exec nx lint chat-api-client` (see tasks.md).

### 8. App/lib boundary

- All SDK/DIAL-Core/session-token code stays in `apps/chat-api` (per the
  Library Isolation rule and this feature's own shape — no `libs/*` lib
  touches the SDK, session, or BFF routes).
- BFF integration, routing, and OAuth orchestration stay in `apps/chat`
  (`app.tsx`, `server-api/`, `hooks/offlineCredentials/`,
  `pages/ToolsetAuthCallback/`).
- The modal itself is a plain, typed-props component. Two placement options
  were considered:
  - **Option A (chosen)**: keep it app-local, in
    `apps/chat/src/components/OfflineCredentialsLoginModal/` (co-located
    with the Scheduled Tasks feature, like `ScheduledTasksPage`'s own
    components), built on the ui-kit `Popup` (`@epam/ai-dial-ui-kit`,
    confirmed via `mcp__ai-dial-ui-kit__getEntityDetails("component",
    "Popup")` — 2.0 accessible modal with `open`, `header`, `footer`,
    `onClose`, `ariaLabel`, `closeOnOutsideClick`, `preventKeyboardOnOpen`
    props, portal-rendered with built-in focus management). This is
    consistent with `libs/*` isolation: the modal needs `onLogIn`/`onDismiss`
    callbacks and label/state props only, no SDK/route/context import, so
    there is no forcing reason to push it into a shared lib.
  - **Option B (rejected for this change)**: a `libs/*` presentational
    component taking only typed props, if a future consumer outside
    `apps/chat` needed the same modal shape. No such consumer exists today
    (Scheduled Tasks is `apps/chat`-only), so Option A avoids introducing an
    unused lib boundary; this can be revisited later without contract
    changes to the modal's own props, since Option A's component is already
    prop-driven (no SDK/context imports inside it).

### 9. Accessibility (WCAG 2.1 AAA)

- `Popup`'s built-in focus management provides focus trap + restore-on-close
  and honors `Escape`; confirm via the ui-kit's own a11y guarantees rather
  than re-implementing.
- `aria-busy="true"` on the modal body while `login-in-progress`, cleared on
  any terminal state.
- An `aria-live="polite"` status region inside the modal announces
  transitions to `retry-popup-blocked`/`retry-cancelled`/`retry-timeout`/
  `retry-failed` and to `success-closes` (per `.claude/rules/a11y.md`'s
  dynamic-feedback pattern) — the "Log in" button's own label stays stable
  ("Log in"), the live region carries the transient message, matching the
  copy-confirmation pattern already documented for that rule.
- "Log in" and "Not now"/dismiss buttons are ≥44×44px targets.
- Mobile (`useIsMobile`/`useBreakpoint`) and desktop layouts only — no
  arbitrary `sm:`/`md:`/`lg:` breakpoints; verified to fit at 360px width.
- All spacing/direction classes are logical (`ms-*`/`me-*`/`text-start` etc.)
  per `.claude/rules/rtl.md`; the modal takes no `dir` prop of its own since
  it is an `apps/chat` component and inherits `dir` from `<html>` via CSS
  cascade (libs-only concern does not apply here, but the same logical-
  property discipline still applies to `apps/chat` UI per AGENTS.md).

### 10. i18n

New keys under the existing Scheduled Tasks i18n namespace
(`apps/chat/src/constants/translation-keys.ts`'s `ScheduledTasksI18nKeys`,
alongside `PageTitle`/`EmptyStateLabel` etc.):

- `OfflineCredentialsModalTitle`
- `OfflineCredentialsModalBody`
- `OfflineCredentialsModalLoginButtonLabel`
- `OfflineCredentialsModalDismissButtonLabel`
- `OfflineCredentialsModalCloseAriaLabel`
- `OfflineCredentialsModalPopupBlockedMessage`
- `OfflineCredentialsModalCancelledMessage`
- `OfflineCredentialsModalTimeoutMessage`
- `OfflineCredentialsModalFailedMessage`
- `OfflineCredentialsModalRetryButtonLabel`
- `OfflineCredentialsModalSuccessAnnouncement`
- `OfflineCredentialsModalLoggingInAriaLabel`

Each key is added to every locale file under
`apps/chat/src/i18n/locales/*.json` (including `ar.json`), per the "Adding a
new locale"/RTL rules — no new locale is added by this change, only new keys
in existing locale files.

### 11. Observability

Logged (via `Logger` in the new `OfflineCredentialsService`, matching
`ExternalServicesService`'s discipline at
`external-services.service.ts:24-27,86-98`):

- `debug`: "Fetching offline-credentials status", "Signing in
  offline-credentials" with only `redirectUri` (already allowlisted, so safe)
  and no other body fields.
- `warn`: upstream non-OK status + `extractDialErrorMessage(...)` (via
  `mapDialHttpStatus`), same as every other domain.
- `error`: unexpected/5xx branches with `error.stack`.

**Never logged:** the authorization `code`, any token, any cookie value, the
full raw callback URL (which contains the code as a query param — the
frontend already strips it via `replacePopupUrl` before `reportResult`,
`ToolsetAuthCallback.tsx:141-145`, before any logging-adjacent code could
see it), and the full request/response body of the `signin` call. This
mirrors `ExternalServicesService.signIn`'s existing redaction pattern,
which logs `codeLength` rather than the code itself
(`external-services.service.ts:90-98`) — the new service adopts the same
`codeLength`-not-`code` convention.

### 12. Documentation impact

`docs/auth/auth-bff-encrypted-cookie.md` gains a new subsection, "5.6
Proactive Offline-Credentials Consent (Scheduled Tasks)", placed after the
existing "5.5 Interactive Sign-In During a Completion" subsection, explicitly
contrasting:

- vs. **5.1 OIDC login**: this flow never touches the session cookie; the
  user is already authenticated.
- vs. **5.5 toolset/external-service sign-in**: those are *reactive*,
  triggered by a DIAL-Core-pushed `client-channel` event mid-completion;
  this flow is *proactive*, triggered by route entry with no in-flight
  completion.

A new Mermaid diagram, `docs/auth/auth-diagrams/10-offline-credentials-
consent.mmd` (+ rendered `.svg`, following the numbering convention of
`08-toolset-signin-interrupt.mmd`/`09-header-token-auth-chain.mmd`), shows:
route entry → `GET /api/v1/offline-credentials` → modal → popup → provider →
`ROUTES.ToolsetSignIn` callback → `POST /api/v1/offline-credentials/signin`
→ authoritative refetch → modal closes. `docs/auth/auth-diagrams/README.md`
is updated to list the new diagram.

## Risks / Trade-offs

- **[Risk]** A user with `available: true` who dismisses the modal without
  logging in will have their scheduled tasks silently fail to run
  unattended, with no further nudge. → **Mitigation**: explicitly a
  Non-goal to solve run-failure surfacing in this change (that's a
  Scheduled Task run-history/notification concern, out of scope); the modal
  re-appears on every fresh route entry while `connected` stays `false`, so
  the nudge is not one-time-only.
- **[Risk]** Reusing `ROUTES.ToolsetSignIn` means offline-credentials OAuth
  and toolset/external-service OAuth share one redirect_uri; a bug in the
  `resourceKind` branch could misroute a callback. → **Mitigation**: the
  branch is a `switch`/`if-else` over a 3-member union, and task tasks.md
  includes an explicit regression-test task asserting the two existing
  branches are unaffected by adding the third.
- **[Risk]** SDK `0.1.0-dev.37` is a pre-release version; its shape could
  still change before a stable release. → **Mitigation**: pinned exactly
  (no `^`/`~` range), consistent with how `0.1.0-dev.31` is already pinned
  exactly today.
- **[Trade-off]** Route-level (not global) status checking means a user
  could complete offline-credentials login once and then have the same
  status re-fetched on every subsequent Scheduled Tasks visit — an
  intentional trade-off (Decision 3) favoring correctness (always-fresh
  status, `no-store`) over minimizing request count, since the read is
  cheap and rate-limited generously (60/min).

## Migration Plan

1. Land the SDK bump + backend domain + Swagger + generated client (tasks
   1–4) — inert until the frontend wires it up; safe to merge and deploy
   independently.
2. Land the frontend wrapper, route gate, OAuth extension, and modal (tasks
   5–10) behind the existing `scheduledTasksEnabled` flag — no separate flag
   flip needed since the flag already gates every Scheduled Tasks surface.
3. Land docs (task 11) in the same commit as the behavior change it
   describes, per AGENTS.md's docs-writing rule.
4. Rollback: see proposal.md's "Rollback Strategy" — flag-gated, additive,
   revertible per layer independently.

## Open Questions

- Whether `AUTH_CALLBACK_BASE_URL` is sufficient as the sole allowlist
  origin, or whether a dedicated `SCHEDULER_OFFLINE_CREDENTIALS_REDIRECT_URI`
  env var is warranted if the offline-credentials IdP client is registered
  separately from the toolset OAuth clients. Resolve during task 2
  (backend DTOs) by confirming with the DIAL Core/Scheduler team whether the
  `connect.redirect_uri` Core returns is expected to always equal
  `ROUTES.ToolsetSignIn`'s origin+path, or whether Core expects the BFF to
  echo back whatever the frontend sends. Until resolved, task 2 defaults to
  validating against `AUTH_CALLBACK_BASE_URL` + the two existing toolset
  callback paths, since no evidence in this investigation shows a separate
  redirect_uri is registered for offline credentials.
- Whether DIAL Core requires per-request `credentialsLevel` for offline
  credentials (toolsets/external-services both have USER/GLOBAL/APP levels;
  the given upstream contract shows no such field for offline credentials).
  This design assumes offline credentials are inherently user-scoped only
  (no level concept) based on the contract shapes given; confirm against the
  actual `0.1.0-dev.37` `.d.ts` types in task 1 before finalizing the DTOs
  in task 2.
