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
be written only when present (non-`null`) in the body — `topics` additionally only when non-empty, so
`topics: []` carries the stored `descriptionKeywords` through unchanged.

**`iconUrl` clear semantics:** `iconUrl` is the one General-step field a caller can explicitly
remove. An empty string (`iconUrl: ""`) SHALL be accepted by `UpdateApplicationBodyDto` — it
skips the `@IsValidResourceReference()` check, while any other string (including whitespace)
must still be a valid `http(s)://` URL or DIAL file id — and the service SHALL drop the
`iconUrl` key from the merged body so the persisted resource no longer carries an icon. An
omitted or `null` `iconUrl` SHALL keep the stored icon. The create endpoint is unaffected (a new
application has no icon to clear). This is how the Agent Builder's "Reset to default" avatar
action removes a previously saved icon from an existing agent.

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

#### Scenario: An empty iconUrl removes the stored icon
- **WHEN** an application's stored resource has an `iconUrl` and an update supplies
  `iconUrl: ""`
- **THEN** the request passes validation, and the merged body sent to DIAL Core's
  `saveCustomApplication` has no `iconUrl` key, while every other stored field is carried
  through as usual

#### Scenario: An omitted iconUrl keeps the stored icon
- **WHEN** an update omits `iconUrl` (or sends `null`)
- **THEN** the merged body carries the stored `iconUrl` through unchanged

#### Scenario: A non-empty invalid iconUrl is still rejected
- **WHEN** an update supplies an `iconUrl` that is neither empty nor a valid resource reference
  (for example `" "` or `files/bucket/../x.png`)
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Deployment-level fields are written only when supplied
- **WHEN** the update request omits `endpoint`, `features`, `inputAttachmentTypes`, or
  `maxInputAttachments`
- **THEN** each omitted field keeps the value already stored on the application, regardless of
  whether `applicationProperties` was supplied (nothing is ever extracted from it)
- **EXCEPT** `features.skills_supported` on a Quick App: see "Quick Apps always get
  `features.skills_supported: true`" below — that one sub-field is forced on every
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
is a standing guarantee applied on every save, not a one-time default applied only at
creation. It overrides any `skills_supported` value the caller may have supplied.

For a Quick App, the Settings-step save that actually matters most (setting orchestrator/
contexts/tool_sets) is persisted entirely by the embedded Settings-step editor (loaded from
`schema.editorUrl`) through this endpoint. Because `updateApplication` forces the flag on every
Quick App update, that single save already sets `features.skills_supported`, and nothing in chat
depends on a second call to this endpoint.

`createApplication` (and only create) SHALL also default the Quick App's top-level
`features.system_prompt_supported` to `false`, because DIAL Core treats an unset flag as
supported and chat would otherwise show a system prompt field for an app whose prompt lives in its
orchestrator config. A caller-supplied `system_prompt_supported` wins, and `updateApplication`
does not touch the flag. When the create body supplies top-level `features`, they are stored as
supplied and this default is not applied, so a flag the caller leaves unset stays absent.

#### Scenario: A Quick App create defaults system_prompt_supported to false
- **WHEN** an authenticated user POSTs an application create body whose `type` matches
  `isQuickAppSchema`, with no `features` supplied
- **THEN** the DIAL Core save body's top-level `features.system_prompt_supported` is `false`

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

#### Scenario: Traversal segment in the application name is rejected
- **WHEN** the `applicationName` path parameter contains an empty, `.`, or `..` segment, raw or
  percent-encoded (e.g. `applications/b/../x`, `applications/b/./x`, `applications/b/%2e%2e/x`)
- **THEN** the endpoint responds `400 Bad Request` and does not call DIAL Core

#### Scenario: Dotted application names stay valid
- **WHEN** the `applicationName` path parameter is `a.b`, `__1.0.0__`, or
  `applications/bucket/my-app__1.0.0`
- **THEN** path validation passes

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

