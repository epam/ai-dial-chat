# applications-write-api Specification

## Purpose

The application write endpoints — create, update, and delete — their DTO contracts, the DIAL Core merge and resource-resolution rules they follow, and the cache invalidation each performs.
## Requirements
### Requirement: Create application endpoint
The backend SHALL expose `POST /api/v1/applications` that creates an application — a Quick App
or a plain custom application — by proxying DIAL Core (`saveCustomApplication`) using the
caller's session access token. The full request/response contract and DIAL Core body mapping
are owned by the `application-create-api` capability; this requirement covers only the write
surface shared with update and delete. The request body
SHALL be validated via `CreateApplicationBodyDto`. The per-user applications list cache SHALL
be invalidated on success, and DIAL Core error statuses SHALL be mapped to typed HTTP
responses. `CreateApplicationBodyDto` SHALL NOT define an `intro` field — the `intro` field is
removed from the request/response contract entirely; a request body that still includes an
`intro` property SHALL be rejected with a 400 (the global `ValidationPipe`'s
`forbidNonWhitelisted` behavior applies to any property not declared on the DTO).

#### Scenario: Successful create
- **WHEN** an authenticated user POSTs a valid application body
- **THEN** the service proxies the create to DIAL Core and returns the created application
  identifier

#### Scenario: Invalid create body
- **WHEN** the request body fails DTO validation (for example, `name` is missing)
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Request body still includes intro
- **WHEN** an authenticated user POSTs an application body that includes an `intro` property
- **THEN** the endpoint responds with a 400 validation error (unknown property) and does not
  call DIAL Core

#### Scenario: DIAL Core create error
- **WHEN** DIAL Core returns an error status during create
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. 502/503)

### Requirement: Additional-locale translations on create and update
The create and update request bodies SHALL accept an optional `locales` array of
`{language, name, description}` entries and an optional `primaryLocale` string. When `locales`
is non-empty, `primaryLocale` SHALL be required by DTO validation; each entry's `language` SHALL
be validated against a locale-code pattern, and any unrecognized property on an entry (such as a
client-side `id`) SHALL be rejected. When `locales` is absent or empty, the service SHALL send
DIAL Core a plain-string `displayName`/`description`, identical to a request that predates this
field. When `locales` is non-empty, the service SHALL compose `displayName`/`description` into a
map keyed by `primaryLocale` (seeded from `name`/`description`) plus one key per `locales` entry.
On update, this composition fully replaces any existing `displayName`/`description` on DIAL
Core, mirroring the full-replacement semantics every other General-step field already has.

#### Scenario: Create with additional locales composes a locale map
- **WHEN** an authenticated user POSTs an application body with one `locales` entry and a
  `primaryLocale`
- **THEN** the service sends DIAL Core a `displayName`/`description` map keyed by
  `primaryLocale` and by each entry's `language`

#### Scenario: Create without locales sends a plain string
- **WHEN** an authenticated user POSTs an application body with `locales` omitted
- **THEN** the service sends DIAL Core a plain-string `displayName`, unchanged from a request
  that predates additional-locale support

#### Scenario: Non-empty locales without primaryLocale is rejected
- **WHEN** an authenticated user POSTs an application body with a non-empty `locales` array and
  no `primaryLocale`
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Update without locales replaces an existing locale map with a plain string
- **WHEN** an authenticated user PATCHes an existing application whose `displayName` is
  currently a locale map, omitting `locales` from the request body
- **THEN** the service sends DIAL Core a plain-string `displayName`, replacing the existing map

### Requirement: Endpoint is versioned and documented
The create-application endpoint SHALL be URI-versioned at `/api/v1/applications`, SHALL
document every response status via
`@ApiResponse`. The Swagger schema for `CreateApplicationBodyDto` SHALL NOT reference an
`intro` field.

#### Scenario: OpenAPI contract regenerated after intro removal
- **WHEN** the `intro` field is removed from `CreateApplicationBodyDto`
- **THEN** `npm run openapi` regenerates the spec, `npm run openapi:check` passes, and the
  generated `@epam/ai-dial-chat-api-client` `CreateApplicationBodyDto` type no longer includes
  `intro`

#### Scenario: Authentication required
- **WHEN** a request to the create endpoint has no valid session cookie
- **THEN** the endpoint responds with 401

### Requirement: Update application endpoint

