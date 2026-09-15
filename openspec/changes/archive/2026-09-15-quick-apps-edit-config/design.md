## Context

`PATCH /api/v1/applications/:applicationName` (`apps/chat-api/src/applications/`) already
implements the fetch-existing → spread → overwrite-supplied-fields → save-at-same-path pattern
for General-step fields, and already invalidates the applications/deployments list caches on
success (`applications-write-api` spec). Its DTO, `UpdateApplicationBodyDto`, deliberately
excludes `applicationProperties` today, so a Quick App's Settings-step configuration
(`orchestrator`, `contexts`, `skills`, `tool_sets`, `conversation_starters`, its own `features`
key, etc.) can only be changed today by the embedded, externally-owned Quick Apps Settings-step
editor over a `postMessage` protocol this repo does not control the save for
(`quick-app-authoring` spec).

Separately, `GET /api/v1/deployments/{id}/details` (`apps/chat-api/src/deployments/details/`)
is the read side any editor would load an existing application's configuration from. Its
`buildApplicationDetails` mapping currently merges a second, unrelated piece of data — the
top-level DIAL Core `features` JSON used by the plain Custom App editor's Features textarea —
into `applicationDetails.applicationProperties.features`. For a Quick App whose own
`application_properties` already has a `features` key (e.g. `timestamp`), this silently
overwrites it with unrelated data before the frontend ever sees it.

This change makes the write side accept `applicationProperties` (opt-in — every existing caller
that never sends the field is unaffected) and fixes the read side's field collision, so that a
future Edit flow (in this repo, or an external Quick Apps frontend proxying into DIAL Core) can
reliably do load → edit → save-by-same-id against this backend's existing endpoints, the same
shape `ai-dial-chat-pg`'s Agent Builder already does for its own entity.

## Goals / Non-Goals

**Goals:**
- Let `updateApplication` optionally replace `application_properties` outright, symmetric with
  `createApplication`'s existing hoist-then-map body construction.
- Preserve every existing invariant of `updateApplication` that isn't specifically about
  `applicationProperties`: same resource resolution (no path recompute from name), same
  `application_type_schema_id`/`displayVersion` carry-through rules, same cache invalidation,
  same error mapping, same rate limit.
- Fix `buildApplicationDetails` so `applicationProperties` is a verbatim passthrough of stored
  `application_properties`, and relocate the top-level DIAL Core features JSON to its own field.
- Keep the one in-repo consumer of the old merged shape (`CustomAppEditor.tsx`) working after the
  relocation.

**Non-Goals:**
- Changing `displayName`/locale full-replacement semantics. Per explicit product decision, a
  config-only save that omits `locales` still flattens an existing locale map to a plain string —
  unchanged from today. Translation preservation on a config-only save is the calling frontend's
  responsibility.
- Changing `createApplication`, `deleteApplication`, or the `applicationTypeSchemaId`/`type`
  exclusion on update.
- Building any new frontend Edit flow, Agent Builder, or wiring the embedded Quick Apps editor
  to use this endpoint instead of its own `postMessage` save — this change only makes the
  backend contract available; adopting it end-to-end is separate follow-up work (potentially in
  a different repo entirely for the Quick Apps frontend's own proxy).
- Any change to which fields DIAL Core exposes, or to `getCustomApplication`/
  `saveCustomApplication` themselves.

## Decisions

### 1. `applicationProperties` is a full-object replacement, not a deep merge

**Decision:** When supplied, `applicationProperties` fully replaces `application_properties` —
including empty arrays on any key. **Why:** the requirement is explicit that an empty
`skills`/`tool_sets`/`contexts` array must persist as a deliberate clear, which a deep merge
(keeping previously-stored non-empty arrays when the new value is empty) would defeat. Full
replacement also matches `createApplication`'s existing model (the entire
`application_properties` is constructed fresh from the request body, never merged with anything
prior) and `displayName`'s existing full-replacement behavior on update, so the endpoint has one
consistent replacement model across all its optional-object fields rather than a different rule
per field. **Alternative considered:** a recursive/shallow merge keyed on top-level object keys —
rejected because it can't distinguish "caller didn't mention this key" from "caller explicitly
cleared this key to `[]`" without inventing a sentinel, and the requirement explicitly calls out
that empty arrays must be preserved as clears.

### 2. Absence vs. `null` vs. `{}`

**Decision:** `applicationProperties` absent or `null` → untouched; `applicationProperties: {}`
→ replaced with (possibly, after hoisting, still) `{}`. **Why:** this mirrors the codebase's
established `value == null` convention (`AGENTS.md`/`all-ts.md`) for "not provided," and gives a
caller an explicit way to wipe all Settings-step configuration by sending `{}` — which a Quick
App editor might legitimately do for a freshly-emptied app. `class-validator`'s `@IsOptional()`
already treats `null` and `undefined` as "value not provided" for the field's own validators, so
no custom validator is needed to accept `null`; the service layer's existing `!= null` idiom
(already used for every other optional field in this method) naturally treats `null` the same as
`undefined`. **Alternative considered:** rejecting `null` with a 400 — rejected as unnecessary
friction; every other optional field on this DTO already silently accepts `null` as "not
provided" via the same mechanism.

### 3. Hoisting mirrors `createApplication`, with top-level fields winning

