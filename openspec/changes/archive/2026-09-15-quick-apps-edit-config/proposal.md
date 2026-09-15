## Why

The Apps editor's Settings step for a Quick App is currently saved only by an embedded,
externally-owned editor via a cross-repo `postMessage` protocol (`quick-app-authoring` spec).
Any other caller that wants to save an existing Quick App's orchestrator/skills/tool-set
configuration — a Quick Apps frontend that proxies its own save into DIAL Core, or a future
in-repo Edit flow modeled on `ai-dial-chat-pg`'s Agent Builder (load deployment details, edit,
save back by the same id) — has no supported way to do it through this backend: `PATCH
/api/v1/applications/:applicationName` explicitly excludes `applicationProperties` from its DTO
today, by design ("this endpoint can never mutate a Quick App's schema type or its
orchestrator/tool-set configuration"). Separately, the read side that such a caller would load
config from (`GET /api/v1/deployments/{id}/details`) has a mapping bug: it merges the
top-level DIAL Core "features" JSON (used to populate the plain Custom App editor's Features
textarea) into `applicationDetails.applicationProperties.features`, which collides with and can
overwrite a Quick App's own `application_properties.features` key (e.g. `timestamp`).

## What Changes

- Extend `UpdateApplicationBodyDto` with an optional `applicationProperties?: Record<string,
  unknown>` field (validated the same way as the create DTO's field: `@IsObject()
  @IsOptional()`). Omitting it leaves the stored `application_properties` untouched, exactly as
  today; supplying it (including `{}`) fully replaces the stored `application_properties`,
  including any empty arrays it carries (an explicit clear of previously-selected files, skills,
  or toolsets). `applicationProperties: null` is treated identically to omission, matching this
  DTO's existing `@IsOptional()`/`!= null` convention — **BREAKING** only in the sense that the
  endpoint's documented invariant "this update can never affect the Settings step" no longer
  holds when the caller opts in by supplying the field; every existing caller that never sends
  `applicationProperties` is unaffected.
- Apply the same hoist as `createApplication` to the update path: `endpoint`, `features`,
  `inputAttachmentTypes`, and `maxInputAttachments` are lifted out of a supplied
  `applicationProperties` object before it replaces `application_properties`, and merged with (not
  overridden by) this DTO's existing separate top-level fields of the same names, keeping the two
  write endpoints' body-mapping rules symmetric.
- Fix `deployments-details.service.ts`'s `buildApplicationDetails`: stop merging the top-level
  DIAL Core `features` JSON into `applicationDetails.applicationProperties.features`.
  `applicationDetails.applicationProperties` becomes a verbatim passthrough of the stored
  `application_properties` object — an untouched Quick Apps config round-trips through
  read → edit → save without any foreign key mixed in. The top-level "features" JSON (what the
  plain Custom App editor's Features textarea actually edits) moves to its own new
  `applicationDetails.customAppFeatures?: Record<string, unknown>` field.
- Adapt `CustomAppEditor.tsx`, the one identified in-repo consumer of the old merged shape, to
  read the relocated `customAppFeatures` field instead of `applicationProperties.features`.
- Regenerate the OpenAPI spec and `@epam/ai-dial-chat-api-client` so
  `UpdateApplicationBodyDto.applicationProperties` and `ApplicationDetailsDto.customAppFeatures`
  are available to callers.

**Explicitly out of scope / unchanged:**
- `displayName`/locale full-replacement semantics on update are **not** changed — a config-only
  save that omits `locales` still flattens an existing locale map to a plain string, exactly as
  today. Preserving other-locale translations on a config-only save is the calling frontend's
  responsibility (resend the existing `locales`/`primaryLocale`), not a behavior this endpoint
  takes on.
- `application_type_schema_id` (schema type) remains excluded from the update DTO and is always
  carried through unchanged — this change only lifts the `applicationProperties` exclusion.
- Resource resolution (bucket/path from the existing id, fetch-merge-save at that same path, no
  new version) is already correct in `updateApplication` and is not changed by this proposal.
- No new endpoint is added; no change to `deleteApplication` or `createApplication`'s own
  request/response contracts.
- Nothing in this change adds toolset credentials to `application_properties` — the passthrough
  fix in `deployments-details.service.ts` only removes an unrelated key collision, it does not add
  any new field to what is forwarded.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `applications-write-api`: the "Update application endpoint" requirement changes —
  `UpdateApplicationBodyDto` gains `applicationProperties`, and the merge logic replaces
  `application_properties` outright when supplied (with the same endpoint/features/
  inputAttachmentTypes/maxInputAttachments hoist `createApplication` already applies), instead of
  always carrying it through unchanged.
- `deployment-details-api`: the `DeploymentDetailsDto` shape requirement changes —
  `applicationDetails.applicationProperties` stops being merged with the top-level DIAL Core
  `features` JSON, and a new `applicationDetails.customAppFeatures` field is added to carry that
  JSON instead.

## Impact

- `apps/chat-api/src/applications/dto/update-application.dto.ts` — new
  `applicationProperties` field.
- `apps/chat-api/src/applications/applications.service.ts` — `updateApplication`'s merge logic:
  hoist + full-replacement of `application_properties` when supplied.
- `apps/chat-api/src/applications/applications.controller.ts` — updated `@ApiOperation`
  description; no route/shape change beyond the DTO.
- `apps/chat-api/src/deployments/details/deployments-details.service.ts` —
  `buildApplicationDetails`'s features-merge fix.
- `apps/chat-api/src/deployments/dto/deployment-details.dto.ts` — new
  `ApplicationDetailsDto.customAppFeatures` field.
- `apps/chat/src/pages/ToolsetEditor/CustomAppEditor.tsx` — reads `customAppFeatures` instead of
  `applicationProperties.features`.
- Generated: `libs/chat-api-client` (`UpdateApplicationBodyDto`, `ApplicationDetailsDto`) via
  `npm run openapi`.
- No database/infra changes; no new environment variables; no RTL/i18n impact (server-side DTO
  and one existing frontend field-read change only).
