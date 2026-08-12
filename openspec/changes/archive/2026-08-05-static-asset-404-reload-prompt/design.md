## Context

`apps/chat-api` serves the built `apps/chat` SPA through `ServeStaticModule`
with a catch-all `renderPath` (`static-assets.ts`). Because that fallback
excluded only `/api/**` and `/overlay-sandbox/**`, a request for a static
asset that no longer exists on disk (a stale hashed chunk filename referenced
by an `index.html` a tab loaded before the last deploy) fell through to the
SPA `index.html` response — `200 text/html` — which the browser then rejects
with a MIME-type error when it expected a JS module or CSS stylesheet. The
`/assets/**` exclusion for this (both frontend and overlay sandbox) is already
implemented and tested in `static-assets.ts` / `static-assets.spec.ts` on this
branch; this design covers the remaining piece: giving long-lived tabs a way
to notice a new deployment happened and self-recover via a reload prompt,
instead of only turning the failure into a cleaner 404.

`GET /api/health` (`apps/chat-api/src/health/health.controller.ts`) is a
`@Public()`, unversioned, unthrottled infrastructure endpoint already polled
by load balancers/monitoring. It is the natural place to expose a build
identifier, since it requires no new controller, no new rate-limit
configuration, and no auth considerations.

## Goals / Non-Goals

**Goals:**

- Turn a missing static asset into a real 404 (done).
- Let a tab that has been open across a deploy detect the new deployment
  without the user needing to know something is wrong.
- Give the user an explicit, non-destructive way to pick up the new version
  (manual reload trigger), rather than auto-reloading and discarding
  in-progress input.

**Non-Goals:**

- Auto-reloading without user confirmation (risks losing an in-progress
  message draft or file upload).
- A service-worker-based asset cache-busting strategy — out of scope; the
  existing Vite hashed-asset + `emptyOutDir` build already cache-busts
  correctly for fresh page loads, the gap is only long-lived tabs.
- Versioning the `/api/health` contract itself under `/api/v{N}` — it is an
  infrastructure endpoint and stays exempt, per `apps/chat-api/AGENTS.md`.
- Detecting *which* files changed — only whether the deployment as a whole
  changed.

## Decisions

**`buildId` source: a hash of the served frontend's `index.html`, not a new
environment variable.**
`buildId` must be identical across every pod serving the same deployed image,
so all pods behind the load balancer answer polls consistently, and it must
change exactly when the frontend build changes. Rather than introducing a
dedicated `BUILD_ID` deploy-pipeline variable (extra configuration surface to
wire through CI/CD and document, and one more thing that can be forgotten or
drift out of sync with the actual deployed artifact), `HealthController`
computes it once at module load by hashing the built `apps/chat/dist/index.html`
(via `resolveFrontendRootPath` from `static-assets.ts`, already used for
serving that same file) with `crypto.createHash('sha256')`, truncated to 12
hex characters, and caches it in a module-level constant. Every pod running
the same built image bundles an identical `index.html`, so this is naturally
consistent fleet-wide with zero configuration. If no built frontend is present
on disk (e.g. running `chat-api` alone in local dev), it falls back to a
per-process timestamp value so the endpoint still returns *something* stable
for that process's lifetime; this path never executes in a real deployment,
which always serves a built `dist`. `package.json`'s `version` field is left
untouched and continues to serve its existing purpose in the health response.

_Alternatives considered:_
- A dedicated `BUILD_ID` environment variable set by the deploy pipeline
  (commit SHA / CI build number). Rejected after review — it adds a new
  required-in-practice env var to document, wire through CI, and keep in sync
  with the actual deployed frontend, for a property (fingerprint of the
  frontend build) the backend can already derive for free from a file it
  already reads.