The backend SHALL expose `PATCH /api/v1/applications/:applicationName` that updates the
General-step fields (`name`, `description`, `iconUrl`, `topics`) and, optionally, the
Settings-step configuration (`applicationProperties`) of an existing Quick App or plain custom
application for the authenticated session user. The `applicationName` path parameter SHALL
be validated the same way as the delete endpoint's `GetApplicationDto`. The request body
SHALL be validated via `UpdateApplicationBodyDto`. That DTO SHALL exclude `type`, so this
endpoint can never mutate an application's schema type. It SHALL accept, in addition to the
General-step fields: `version` (the human-readable `displayVersion`, a General-step field for
plain custom apps), `endpoint`, `features`, `inputAttachmentTypes`, `maxInputAttachments`, an
optional `applicationProperties: Record<string, unknown>` — validated with `@IsObject()
@IsOptional()`, identical to the create DTO's field — plus `locales`/`primaryLocale`. It SHALL
NOT define an `intro` field.

The service SHALL resolve the existing DIAL Core application resource (bucket + path) the same
way `deleteApplication` does, fetch the current stored application via DIAL Core
(`getCustomApplication`), spread it, and overwrite only the supplied fields.
`application_type_schema_id` is never in the body and therefore always carried through
untouched, and `displayVersion` is carried through unless the body supplies `version`.
`displayName` SHALL be replaced outright on every update; the remaining optional fields SHALL
be written only when present in the body.

**`applicationProperties` replacement semantics:**
- When the request body omits `applicationProperties`, or supplies it as `null`, the stored
  `application_properties` SHALL be carried through unchanged — `@IsOptional()` already treats
  `null` and `undefined` as equivalent for this field's validation, and the service SHALL apply
  the same `!= null` check before touching `application_properties`, so a request that never
  sends the field (every existing caller, and every General-step-only save) behaves exactly as
  it did before this field existed.
- When the request body supplies `applicationProperties` as an object (including `{}`), it
  SHALL fully replace the stored `application_properties` — this is a full-object replacement,
  not a deep merge with the previously stored value. An empty array on any key inside the
  supplied object (e.g. `skills: []`, `tool_sets: []`, `contexts: []`) SHALL be persisted as an
  empty array, not dropped or treated as "no change" — this is how a caller explicitly clears a
  previously configured selection.
- Unlike `createApplication`, the supplied `applicationProperties` SHALL be persisted
  **verbatim**, with no hoisting of `endpoint`, `features`, `inputAttachmentTypes`, or
  `maxInputAttachments` out of it. A Quick App's own `application_properties` may itself carry a
  schema-specific key with one of these names (for example a `features` key holding
  `{ timestamp: true }`); hoisting would silently move that key to the corresponding top-level
  DIAL Core field, destroying it. This DTO's own separate top-level `endpoint`/`features`/
  `inputAttachmentTypes`/`maxInputAttachments` fields (handled above) are the only way to set
  those top-level DIAL Core fields — they are applied independently of whatever
  `applicationProperties` contains, with no precedence rule to reconcile between the two, since
  nothing is ever extracted from `applicationProperties`.
- A request body whose `applicationProperties` is present but not an object (e.g. a string or
  array) SHALL be rejected by DTO validation with a 400, and no DIAL Core call SHALL be made.
- This endpoint's `displayName`/locale replacement behavior (see "Additional-locale
  translations on create and update" below) is unchanged by this field: a request that supplies
  `applicationProperties` without `locales` still flattens an existing locale map to a plain
  string built from `name`, exactly as any other update does. Preserving other-locale
  translations on a configuration-only save is the calling frontend's responsibility (resend
  the existing `locales`/`primaryLocale`), not behavior this endpoint takes on.

The merged result SHALL be persisted via `saveCustomApplication` at the
same resource path, and the endpoint SHALL respond `200` with
`{ id: "applications/{bucket}/{path}" }`, where `path` is the encoded resource path used for
the DIAL Core call.

