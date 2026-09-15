## MODIFIED Requirements

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
- Before the replacement is written, the service SHALL apply the same hoist
  `createApplication` already applies: `endpoint`, `features`, `inputAttachmentTypes`, and
  `maxInputAttachments` SHALL be extracted from a supplied `applicationProperties` object and
  merged with (not overridden by) this DTO's own separate top-level fields of the same names —
  when both a top-level field and the corresponding key inside `applicationProperties` are
  present, the top-level field's value SHALL win, keeping this endpoint's pre-existing
  top-level-field contract (used by the plain Custom App editor) unchanged. Only the remaining
  keys are written to `application_properties`.
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
invalidated, mirroring `deleteApplication`'s cache invalidation. Because the DIAL Core write has
already succeeded at that point, a failure of the invalidation step SHALL be logged and
swallowed rather than turning a successful update into an error response. DIAL Core error
statuses SHALL be mapped to typed HTTP responses.

The endpoint SHALL be URI-versioned at `/api/v1/applications/:applicationName`,
rate-limited via `@Throttle({ default: { limit: 10, ttl: 60000 } })` (same limit as
create/delete), and documented via `@nestjs/swagger` (`@ApiOperation` with
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

#### Scenario: Deployment-level keys are hoisted out of a supplied applicationProperties
- **WHEN** an update supplies `applicationProperties: { endpoint: 'https://x.example/chat',
  features: { rate: true }, tool_sets: [] }` and no top-level `endpoint`/`features` fields
- **THEN** the merged body's top-level `endpoint` and `features` carry those hoisted values,
  and `application_properties` carries only `{ tool_sets: [] }`

#### Scenario: A top-level field wins over the same key nested in applicationProperties
- **WHEN** an update supplies both a top-level `endpoint: 'https://a.example'` and
  `applicationProperties: { endpoint: 'https://b.example' }`
- **THEN** the merged body's top-level `endpoint` is `'https://a.example'`, and no `endpoint`
  key remains inside `application_properties`

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
  `maxInputAttachments`, and omits `applicationProperties` (so no hoisted values exist either)
- **THEN** each omitted field keeps the value already stored on the application

#### Scenario: A cache-invalidation failure does not fail the update
- **WHEN** the DIAL Core save succeeds but clearing the applications or deployments list cache
  throws
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

#### Scenario: Rate limit exceeded
- **WHEN** the caller exceeds 10 update requests within 60 seconds
- **THEN** the endpoint responds `429 Too Many Requests`

#### Scenario: DIAL Core error
- **WHEN** DIAL Core returns an error status while fetching or saving the application
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. `502`/`503`)

#### Scenario: OpenAPI contract regenerated
- **WHEN** `UpdateApplicationBodyDto` gains `applicationProperties`
- **THEN** `npm run openapi` regenerates the spec, `npm run openapi:check` passes, and the
  generated `@epam/ai-dial-chat-api-client` exposes `ApplicationsApi.updateApplication(...)`
  with an `UpdateApplicationBodyDto` type that includes an optional
  `applicationProperties?: Record<string, unknown>` field and still has no `intro` field