- Parsing a build manifest emitted by the Vite build (e.g. `dist/manifest.json`
  hash). Rejected — `index.html` is already the one file both apps agree on
  (it's what `static-assets.ts` resolves and serves), so hashing it needs no
  extra knowledge of Vite's manifest format.

**Detection endpoint: extend existing `GET /api/health`, not a new endpoint.**
Reuses existing `@Public()`, unthrottled, unauthenticated infrastructure
routing and the existing generated `HealthApi.check()` client method — no new
OpenAPI surface, no new rate-limit rule, no new auth policy to define.

_Alternative considered:_ a dedicated `/api/v1/app-version` business endpoint.
Rejected as unnecessary indirection for a single string field with no other
business semantics.

**Polling, not push (SSE/WebSocket).**
A 5-minute polling interval from `useAppVersionCheck` is simple, has no
persistent-connection lifecycle to manage, and matches the acceptable latency
for this use case (users don't need to know within seconds that a new build
shipped). The hook additionally re-checks immediately when the tab regains
visibility (`visibilitychange` → `document.visibilityState === 'visible'`),
so a user returning to a long-backgrounded tab gets an up-to-date check
without waiting for the next interval tick.

_Alternative considered:_ Server-Sent Events pushed from `apps/chat-api` on
deploy. Rejected — no existing SSE infra for this purpose, and the added
complexity (connection management, reconnect/backoff) isn't justified for an
event that happens at most a few times a day.

**Once flagged, stop polling.**
After `isNewVersionAvailable` flips to `true`, the hook clears its interval.
There is nothing further to detect — the user has already been informed
their tab is stale — and continuing to poll only adds noise without new
signal, per the ADDED spec's scenario "Poll detects a newer deployed build."

**Blocking full-screen fallback (reusing the `ErrorFallback` visual pattern),
not a dismissible banner.**
`App` renders `NewVersionFallback` in place of its entire layout once
`isNewVersionAvailable` is `true`, matching the existing `ErrorFallback`
component's look (icon, heading, message, focused primary button in a
`role="alert"` container) rather than introducing a second, different-looking
"something needs your attention" pattern. This gives users one consistent
mental model for "this tab can't continue until you reload" across both
crash recovery and stale-build recovery, and removes the earlier design's
close/dismiss affordance — since there's no way to *use* a stale tab
correctly once its own JS/CSS have started 404ing on any interaction that
triggers a chunk load, letting the user dismiss the notice and keep working
would just delay the same failure.

_Alternative considered (this change's earlier revision):_ a small dismissible
banner rendered alongside the normal layout, non-blocking. Superseded by
direct feedback — a full-screen blocking prompt reusing `ErrorFallback`'s
established pattern was preferred over introducing a new, less final-feeling
UI element for what is effectively the same "stop and reload" situation.

## Risks / Trade-offs

- **[Risk]** A rolling deployment briefly runs both the old and new
  `index.html` (and therefore `buildId`) across different pods behind the
  load balancer. A poll landing on an old pod after another poll already hit
  a new pod would still report "new version" correctly (once flagged, it
  stays flagged), but a tab loaded *during* the rollout could capture either
  `buildId` as its baseline.
  → Mitigation: not a correctness issue — worst case the fallback appears
  slightly later for a tab that happened to load mid-rollout and captured the
  new `buildId` as its own baseline; it will simply catch the *next*
  deployment correctly. No user-facing harm.
- **[Risk]** In local development running only `apps/chat-api` without a built
  `apps/chat/dist`, the fallback per-process timestamp value would differ
  across horizontally-scaled instances if that setup were ever run with
  multiple replicas.
  → Mitigation: not a supported production configuration — every real
  deployment serves a built frontend `dist`, so the fallback path only ever
  runs in a single-process local dev context where there is no load balancer
  to round-robin across.
- **[Risk]** The fallback fully replaces the app, so a user with an important
  in-progress action (mid-generation response, unsent draft) loses visibility
  into it the moment a new version is detected, and there is no dismiss
  option to keep working.
  → Mitigation: reload is still a user-initiated click, not automatic —
  the user chooses when to lose that in-progress state, the same trade-off
  `RootErrorBoundary`'s crash-recovery screen already makes elsewhere in this
  app. Detection is polled at a 5-minute cadence (not instant), so this is an
  infrequent interruption, not a per-navigation one.

## Migration Plan

1. Land the already-implemented `/assets/**` 404 exclusion (no migration
   concerns — pure bug fix, backward compatible).
2. Extend `GET /api/health`'s response DTO with `buildId`, computed by hashing
   the served frontend's `index.html` (no deploy-pipeline or env var changes
   needed); regenerate `chat-api-client` (`npm run openapi && npm run openapi:check`).
3. Add `useAppVersionCheck` + `NewVersionFallback` to the frontend; `App`
   calls the hook and renders the fallback in place of its normal layout
   whenever a new version is detected, so it applies regardless of route.
4. No rollback risk beyond a standard revert — every step is additive and
   backward compatible with tabs that haven't picked up the new frontend
   bundle yet (older tabs simply won't have the new fallback, and will still
   correctly hit the fixed 404 behavior from step 1 if they request a stale
   asset).

## Open Questions

None outstanding — the `index.html`-hash approach needs no deploy-pipeline
coordination to resolve.