On success, the per-user applications list cache and the deployments list cache SHALL both be
invalidated, mirroring `deleteApplication`'s cache invalidation. The affected
`deployments:details:<userSub>:<applicationName>` entry (see the `deployment-details-api`
spec's `GET .../details` cache) SHALL also be invalidated, using the same `applicationName`
string this endpoint was called with — without this, re-opening an editor against the same id
right after a save could load the pre-update `application_properties` from the still-live
60-second details cache and silently resave it, reverting the just-made change. Because the
DIAL Core write has already succeeded at that point, a failure of any invalidation step SHALL be
logged and swallowed rather than turning a successful update into an error response. DIAL Core
error statuses SHALL be mapped to typed HTTP responses.

The endpoint SHALL be URI-versioned at `/api/v1/applications/:applicationName`
and documented via `@nestjs/swagger` (`@ApiOperation` with
`operationId: 'updateApplication'`, `@ApiResponse` for every status below). Authorization
matches `deleteApplication`: any authenticated user may update their own application, no
additional role restriction.

#### Scenario: Successful update of General-step fields only
- **WHEN** an authenticated user PATCHes `/api/v1/applications/applications%2Fusers%2Fu-123%2Fmy-app__1.0.0`
  with updated `name`, `description`, `iconUrl`, and `topics` for an application
  they own, omitting `applicationProperties`
- **THEN** the service fetches the existing stored application, merges in only the
  supplied fields, persists it at the same resource path, invalidates the
  applications and deployments list caches, and responds `200 OK` with an
  `UpdatedApplicationDto` carrying the application identifier

#### Scenario: Settings-step configuration is preserved when applicationProperties is omitted
- **WHEN** the update request omits `applicationProperties`
- **THEN** the existing `application_properties` and `application_type_schema_id` already
  stored for that application are carried through unchanged in the merged body sent to DIAL
  Core

#### Scenario: Settings-step configuration is preserved when applicationProperties is null
- **WHEN** the update request explicitly supplies `applicationProperties: null`
- **THEN** the endpoint accepts the request (validation does not reject `null`) and the
  existing `application_properties` is carried through unchanged, identically to an omitted
  field

#### Scenario: Successful update replaces the Settings-step configuration
- **WHEN** an authenticated user PATCHes the same application with `name: "My App"` and
  `applicationProperties: { orchestrator: { system_prompt: { type: 'custom', variables: {},
  content: 'v2' } }, contexts: [], tool_sets: [], skills: ['weather'] }`
- **THEN** the merged body sent to DIAL Core's `saveCustomApplication` carries that exact
  `application_properties` value in place of whatever was previously stored, while
  `application_type_schema_id` and `displayVersion` (when `version` is not also supplied) are
  carried through unchanged

#### Scenario: Empty arrays inside applicationProperties clear a previous selection
- **WHEN** an application's stored `application_properties.tool_sets` currently holds entries
  and an update supplies `applicationProperties: { tool_sets: [] }`
- **THEN** the merged body's `application_properties.tool_sets` is an empty array, not the
  previously stored entries and not an omitted key

#### Scenario: A Quick App's own features key is not hoisted or lost
- **WHEN** an update supplies `applicationProperties: { endpoint: 'https://x.example/chat',
  features: { timestamp: true }, tool_sets: [] }` and no top-level `endpoint`/`features` fields
- **THEN** the merged body's `application_properties` is exactly `{ endpoint:
  'https://x.example/chat', features: { timestamp: true }, tool_sets: [] }`, and the merged
  body's top-level `endpoint`/`features` are absent (carried through unchanged from whatever was
  previously stored, since the request supplied neither top-level field)

#### Scenario: A top-level field and the same-named key inside applicationProperties are independent
- **WHEN** an update supplies both a top-level `endpoint: 'https://a.example'` and
  `applicationProperties: { endpoint: 'https://b.example' }`
- **THEN** the merged body's top-level `endpoint` is `'https://a.example'`, and
  `application_properties.endpoint` is separately `'https://b.example'` — neither value is
  derived from or overrides the other

#### Scenario: A config-only save still flattens an existing locale map
- **WHEN** an update supplies `name` and `applicationProperties` but omits `locales`, for an
  application whose stored `displayName` is currently a locale map
- **THEN** the merged body's `displayName` is the plain string from `name`, replacing the
  existing locale map — unchanged from this endpoint's pre-existing locale behavior

#### Scenario: The stored version is kept unless the body supplies one
- **WHEN** the update request omits `version`
- **THEN** the stored `displayVersion` is carried through unchanged
- **AND** when the request does supply `version`, it replaces `displayVersion`

#### Scenario: Deployment-level fields are written only when supplied
- **WHEN** the update request omits `endpoint`, `features`, `inputAttachmentTypes`, or
  `maxInputAttachments`
- **THEN** each omitted field keeps the value already stored on the application, regardless of
  whether `applicationProperties` was supplied (nothing is ever extracted from it)
- **EXCEPT** `features.skills_supported` on a Quick App: see "Quick Apps always get
  `features.skills_supported: true`" below — that one sub-field is actively re-asserted on every
  Quick App update rather than merely carried through.

### Requirement: Quick Apps always get features.skills_supported: true

Every chat-originated Quick App create or update SHALL persist `features.skills_supported: true`; the rationale and mechanics follow.

When a user creates a Quick App from the Admin application, Admin's own UI lets them set the
`skills_supported` feature flag. Chat has no equivalent UI control for this flag, so a Quick App
created or updated from chat would otherwise never get it set, and would silently lose skills.
Three options were considered: add this default to every individual Quick App implementation
(rejected — duplicative, many places to keep in sync), leave skills broken for chat-created Quick
Apps (rejected outright), or force it in the one place all chat-originated application writes
already pass through, `ApplicationsService` in `apps/chat-api`. The third option was chosen as the
least-bad: it is a deliberate, narrow coupling of generic application-write logic to a
QuickApp-specific business rule that does not otherwise belong in this service, accepted because
the alternatives were worse.

Both `createApplication` and `updateApplication` SHALL determine whether the schema is a Quick
App via the shared `isQuickAppSchema` helper (`apps/chat-api/src/common/utils/application-schema.ts` —
`body.type` on create, `mergedBody.application_type_schema_id` on update), and, when it matches,
SHALL force the DIAL Core save body's top-level `features.skills_supported` to `true`, merged
with any other `features` keys already present on the body (caller-supplied or hoisted on
create; carried-through or caller-supplied on update). This override is unconditional: on
update, it is applied even when the request body supplies no `features` at all, since the intent
is a standing guarantee re-asserted on every save, not a one-time default applied only at
creation. It overrides any `skills_supported` value the caller may have supplied.

For a Quick App, the Settings-step save that actually matters most (setting orchestrator/
contexts/tool_sets) is persisted entirely by the embedded Settings-step editor (loaded from
`schema.editorUrl`), not by a direct call to this endpoint — see the `app-editor-flow` spec's
"A Settings-step save reasserts features.skills_supported via a follow-up updateApplication
call" requirement for how the frontend closes that gap by calling this endpoint again,
specifically to re-trigger the force-merge described here, after the embedded editor's own save
completes.

#### Scenario: A Quick App create forces skills_supported to true
- **WHEN** an authenticated user POSTs an application create body whose `type` matches
  `isQuickAppSchema`, with no `features` supplied
- **THEN** the DIAL Core save body's top-level `features.skills_supported` is `true`

#### Scenario: A Quick App update forces skills_supported to true even when features is omitted
- **WHEN** an authenticated user PATCHes an existing Quick App (whose stored
  `application_type_schema_id` matches `isQuickAppSchema`), omitting `features` from the request
  body entirely
- **THEN** the merged body sent to DIAL Core's `saveCustomApplication` carries top-level
  `features.skills_supported: true`, regardless of what was previously stored

#### Scenario: A non-Quick-App is unaffected
- **WHEN** a create or update targets an application whose schema `type`/
  `application_type_schema_id` does not match `isQuickAppSchema`
- **THEN** `features.skills_supported` is never forced, and `features` behaves exactly as
  described elsewhere in this spec (hoisted/carried-through/caller-supplied only)

#### Scenario: A successful update invalidates the deployment details cache
- **WHEN** an update succeeds for an application whose `deployments:details:<userSub>:<id>`
  entry is currently cached (e.g. from a `GET .../details` call made just before opening the
  editor)
- **THEN** that cache entry is invalidated before the response is returned, so an immediate
  subsequent `GET .../details` call for the same id re-fetches from DIAL Core instead of
  returning the pre-update snapshot

#### Scenario: A cache-invalidation failure does not fail the update
- **WHEN** the DIAL Core save succeeds but clearing the applications list, deployments list, or
  deployment details cache throws
- **THEN** the endpoint still responds `200`, and the cache failure is only logged

#### Scenario: Invalid update body
- **WHEN** the request body fails DTO validation (for example, `name` contains disallowed
  characters, or the body includes an unknown `intro` property)
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: A non-object applicationProperties is rejected
- **WHEN** the request body supplies `applicationProperties` as a string or an array instead of
  a plain object
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Invalid application name
- **WHEN** the `applicationName` path parameter contains characters disallowed by
  `DEPLOYMENT_ID_PATTERN`
- **THEN** the endpoint responds `400 Bad Request` and does not call DIAL Core

#### Scenario: Not authenticated
- **WHEN** the request has no valid session cookie
- **THEN** the endpoint responds `401 Unauthorized`

#### Scenario: Application not found
- **WHEN** DIAL Core reports the resolved application path does not exist
- **THEN** the endpoint responds `404 Not Found`

#### Scenario: DIAL Core error
- **WHEN** DIAL Core returns an error status while fetching or saving the application
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. `502`/`503`)

#### Scenario: OpenAPI contract regenerated
- **WHEN** `UpdateApplicationBodyDto` gains `applicationProperties`
- **THEN** `npm run openapi` regenerates the spec, `npm run openapi:check` passes, and the
  generated `@epam/ai-dial-chat-api-client` exposes `ApplicationsApi.updateApplication(...)`
  with an `UpdateApplicationBodyDto` type that includes an optional
  `applicationProperties?: Record<string, unknown>` field and still has no `intro` field

### Requirement: Delete application endpoint

The backend SHALL expose `DELETE /api/v1/applications/:applicationName` that deletes an
application for the authenticated session user by proxying DIAL Core
(`deleteCustomApplication`), using the caller's session access token. The
`applicationName` path parameter SHALL be validated with the same allowlist pattern used
by `GetToolsetDto.toolsetName` (`DEPLOYMENT_ID_PATTERN`/`DEPLOYMENT_ID_VALIDATION_MESSAGE`),
via a new `GetApplicationDto`. The bucket/path SHALL be resolved by parsing an
`applications/{bucket}/{path}` id when present, falling back to the caller's own bucket
plus the encoded name otherwise (mirroring `ToolsetsService.resolveToolsetResource`). On
success, the per-user applications list cache (`applications:list:${userSub}`) SHALL be
invalidated, and the per-user deployments list cache SHALL also be invalidated via
`DeploymentsService.invalidateListCache(userSub)` (clearing `deployments:list:${userSub}`
and each `deployments:list:${userSub}:interface:<type>` entry), since the Catalog UI's
application list is read through `DeploymentsService.listDeployments`, not through the
applications list cache. DIAL Core error statuses SHALL be mapped to typed HTTP responses.

The endpoint SHALL be URI-versioned at `/api/v1/applications/:applicationName`, documented via `@nestjs/swagger` (`@ApiOperation` with
`operationId: 'deleteApplication'`, `@ApiResponse` for every status below), and requires an
authenticated session (no additional role restriction — any authenticated user may delete
their own application, matching `deleteToolset`'s authorization model).

**Generated-client impact**: none — this change only alters server-side cache invalidation
side effects. The endpoint's request/response shape, `operationId`, and generated
`ApplicationsApi.deleteApplication({ applicationName })` method signature are unchanged; no
`npm run openapi` regeneration is required.

**Module wiring**: `ApplicationsModule` SHALL import `DeploymentsModule` (mirroring
`ToolsetsModule`) so `ApplicationsService` can constructor-inject `DeploymentsService`.

#### Scenario: Successful delete
- **WHEN** an authenticated user sends `DELETE /api/v1/applications/my-app__1.0`
  for an application they own
- **THEN** the service resolves the caller's bucket/path, proxies the delete to DIAL
  Core's `deleteCustomApplication`, invalidates `applications:list:${userSub}` and
  `deployments:list:${userSub}` (plus its per-interface variants), and responds with
  `204 No Content`

#### Scenario: Deployments list cache is cleared alongside the applications list cache
- **WHEN** a delete succeeds and a client subsequently calls `GET /api/v1/deployments`
  (the endpoint backing the Catalog list) for the same user, within what would have been
  the prior cache TTL window
- **THEN** the response no longer includes the deleted application, because
  `deployments:list:${userSub}` (and its `:interface:<type>` variants) were invalidated by
  the delete, not served stale

#### Scenario: Invalid application name
- **WHEN** the `applicationName` path parameter contains characters disallowed by
  `DEPLOYMENT_ID_PATTERN`
- **THEN** the endpoint responds `400 Bad Request` and does not call DIAL Core

#### Scenario: Not authenticated
- **WHEN** the request has no valid session cookie
- **THEN** the endpoint responds `401 Unauthorized`

#### Scenario: Application not found
- **WHEN** DIAL Core reports the resolved application path does not exist
- **THEN** the endpoint responds `404 Not Found`

#### Scenario: DIAL Core error
- **WHEN** DIAL Core returns an error status while deleting
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. `502`/`503`)

Example request/response:

```
DELETE /api/v1/applications/applications%2Fusers%2Fu-123%2Fmy-app__1.0.0 HTTP/1.1
Cookie: session=...

HTTP/1.1 204 No Content
```

