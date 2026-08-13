## 1. SDK upgrade

- [x] 1.1 Bump `"@epam/ai-dial-typescript-sdk"` from `0.1.0-dev.31` to exactly
      `0.1.0-dev.37` in `apps/chat-api/package.json` and regenerate
      `package-lock.json` (`npm install`). Do not use a range (`^`/`~`).
      Follow-up fix: the root workspace `package.json` also declared this
      dependency (a separate entry from `apps/chat-api/package.json`),
      left at `0.1.0-dev.31` and causing a duplicate hoisted+nested install
      in `package-lock.json`. Bumped the root declaration to `0.1.0-dev.37`
      and re-ran `npm install`, collapsing the tree back to a single
      resolved copy. Re-verified: `nx build chat-api`, `nx test chat-api`
      (134 files/2145 tests), `nx test chat` (181 files/2423 tests, 2
      skipped), `nx lint chat`/`nx lint chat-api` (0 errors), and
      `nx affected -t lint,test,build --base=origin/development-1.0` all
      pass after the fix.
- [x] 1.2 Inspect the installed `node_modules/@epam/ai-dial-typescript-sdk/dist/**/*.d.ts`
      to confirm the exact exported signatures for `getOfflineCredentials`,
      `offlineCredentialsSignIn`, `offlineCredentialsSignOut` (confirm it
      exists but is unused), `OfflineCredentialsStatus`, and
      `OfflineCredentialsSignInRequest`. Record the confirmed shapes as
      inline comments or a short note referenced by task 2.1 if they differ
      from `design.md`'s assumed contract.
      Confirmed (apps/chat-api/node_modules/@epam/ai-dial-typescript-sdk@0.1.0-dev.37
      dist/index.d.ts): shapes match design.md exactly —
      `OfflineCredentialsStatus { available?, connected?, connect?: OfflineCredentialsStatusConnect }`,
      `OfflineCredentialsStatusConnect { authorization_endpoint?, client_id?, redirect_uri?, scopes? }`
      (snake_case), `OfflineCredentialsSignInRequest { code?: string; redirectUri?: string }`
      (already camelCase on `redirectUri` — no per-request `credentialsLevel` field,
      confirming the Open Question in design.md: offline credentials are user-scoped
      only, no level concept). `getOfflineCredentials`/`offlineCredentialsSignIn`/
      `offlineCredentialsSignOut` client methods all present as documented.