**Decision:** Before replacing `application_properties`, the same four keys
(`endpoint`/`features`/`inputAttachmentTypes`/`maxInputAttachments`) are hoisted out of a
supplied `applicationProperties`, exactly as `createApplication` already does — but if the
DTO's own top-level field of the same name is also present in the same request, the top-level
value wins. **Why:** these four are top-level DIAL Core `Application` fields, not
schema-specific configuration — the `application-create-api` spec already establishes this and
explains the service "SHALL NOT branch on `body.type`" to decide what's schema content, a rule
that should stay symmetric between create and update. Top-level-wins preserves the *existing*,
already-tested contract the plain Custom App editor relies on (it always sends these as
top-level DTO fields, never nested in `applicationProperties`) without requiring that caller to
change anything. **Alternative considered:** rejecting a request that nests one of these keys
inside `applicationProperties` while also setting it at the top level — rejected as an
unnecessary strictness that create doesn't impose either; silently preferring the top-level
value is simpler and keeps the two endpoints' mapping code structurally identical.

### 4. `customAppFeatures` as a new, separate `ApplicationDetailsDto` field

**Decision:** Add `applicationDetails.customAppFeatures?: Record<string, unknown>` for the raw
top-level DIAL Core `features` JSON, and stop writing it into
`applicationDetails.applicationProperties.features`. **Why:** `application_properties.features`
is schema-specific data some applications (Quick Apps) store as part of their own config, while
the top-level `features` JSON is unrelated DIAL Core deployment metadata the plain Custom App
editor happens to expose as raw JSON for advanced users. These are two different pieces of data
that collided only because they share the field name `features` at two different nesting
levels, not because they're the same concept — the fix is to stop conflating them, not to
rename either's meaning. A new, distinctly-named field avoids reusing the already-taken
`features` name at the `applicationDetails` level (already occupied by the allow-listed
`DeploymentFeaturesDetailsDto` capability flags sourced from `getApplication`). **Alternative
considered:** keep the merge but only when `application_properties.features` is absent (i.e.
never overwrite an existing key) — rejected because it still couples two unrelated concerns in
one field, and would still require `CustomAppEditor.tsx` to distinguish "this came from
`application_properties`" from "this came from the top-level JSON" if a Quick App is ever opened
in that editor by mistake; a separate field makes that distinction structural instead of
implicit.

### 5. No change to displayName/locale replacement (per product decision)

**Decision:** Ship this change without touching the existing "update without `locales` flattens
the stored locale map" behavior. **Why:** that behavior is already documented and tested
(`applications-write-api` spec, "Update without locales replaces an existing locale map with a
plain string"), and is relied on by every existing update caller (General-step-only saves from
both the Custom App editor and the existing Quick Apps General-step forwarding path). Changing it
would be a breaking change to callers unrelated to this proposal's actual goal (enabling
`applicationProperties`), and was explicitly deferred by product decision during scoping. A
caller that wants to preserve translations on a config-only save must resend the application's
current `locales`/`primaryLocale` — this is achievable today with `GET .../details` +
`decomposeLocalizedFields` (the same helper `CustomAppEditor.tsx` already uses), so no new
backend capability is required to support that pattern.

## Risks / Trade-offs

- **[Risk]** A caller could now unintentionally wipe a Quick App's entire configuration by
  sending `applicationProperties: {}` (e.g. a client bug that always includes the field with a
  default empty object). → **Mitigation:** this is opt-in per the DTO's `@IsOptional()`
  contract — a caller must actively decide to include the key. No mitigation beyond correct
  caller behavior is added on the backend, matching how `createApplication` already trusts its
  caller for the same field; documenting the full-replacement contract precisely (this design
  doc + the spec's scenarios) is the primary safeguard for future callers implemented in this
  repo.
- **[Risk]** `customAppFeatures` is a second near-identically-shaped optional field next to
  `applicationProperties.features`/`features`, which could confuse a future reader. →
  **Mitigation:** each field's doc comment/Swagger description explicitly cross-references the
  other two and states which raw DIAL Core source it comes from (see the `deployment-details-api`
  delta spec).
- **[Risk]** Relocating the features data `CustomAppEditor.tsx` reads is a frontend behavior
  change bundled into a backend-focused change. → **Mitigation:** scoped to the one component
  already grepped as a consumer; its existing test (`CustomAppEditor.spec.tsx`) exercises this
  path and SHALL be updated in the same change, not left for a follow-up.

## Migration Plan

No data migration — DIAL Core's stored `Application` resources are unchanged; this is a mapping
and validation change only, on both endpoints. Roll out as a normal deploy:
1. Land the DTO/service/controller changes for `updateApplication`, add tests.
2. Land the `deployments-details.service.ts` fix + `ApplicationDetailsDto.customAppFeatures`,
   update `CustomAppEditor.tsx`, add/adjust tests.
3. Regenerate OpenAPI + `@epam/ai-dial-chat-api-client` (`npm run openapi`, `npm run
   openapi:check`) in the same change, so the generated client and backend land together.
4. No feature flag — this is additive on the write side (new optional field) and a passthrough
   fix on the read side; both are safe to ship without gating. Rollback is a plain revert since
   no persisted data shape changes.

## Open Questions

None outstanding — the one material ambiguity (locale/displayName replacement semantics) was
resolved during scoping: keep the existing full-replacement rule (see Decision 5).
