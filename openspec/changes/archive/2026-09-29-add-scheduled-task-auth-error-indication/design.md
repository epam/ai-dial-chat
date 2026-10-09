# Design: add-scheduled-task-auth-error-indication

## Context

Issue #9046: with the external Scheduler auth service logged out, Core answers scheduled-task update/create with a bare `403 {"message": "Forbidden"}` (verified: no error code, and the toast's Request ID matches Core's `traceparent`). The BFF passes the 403 through `mapDialHttpStatus` unchanged, so the frontend sees 403. Today the edit/create catch blocks map field-error codes, handle 404, and fall back to the generic toast — the bug. The login banner is list-route-scoped by spec and the gate state does not exist on the edit/create routes.

## Goals / Non-Goals

**Goals:** a user whose edit/create fails because the external session dropped gets a truthful indication, without losing unsaved edits, with one extra request only on the 403 path.

**Non-Goals:** activation/delete (empirically not blocked by Core); inline login UI; BFF changes; caching; auto-signout.

## Decisions

### D1 — Two-signal disambiguation: 403 + one fresh status check
Neither signal alone suffices: a bare 403 is also a genuine permission denial, and a cached `connected` value is stale-able and doesn't exist on these routes. On a 403 the page makes exactly one `GET /api/v1/offline-credentials` call (the same authoritative check the login/signout flows use); `connected: false` + `available: true` → auth-expired toast, anything else → today's generic handling.
*Alternatives rejected:* 403-only (ambiguous); BFF-side check (domain coupling, racy, same call count).

### D2 — No caching of the determination
A cached "disconnected" determination has no invalidation event for out-of-app re-establishment (Admin panel — named in the bug report), so it can misattribute a later genuine 403; TTL patches reintroduce the calls it existed to avoid. The check is a bodyless GET on a path where the user has already paid a full update call, so per-403 re-checking is cheap and always correct.
*Alternative rejected:* check once per "episode", invalidate on login — the invalidation hole (above).

### D3 — Toast-only indication; form state untouched
A specific toast replaces the generic one on the auth-expired path. No navigation (which would discard unsaved edits), no inline notice or login action (heavier than the bug warrants — user decision). The user logs in at their leisure from the Scheduled tasks list page, where the existing banner appears on route entry.

### D4 — Scope: edit + create only
Verified empirically by the user: activation and delete are not blocked by Core when the external service is logged out, so their flows are untouched. Both affected pages share the same form component family and the same catch-block shape.

### D5 — Shared helper, one implementation site
Both pages' catch blocks call one shared helper (app-level hook/util) that performs the check and decides the indication, so the disambiguation rule has a single owner; pages keep their own toasts and state handling.

## Risks / Trade-offs

- [User fixes the session in the Admin panel, then hits a genuine 403] → the fresh check reports `connected: true`, so the generic toast shows — correct; no risk from D2.
- [Check adds one round-trip to the failure path] → accepted: the user is already seeing an error; the check is bodyless and cheap.
- [User retries Save repeatedly while disconnected] → one check per retry — bounded by retries of an action that already costs a full update call each time; accepted per D2.

## Migration Plan

Additive, frontend-only. Slices: i18n key → shared helper + tests → edit page + spec → create page + spec → docs check + validation. Rollback: remove the helper call and the key.

## Open Questions

- None — the indication shape (toast), scope (edit + create), and no-cache rule are decided.