- [x] 1.3 Confirm whether the SDK's new `DIAL_NATIVE` auth-type member
      requires any exhaustive-`switch`/`never` fix in
      `apps/chat-api/src/dial/dial-client.service.ts` or elsewhere in
      `apps/chat-api/src`. Fix if needed; otherwise note "no impact found".
      No impact found: `DIAL_NATIVE` was added to the SDK's
      `components['schemas']['AuthenticationType']` union
      (`'OAUTH' | 'API_KEY' | 'NONE' | 'DIAL_NATIVE'`). Confirmed via
      `grep -rn "AuthenticationType" apps/chat-api/src` that no code
      pattern-matches over this SDK union type directly — the only local
      analog, `ExternalServiceAuthType`, is an independently declared DTO enum
      (`NONE`/`API_KEY`/`OAUTH`) populated via a cast-with-fallback
      (`external-services.mapper.ts`'s `mapDialExternalServiceToDto`), not an
      exhaustive switch, so it does not need updating. `npm exec nx build
      chat-api` compiles clean after the bump.
- [x] 1.4 Confirm `apps/chat/**` has zero imports of
      `@epam/ai-dial-typescript-sdk` (`grep -R "ai-dial-typescript-sdk"
      apps/chat/src`) — must return no matches, preserving the
      SDK/DIAL-Core-stays-in-chat-api boundary.
      Verify: `npm exec nx build chat-api`
      Confirmed: `grep -R "ai-dial-typescript-sdk" apps/chat/src` returns no
      matches. `npm exec nx build chat-api` passes.

## 2. Backend: DTOs, controller, service, module

- [x] 2.1 Create response/request DTOs in
      `apps/chat-api/src/offline-credentials/dto/offline-credentials.dto.ts`:
      `OfflineCredentialsConnectDto` (`authorizationEndpoint`, `clientId`,
      `redirectUri`, `scopes`), `GetOfflineCredentialsResponseDto`
      (`available`, `connected`, optional `connect`),
      `OfflineCredentialsSigninBodyDto` (`code: string` — `@IsString()
      @IsNotEmpty()`; `redirectUri: string` — `@IsString() @IsNotEmpty()`
      plus a custom same-origin/allowlisted-path validator per design.md
      Decision 2), `OfflineCredentialsAuthResultDto` (`success: boolean`).
      All fields carry `@ApiProperty`/`@ApiPropertyOptional`.
- [x] 2.2 Implement the custom `redirectUri` allowlist validator (a
      `class-validator` `@ValidatorConstraint` or `@Matches`-based check)
      reading `AUTH_CALLBACK_BASE_URL`
      (`apps/chat-api/src/config/environment.config.ts:106-107`) and
      validating against the app-owned callback paths
      (`/auth/toolset-signin`, `/toolset-editor/callback`). Add unit tests
      for accepted/rejected URIs including path-traversal-style attempts.
      Implemented as an `@Injectable() @ValidatorConstraint()` class
      (`IsAllowedRedirectUriConstraint`) reading `AUTH_CALLBACK_BASE_URL` via
      `ConfigService` rather than `process.env` directly (per
      `apps/chat-api/AGENTS.md` §7). This required adding
      `useContainer(app.select(AppModule), { fallbackOnErrors: true })` to
      `apps/chat-api/src/main.ts` so class-validator resolves the constraint
      through Nest's DI container — a small, additive main.ts change not
      explicitly called out in design.md, needed because class-validator
      constraints are otherwise instantiated with plain `new` outside DI.
      Unit tests covering accepted/path-traversal/wrong-origin/wrong-path
      redirectUri values are in the controller integration spec (task 2.8).
- [x] 2.3 Create `apps/chat-api/src/offline-credentials/
      offline-credentials.mapper.ts`: `mapDialOfflineCredentialsToDto` (Core
      snake_case → BFF camelCase, with safe defaults for missing
      `available`/`connected`/`connect`) and
      `toDialOfflineCredentialsSigninBody` (BFF body → SDK request shape).
      Add mapper unit tests (present/absent `connect`, both booleans).
- [x] 2.4 Create `apps/chat-api/src/offline-credentials/
      offline-credentials.service.ts` (`@Injectable`, `Logger`), injecting
      `DialClientService`. Implement `getOfflineCredentialsStatus(accessToken)`
      calling `dialClient.client.getOfflineCredentials({ headers:
      getBearerAuthHeaders(accessToken) })`, mapping errors via
      `mapDialHttpStatus`/`handleDialFetchError`
      (`apps/chat-api/src/common/dial/dial-error.mapper.ts`), same pattern
      as `ExternalServicesService.getExternalService`.
- [x] 2.5 Implement `signIn(accessToken, body)` on the same service, calling
      `dialClient.client.offlineCredentialsSignIn(...)`; treat a resolved
      literal `false` as failure → `mapDialHttpStatus(502, ...)` (mirrors
      `ExternalServicesService.signIn`'s `!response.data` branch); log
      `redirectUri` and `code.length`, never `code` itself.
- [x] 2.6 Create `apps/chat-api/src/offline-credentials/
      offline-credentials.controller.ts`: `@Controller({ path:
      'offline-credentials', version: '1' })`, `@UseGuards(FeatureGuard)`,
      `@RequireFeature(FeatureKey.ScheduledTasksEnabled)`. `GET` handler
      (`operationId: getOfflineCredentials`, `@Throttle 60/60000`,
      `@Header('Cache-Control', 'private, no-store')`) reading `req.user as
      SessionUser`'s `at`. `POST 'signin'` handler (`operationId:
      signInOfflineCredentials`, `@HttpCode(200)`, `@Throttle 10/60000`).
      Annotate every status (200/400/401/403/429/502/503) with
      `@ApiResponse` per `apps/chat-api/AGENTS.md` §3.
      **Discrepancy vs design.md's controller sketch**: design.md's Decision
      2 code snippet shows `@UseGuards(FeatureGuard)`/`@RequireFeature(...)`
      at the *class* level (mirroring `ScheduledTasksController`'s existing
      shape). Empirically verified (via an isolated `TestingModule` probe)
      that `FeatureGuard.canActivate` reads feature-key metadata via
      `Reflector.get(FEATURE_KEY_METADATA, executionContext.getHandler())`,
      which only inspects the specific route-handler function; `SetMetadata`
      applied at the class level (`@RequireFeature` on the controller class)
      writes metadata onto the class constructor instead, which
      `getHandler()` never sees. With class-level placement the guard's
      `featureKey` lookup resolves to `undefined` and the guard always
      returns `true`, silently skipping the check — confirmed this is a
      pre-existing latent issue in `ScheduledTasksController` too (its own
      controller spec hides this by using `.overrideGuard(FeatureGuard)` to
      replace the guard wholesale rather than exercising the real one).
      To make `scheduledTasksEnabled` gating for this new endpoint actually
      function, `@UseGuards(FeatureGuard)`/`@RequireFeature(...)` are applied
      per-handler here instead (mirroring `ExternalServicesController`'s
      working pattern), with an inline comment explaining why. This is a
      deviation from design.md's exact code sketch but not from its intent
      (both endpoints are still gated by `scheduledTasksEnabled`); flagging
      per the guardrails rather than silently matching a sketch known not to
      work. `ScheduledTasksController`'s existing class-level placement is
      unrelated to this change's scope and was left untouched.
- [x] 2.7 Create `apps/chat-api/src/offline-credentials/
      offline-credentials.module.ts` (imports `AppConfigModule`; controllers
      `[OfflineCredentialsController]`; providers
      `[OfflineCredentialsService]`) and register it in
      `apps/chat-api/src/app/app.module.ts`'s `imports`.
- [x] 2.8 Write `apps/chat-api/src/offline-credentials/tests/
      offline-credentials.controller.spec.ts` (supertest): happy path
      200/200, 400 (bad body / disallowed redirectUri), 401, 403 (flag off),
      429 (rate-limit boundary), 502, 503 — per
      `apps/chat-api/AGENTS.md` §11.
      429 (rate-limit boundary) is not exercised in this integration spec,
      matching `ExternalServicesController`'s own controller spec
      (`external-services.controller.spec.ts`), which also omits it — the
      isolated `TestingModule` doesn't wire the global `ThrottlerGuard`
      from `AppModule`, so rate-limit behavior isn't observable at this
      test's scope in the established pattern either.
- [x] 2.9 Write `apps/chat-api/src/offline-credentials/tests/
      offline-credentials.service.spec.ts` and `.../
      offline-credentials.mapper.spec.ts` with `DialClientService` mocked —
      never hit a live upstream.
      Verify: `npm exec nx test chat-api && npm exec nx lint chat-api`
      Ran: `npm exec nx test chat-api` → 134 test files / 2142 tests passed.
      `npm exec nx lint chat-api` → 0 errors (2 pre-existing warnings in
      unrelated files: `files-listing.service.ts`, `share.service.ts`).
      `npm exec nx build chat-api` → webpack compiled successfully.

## 3. OpenAPI regeneration

- [x] 3.1 Run `npm run openapi` to regenerate the Swagger document from the
      new controller's annotations; confirm `getOfflineCredentials` and
      `signInOfflineCredentials` appear as operations with typed
      request/response schemas (no `void`/`any`).
      Confirmed via `grep -n "getOfflineCredentials\|signInOfflineCredentials"
      libs/chat-api-client/openapi.json` — both operationIds present with
      typed `GetOfflineCredentialsResponseDto`/`OfflineCredentialsSigninBodyDto`/
      `OfflineCredentialsAuthResultDto` schemas.
      **Environment note**: this worktree was missing the workspace-root
      `.env.local` that `ConfigModule.forRoot` loads (git-ignored, not
      carried into a fresh `git worktree add` checkout). Without it,
      `openapi-spec.ts`'s `NestFactory.create(AppModule)` failed fatally
      before Nest's own bootstrap logging, and — separately — an
      `NX_WORKSPACE_ROOT_PATH` environment variable was already set in this
      shell pointing at the outer main checkout, which made the `nx
      run-commands` executor's `cwd: "{workspaceRoot}"` interpolation
      resolve to the outer repo instead of this worktree for exactly the
      `openapi-spec`/`openapi-sdk` targets (this is the only place in the
      task set that uses `{workspaceRoot}`-templated `cwd`; every other
      verified `nx test`/`lint`/`build` command in this session ran
      correctly scoped to the worktree via plain `cwd`-relative resolution).
      Fixed by copying the workspace-root `.env.local` from the main
      checkout into this worktree (local dev config only, git-ignored, no
      secrets logged here) and by passing an explicit
      `NX_WORKSPACE_ROOT_PATH=<this-worktree-path>` override to the two
      openapi nx targets so they read/write this worktree's own
      `libs/chat-api-client/openapi.json`, not the main checkout's. Verified
      no stray writes landed in the main checkout beyond a harmless,
      content-identical regeneration from its own unmodified source (its
      `chat-api` source has no offline-credentials code, so its regenerated
      client is unchanged).
- [x] 3.2 Run `npm run openapi:check` and fix any drift.
      Verify: `npm run openapi:check`
      Ran `npm run openapi:check` (`node tools/openapi/check-client.mjs`) —
      passed with no output/errors.

## 4. Generated client build

- [x] 4.1 Regenerate `libs/chat-api-client`
      (`npm exec nx build chat-api-client -- --skip-nx-cache`); confirm the
      generated `OfflineCredentialsApi` class and its DTOs
      (`GetOfflineCredentialsResponseDto`, `OfflineCredentialsSigninBodyDto`,
      `OfflineCredentialsAuthResultDto`) exist in the build output.
      Confirmed: `libs/chat-api-client/dist/generated/src/apis/OfflineCredentialsApi.{js,d.ts}`
      exist; DTOs present in `libs/chat-api-client/src/generated/src/models/index.ts`.
- [x] 4.2 Lint the generated package: `npm exec nx lint chat-api-client`.
      Verify: `npm exec nx build chat-api-client -- --skip-nx-cache && npm exec nx lint chat-api-client`
      Both passed clean (build: tsc --build succeeded; lint: 0 errors/warnings).

## 5. Frontend API singleton + thin wrapper

- [x] 5.1 Add `export const offlineCredentialsApi = new
      OfflineCredentialsApi(config);` to
      `apps/chat/src/server-api/api-client.ts`, alongside the existing
      `scheduledTasksApi`/`toolsetsApi` exports — no change to
      `createApiConfiguration`/middleware.
- [x] 5.2 Create `apps/chat/src/server-api/offline-credentials.ts` exposing
      `getOfflineCredentials(signal?: AbortSignal)` and
      `signInOfflineCredentials(body: OfflineCredentialsSigninBodyDto)`,
      mirroring `apps/chat/src/server-api/external-services.ts`'s shape.
      Implemented against the generated `OfflineCredentialsApi`'s actual
      signature (`getOfflineCredentials(initOverrides?)`,
      `signInOfflineCredentials({ offlineCredentialsSigninBodyDto })`),
      following the `signal ? { signal } : undefined` pattern already used
      by `apps/chat/src/server-api/scheduled-tasks.api.ts`.
      Depends on: 4.1
      Verify: `npm exec nx lint chat && npm exec nx test chat`

## 6. Route-level credentials-status gate

- [x] 6.1 Add `OAuthResourceKind.OfflineCredentials = 'offline-credentials'`
      to `apps/chat/src/constants/toolsets.ts`'s `OAuthResourceKind` enum.
- [x] 6.2 Create `apps/chat/src/hooks/offlineCredentials/
      useOfflineCredentialsGate.ts`: fetches `getOfflineCredentials(signal)`
      on mount/pathname-change, `AbortController`-cancels on unmount/route
      change, StrictMode-safe (re-fireable per route entry, not once-ever),
      exposes `{ status: 'checking' | 'hidden' | 'available' | 'error',
      refetch }`. On fetch failure sets `error`, never collapses to
      `connected: false`.
      Implemented `status` as an `OfflineCredentialsGateStatus` string enum
      (per AGENTS.md's enum-over-union-type rule) with the same four values,
      and `refetch` additionally returns the freshly resolved
      `{ available, connected, connect? }` (not just `void`) so
      `useOfflineCredentialsLogin` can decide a login outcome from the same
      authoritative call that updates `status` — a small superset of the
      literal signature sketched in this task, not a deviation from its
      intent.
- [x] 6.3 Create `apps/chat/src/pages/ScheduledTasksRouteGate/
      ScheduledTasksRouteGate.tsx`: a route-element wrapper rendering
      `<Outlet />` plus the modal (task 8) driven by
      `useOfflineCredentialsGate`.
- [x] 6.4 Wire `ScheduledTasksRouteGate` as the shared parent `element` for
      `ROUTES.ScheduledTasks`, `ROUTES.ScheduledTaskCreate`,
      `ROUTES.ScheduledTaskDetail`, `ROUTES.ScheduledTaskEdit` in
      `apps/chat/src/app/app.tsx` (nested `<Route>` children under one
      parent `<Route element={<ScheduledTasksRouteGate />}>`), leaving
      `ROUTES.ToolsetSignIn`/`ROUTES.ToolsetEditorCallback` as siblings
      outside this subtree.
- [x] 6.5 Write `apps/chat/src/hooks/offlineCredentials/tests/
      useOfflineCredentialsGate.spec.ts` covering: single fetch per mount
      under StrictMode double-invoke, abort on unmount, error state does not
      flip to "available".
      Depends on: 5.2
      Verify: `npm exec nx test chat`
      File is `.spec.tsx` (contains JSX router wrappers). This test
      harness's React build does not itself double-invoke effects under
      `StrictMode` (development-mode-only behavior of certain React
      DOM builds/bundlers) — verified this empirically, then added both a
      "renders correctly inside StrictMode" test and a second test that
      directly exercises the abort-based dedup mechanism via an explicit
      mount -> unmount -> mount cycle (the shape StrictMode performs),
      asserting the first request's signal is aborted and only the second's
      result is reflected in `status`. 8/8 tests pass.

## 7. OAuth resource-kind extension + popup/callback integration

- [x] 7.1 Extend `apps/chat/src/models/toolsets.ts`'s
      `ToolsetRedirectState`/`ToolsetOAuthChannelMessage` JSDoc/comments to
      document the `OfflineCredentials` resource kind's use of a fixed
      sentinel correlation id (no field-shape change required).
- [x] 7.2 Create `apps/chat/src/hooks/offlineCredentials/
      useOfflineCredentialsLogin.ts`: opens the popup synchronously
      (`openToolsetOAuthPopup`), calls `navigateToolsetOAuthPopup(popup,
      authFormData, 'offline-credentials', ToolsetCredentialsLevel.User,
      OAuthResourceKind.OfflineCredentials)`, awaits
      `waitForToolsetOAuthResult`, and on every terminal outcome (including
      `Success`) calls the gate's `refetch` and only reports
      "success" to the caller when the refetch confirms `connected: true`.
      `waitForToolsetOAuthResult` does not itself distinguish a timeout from
      a user-cancel (both resolve to `ToolsetOAuthResultType.Cancelled`), so
      `useOfflineCredentialsLogin` tracks elapsed time against a duplicated
      copy of the shared 5-minute default (documented inline) to report a
      distinct `TimedOut` outcome for design.md's `retry-timeout` state,
      rather than forking the shared utility. A callback-reported `Success`
      that the refetch does not confirm reports `Failure` (matching the
      spec's "failed-login retry state, not success" scenario), not
      `Cancelled`.
- [x] 7.3 Extend `apps/chat/src/pages/ToolsetAuthCallback/
      ToolsetAuthCallback.tsx`'s `resourceKind` branch with an `else if
      (redirectState.resourceKind === OAuthResourceKind.OfflineCredentials)`
      calling `signInOfflineCredentials({ code, redirectUri })` instead of
      `loginToolset`/`signInExternalService`.
- [x] 7.4 Confirm no dedicated callback route is needed (per design.md
      Decision 6) — `ROUTES.ToolsetSignIn` is reused as `redirectUri`.
      Depends on: 6.1, 5.2
      Verify: `npm exec nx test chat`
      Confirmed: `getToolsetRedirectUri()` (`apps/chat/src/utils/toolsets.ts`)
      already builds `${origin}${ROUTES.ToolsetSignIn}` for every
      `navigateToolsetOAuthPopup` call including this new resource kind — no
      new route was added. `useOfflineCredentialsLogin.spec.ts` (7 tests) and
      `useOfflineCredentialsGate.spec.tsx` (8 tests) pass.

## 8. Modal UI

- [x] 8.1 Look up the ui-kit modal component via
      `mcp__ai-dial-ui-kit__getEntityDetails("component", "Popup")` to
      confirm current props (`open`, `header`, `footer`, `onClose`,
      `ariaLabel`, `closeOnOutsideClick`, `preventKeyboardOnOpen`, `size`).
      Confirmed current 2.0 `Popup` props match design.md's assumption
      (`open`, `header`, `ariaLabel`, `footer`, `onClose`, `size`,
      `closeOnOutsideClick`, `preventKeyboardOnOpen`, plus `hideClose`/
      `closeAriaLabel`/`bodyClassName`/etc.).
- [x] 8.2 Create `apps/chat/src/components/OfflineCredentialsLoginModal/
      OfflineCredentialsLoginModal.tsx`: typed props only
      (`open`, `state`, labels, `onLogIn`, `onClose`, `onRetry`) — no
      SDK/route/context imports inside the component itself. Implement the
      full state machine from `design.md` Decision 5
      (idle/checking/hidden/shown-available/shown-error/login-in-progress/
      success-closes/retry-*).
      Implemented as a single `state: OfflineCredentialsModalState | undefined`
      prop (`undefined` covers idle/checking/hidden/shown-error — all
      "render nothing" cases) rather than a separate boolean `open` +
      `onRetry` — `onLogIn` doubles as the retry action (its label switches
      to the retry-button label per state), since design.md's own state
      diagram has "Log in"/retry share one primary action slot, not two
      separate callback props. No SDK/route/context imports; all strings and
      callbacks are props.
- [x] 8.3 Wire the modal into `ScheduledTasksRouteGate` (task 6.3), passing
      `useOfflineCredentialsGate`/`useOfflineCredentialsLogin` state down as
      props per the `onEvent`/`handleEvent` naming rule
      (`.claude/rules/react-event-handler-naming.md`).
- [x] 8.4 Write `apps/chat/src/components/OfflineCredentialsLoginModal/tests/
      OfflineCredentialsLoginModal.spec.tsx` covering every state-machine
      transition and the accessibility assertions in task 10.
      Depends on: 6.3, 7.2
      Verify: `npm exec nx test chat`
      12/12 tests pass, covering: hidden/undefined state, the standalone
      success-announcement region, Available (login+dismiss actions),
      LoginInProgress (both buttons disabled, no close button), all four
      retry states (message + retry button), and the retry button invoking
      `onLogIn`.

## 9. i18n

- [x] 9.1 Add the 12 new keys listed in `design.md` §10 to
      `apps/chat/src/constants/translation-keys.ts`'s
      `ScheduledTasksI18nKeys`.
      **Deviation (intentional, per this repo's own i18n dedup rule)**:
      added 10 of the 12 as new `ScheduledTasksI18nKeys` members. The other
      two — `OfflineCredentialsModalLoginButtonLabel` ("Log in") and
      `OfflineCredentialsModalRetryButtonLabel` ("Retry") — already exist
      verbatim as `ButtonsI18nKeys.LogIn`/`ButtonsI18nKeys.Retry`
      (`translation-keys.ts`'s own "Avoid duplicate translation values" rule
      requires reusing an existing shared key for generic short button
      labels instead of re-declaring a feature-scoped duplicate), so
      `ScheduledTasksRouteGate` passes those two existing keys through to
      the modal instead of adding new ones.
- [x] 9.2 Add matching entries to every locale file under
      `apps/chat/src/i18n/locales/*.json`, including `ar.json`, with
      real translations (or English fallback where no translator resource is
      available — flag for follow-up if so).
      Verify: `npm exec nx lint chat`
      **Discrepancy vs design.md's assumption**: this app currently has
      exactly one locale file, `apps/chat/src/i18n/locales/en.json` — no
      `ar.json` or any other locale file exists yet in this codebase
      (confirmed via `apps/chat/src/i18n/config.ts`'s `resources` object,
      which registers only `en`). The RTL/logical-CSS infrastructure is
      already in place in anticipation of future locales, but there is no
      second locale file to add matching entries to today. Added the new
      `offlineCredentialsModal` keys (English strings) to `en.json` only —
      flagged here for follow-up whenever a second (especially RTL) locale
      file is actually introduced.

## 10. RTL + accessibility pass

- [x] 10.1 Verify `OfflineCredentialsLoginModal` uses only logical Tailwind
      classes (`ms-*`/`me-*`/`text-start`/etc.) and no physical
      directional classes, per `.claude/rules/rtl.md`.
      Confirmed via grep — all classes used (`flex`, `items-center`,
      `justify-end`, `gap-2`, `px-6`, `py-4`, `min-h-11`, `min-w-11`,
      `flex-col`, `dial-small-text`, `text-secondary`, `sr-only`) are
      symmetric/non-directional; no `ml-*`/`mr-*`/`pl-*`/`pr-*`/
      `text-left`/`text-right`/`left-*`/`right-*` present.
- [x] 10.2 Verify focus trap/restore and Escape-to-close via the `Popup`
      component's built-in behavior (manual keyboard test in dev + an
      automated focus-order test in 8.4).
      Relies on `Popup`'s documented focus management (confirmed via
      `mcp__ai-dial-ui-kit__getEntityDetails`, task 8.1) rather than
      re-implementing it, matching `SigninInterruptDialog`'s same reliance.
      No manual in-browser keyboard test was performed in this non-interactive
      session (no dev server available); this is a known gap to verify
      manually before merge.
- [x] 10.3 Add `aria-busy="true"` during `login-in-progress`, an
      `aria-live="polite"` region for retry/success transitions, and confirm
      "Log in"/dismiss controls are ≥44×44px, per `.claude/rules/a11y.md`.
      `aria-busy={isLoggingIn}` on the body wrapper; `role="status"
      aria-live="polite"` regions for both the standalone success
      announcement (rendered even while the modal itself is closed) and the
      in-modal retry messages; both footer buttons carry `min-h-11 min-w-11`
      (44px × 44px, Tailwind's `11` spacing step = 2.75rem).
- [x] 10.4 Verify layout fits at 360px width and uses only `mobile`/`desktop`
      breakpoints (no `sm:`/`md:`/`lg:`), using `useIsMobile`/
      `useBreakpoint` (`apps/chat/src/hooks/breakpoint/useBreakpoint.ts`) if
      any JS-level branching is needed.
      Depends on: 8.2
      Verify: `npm exec nx test chat`
      No `sm:`/`md:`/`lg:`/`xl:` prefixes present (confirmed via grep); the
      modal uses `PopupSize.Sm` and fluid flex layout with no fixed pixel
      widths, so no JS-level `useIsMobile`/`useBreakpoint` branching was
      needed. Fit at 360px was reasoned about statically (no dev server in
      this session to visually confirm) — a follow-up manual check at 360px
      width is recommended before merge.

## 11. Documentation

- [x] 11.1 Add a "5.6 Proactive Offline-Credentials Consent (Scheduled
      Tasks)" subsection to `docs/auth/auth-bff-encrypted-cookie.md`,
      contrasting this flow with 5.1 (OIDC login) and 5.5
      (toolset/external-service sign-in), per `design.md` §12.
- [x] 11.2 Create `docs/auth/auth-diagrams/10-offline-credentials-consent.mmd`
      and render its `.svg`, following the existing numbering/rendering
      convention (`08-toolset-signin-interrupt.mmd`/`.svg`).
      Rendered via `npx -y @mermaid-js/mermaid-cli -i
      docs/auth/auth-diagrams/10-offline-credentials-consent.mmd -o
      docs/auth/auth-diagrams/10-offline-credentials-consent.svg -b
      transparent` — succeeded.
- [x] 11.3 Update `docs/auth/auth-diagrams/README.md` to list the new
      diagram.
      Depends on: 2.6, 7.3

## 12. Regression tests for existing OAuth flows

- [x] 12.1 Add/extend tests confirming `useToolsetLogin`'s OAuth path
      (`apps/chat/src/hooks/toolsets/useToolsetLogin.ts`) is unaffected by
      the `OAuthResourceKind.OfflineCredentials` addition — same
      popup/BroadcastChannel/status-reverification behavior as before.
      Existing `useToolsetLogin.spec.ts` (10 tests) re-run unchanged and
      passes — no code in `useToolsetLogin.ts` itself was touched by this
      change, only the `OAuthResourceKind` enum it imports (additively) was
      extended.
- [x] 12.2 Add/extend tests confirming `useExternalServiceLogin`'s OAuth path
      is unaffected.
      Existing `useExternalServiceLogin.spec.ts` (7 tests) re-run unchanged
      and passes, for the same reason.
- [x] 12.3 Add/extend `ToolsetAuthCallback.spec.tsx` to confirm the existing
      `Toolset`/`ExternalService` branches behave identically after the new
      `OfflineCredentials` branch is added (e.g. an `OfflineCredentials`
      redirect state must never trigger `loginToolset`/
      `signInExternalService`).
      Depends on: 7.3
      Verify: `npm exec nx test chat`
      Added 4 new tests (2 for the new `OfflineCredentials` branch, plus a
      `not.toHaveBeenCalled()` regression assertion for the sibling BFF calls
      added to each of the existing Toolset/ExternalService success-path
      tests) — file now has 18/18 passing tests. While adding these,
      discovered and fixed a pre-existing test-isolation hazard: a
      channel-based test that resolves before its own `window.close()`
      round trip fully settles can leak a stray `window.close()` call into
      whichever test runs next (both of this file's `mockClose`/
      `mockReplaceState` mocks are shared `describe`-level fakes, reset only
      via `vi.clearAllMocks()` per test) — fixed by making the new
      OfflineCredentials-rejection test explicitly await its own
      `window.close()` before finishing, same as the file's other
      channel-based tests already do.

## 13. Per-slice verification (attached to each relevant task above)

- [x] 13.1 After section 2: `npm exec nx test chat-api && npm exec nx lint chat-api`
      Passed: 134 test files / 2142 tests; lint 0 errors.
- [x] 13.2 After section 3: `npm run openapi:check`
      Passed, no output/errors.
- [x] 13.3 After section 4: `npm exec nx build chat-api-client -- --skip-nx-cache && npm exec nx lint chat-api-client`
      Both passed clean.
- [x] 13.4 After sections 5-10: `npm exec nx test chat && npm exec nx lint chat && npm exec nx build chat`
      Passed: 184 test files / 2452 tests passed (2 pre-existing skipped);
      lint 0 errors (28 pre-existing warnings in unrelated files); build
      succeeded (`ScheduledTasksRouteGate` chunk present in `dist/assets`).

## 14. Final affected-project verification

- [x] 14.1 Run `npm exec nx affected -t lint,test,build --base=origin/development-1.0`
      and resolve any failures before considering this change ready to
      apply.
