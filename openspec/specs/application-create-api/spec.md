# Spec: application-create-api

## Purpose

Defines the backend `POST /api/v1/applications` endpoint that creates a new DIAL Core application for the authenticated session user, including request/response DTOs, the DIAL Core body mapping, cache invalidation, and error mapping.
## Requirements
### Requirement: Create application endpoint

The system SHALL expose `POST /api/v1/applications` that creates a new application for the authenticated session user by calling DIAL Core.

The endpoint SHALL:
- Require a valid session; respond 401 when no session is present.
- Accept a `CreateApplicationBodyDto` request body validated by NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted).
- Use the session `accessToken` as a Bearer token for all DIAL Core calls, issued through the `@epam/ai-dial-typescript-sdk` client rather than raw `fetch`.
- First resolve the user's storage bucket via the client's `getUserBucket`, and reject with 502 when it succeeds but returns no bucket.
- Construct the application path as `{name}__{version}` (`appPath`), where `version` defaults to `'1.0.0'` when not supplied; URL-encode it with `encodeURIComponent` (`encodedPath`) for both the outgoing DIAL Core request and the returned id.
- Create the application via the client's `saveCustomApplication(bucket, encodedPath, …)` with a mapped body (see below).
- On success, invalidate the per-user applications and deployments-list caches, then return `{ id: "applications/{bucket}/{encodedPath}" }` — the **URL-encoded** path (e.g. `applications/users/alice/My%20App__1.0.0`), so a name containing spaces yields an id the client can use directly in follow-up requests such as the application preview.
- Map DIAL Core non-2xx responses to the appropriate HTTP status using `mapDialHttpStatus`, and transport-level failures via `handleDialFetchError`.
- Not log the access token, session cookie, or any secret. Safe identifiers (`userSub`, app path) MAY be logged at debug level.
- Follow `apps/chat-api/AGENTS.md` for all controller and service conventions.

**Authorization**: Any authenticated session may call this endpoint. No additional role check is required.

**Cache**: After a successful create, invalidate `applications:list:<userSub>` and `deployments:list:<userSub>` (including its `:interface:<type>` variants). Do not cache the creation result itself. Cache invalidation failures are logged and do not fail the completed create.

**Module wiring**: `ApplicationsModule` already imports `DeploymentsModule` (for `updateApplication`'s use of `DeploymentsService`), so no additional wiring is required.

**Request DTO** (`CreateApplicationBodyDto`):
```ts
{
  name: string;          // required, @IsString, @IsNotEmpty, @MaxLength(256),
                         //   @Matches(/^[a-zA-Z0-9 _.-]+$/)
  type?: string;         // optional — schema ID (e.g. "https://mydial.epam.com/..."); omit for a plain
                         //   custom application with no schema type. @IsString, @IsNotEmpty, @IsOptional
  description?: string;  // optional, @IsString, @IsOptional, @MaxLength(2000)
  iconUrl?: string;      // optional, @IsString, @IsOptional, @IsValidResourceReference (https?:// URL or a
                         //   DIAL file id "files/{bucket}/{path}", no traversal segments)
  version?: string;      // optional, @IsString, @IsOptional, @Matches(SEMVER_VERSION_PATTERN) — SemVer 2.0.0
                         //   — defaults to "1.0.0" in the service
  topics?: string[];     // optional, @IsArray, @IsString({ each: true }), @IsOptional
  applicationProperties?: Record<string, unknown>; // optional, @IsObject, @IsOptional
  locales?: LocaleTextEntryDto[];  // optional additional-locale name/description entries,
                                   //   @IsArray, @ArrayMaxSize(20), @ValidateNested({ each: true })
  primaryLocale?: string;          // locale `name`/`description` are authored in; required only when
                                   //   `locales` is non-empty, validated against the locale-code pattern
}
```

The `name` and `version` allowlist patterns exist so the `{name}__{version}` resource path can be built without escaping surprises; they are the server-side counterpart of the editor's own inline validation. The `name` and `description` length bounds come from `apps/chat-api/src/common/validators/entity-field-limits.ts` (see `entity-field-limits`) and appear as `maxLength` in the OpenAPI spec; `UpdateApplicationBodyDto` carries the same two bounds.

**Body mapping to DIAL Core** (the SDK's `DialApplication` shape). Every field beyond the two always-present ones SHALL be omitted rather than sent empty:
```ts
{
  displayName: toLocalizedValue(displayName),   // always — a plain string, or a localized object
                                                //   when additional locales were supplied
  displayVersion: body.version ?? '1.0.0',      // always
  application_type_schema_id: body.type,        // only when `type` is supplied
  application_properties: remainingProps,       // only when non-empty after the hoist below
  description,                                  // only when the composed value is non-null
  iconUrl: body.iconUrl,                        // only when supplied
  descriptionKeywords: body.topics,             // only when supplied and non-empty
  endpoint,                                     // hoisted, only when a string
  features,                                     // hoisted, only when present
  inputAttachmentTypes,                         // hoisted, only when an array
  maxInputAttachments,                          // hoisted, only when a number
}
```

`displayName`/`description` SHALL be composed from `name`, `description`, `locales`, and `primaryLocale` before mapping, so a create with additional locales stores DIAL Core's localized-text object and a create without them stores plain strings, unchanged.

**Hoisted deployment fields.** `endpoint`, `features`, `inputAttachmentTypes`, and `maxInputAttachments` are top-level DIAL Core application fields, not schema-specific configuration. The service SHALL lift them out of `applicationProperties` and send them at the top level, forwarding only the remaining keys as `application_properties`. When nothing remains after that hoist, `application_properties` SHALL be omitted entirely rather than sent as `{}`.

The service SHALL NOT branch on `body.type` to decide `application_properties` content — that decision belongs to the caller.

**Exception — forced `features.skills_supported` for Quick Apps.** The one deliberate exception to the rule above: when `body.type` matches the backend's own `isQuickAppSchema` helper (`apps/chat-api/src/common/utils/application-schema.ts`), the service SHALL force `features.skills_supported` to `true` on the DIAL Core save body, merged with any caller-supplied `features` (hoisted or not), overriding any `skills_supported` value the caller may have sent. This is a narrow, acknowledged hack: when an admin creates a Quick App from the Admin application, Admin's own UI lets them set `skills_supported`; chat has no equivalent UI control, so a Quick App created from chat would otherwise never get the flag set and would silently lose skills. Pushing this default into every individual Quick App implementation was rejected as duplicative across many places, and leaving skills broken was rejected outright — forcing it here, in the one place all chat-originated application writes already pass through, was judged the least-bad of those three options, even though it couples generic application-write logic to a QuickApp-specific business rule that doesn't otherwise belong in this endpoint.

**Response DTO** (`CreatedApplicationDto`): `{ id: string; displayName?: LocalizedText; object?: string }`. This endpoint populates only `id`, constructed locally as `applications/{bucket}/{encodedPath}` (URL-encoded); DIAL Core's save response body is not forwarded. The two optional fields exist for other producers of the same DTO.

**OpenAPI / generated client**: operationId `createApplication`; this cache-only change does not alter the generated client.

**i18n impact**: None (server-side only).

**RTL / UI impact**: None.

#### Scenario: Successful create returns 201 with URL-encoded id

- **WHEN** an authenticated user calls `POST /api/v1/applications` with `{ "name": "My App", "type": "https://mydial.epam.com/custom_application_schemas/quickapps2" }`
- **AND** `GET /v1/bucket` returns `{ "bucket": "users/alice" }`
- **AND** the DIAL Core save for the URL-encoded path `users/alice/My%20App__1.0.0` succeeds
- **THEN** the endpoint responds 201 with `{ "id": "applications/users/alice/My%20App__1.0.0" }` (URL-encoded path)
- **AND** the applications and deployments-list caches are invalidated

#### Scenario: Cached deployments list refreshes after create

- **WHEN** a client reads deployments immediately after a successful create
- **THEN** the response includes the new application rather than a pre-create cached list

#### Scenario: Caller-supplied schema properties are forwarded

- **WHEN** an authenticated user calls `POST /api/v1/applications` with `applicationProperties: { orchestrator: { system_prompt: { type: 'custom', variables: {}, content: '' } }, contexts: [], tool_sets: [] }`
- **THEN** the DIAL Core save body includes `application_properties` with that exact value, since none of those keys are hoisted

#### Scenario: Deployment-level keys are hoisted out of applicationProperties

- **WHEN** `applicationProperties` carries `endpoint`, `features`, `inputAttachmentTypes`, or `maxInputAttachments` alongside schema keys
- **THEN** those four are sent as top-level DIAL Core fields and only the remaining keys go into `application_properties`

#### Scenario: Missing applicationProperties omits the field entirely

- **WHEN** an authenticated user calls `POST /api/v1/applications` without `applicationProperties`, or with only hoisted keys in it
- **THEN** the DIAL Core save body carries no `application_properties` field at all

#### Scenario: A Quick App create forces skills_supported regardless of caller input

- **WHEN** an authenticated user calls `POST /api/v1/applications` with a `type` matching `isQuickAppSchema` (e.g. `https://mydial.epam.com/custom_application_schemas/quickapps2`), with or without a `features` value in `applicationProperties`, and with `features.skills_supported` absent, `false`, or `true`
- **THEN** the DIAL Core save body's top-level `features.skills_supported` is `true`, and any other caller-supplied `features` keys are preserved alongside it

#### Scenario: A create without a schema type omits the schema id

- **WHEN** an authenticated user calls `POST /api/v1/applications` without `type`
- **THEN** the request is accepted and the DIAL Core save body carries no `application_type_schema_id`

#### Scenario: A name with disallowed characters returns 400

- **WHEN** an authenticated user calls `POST /api/v1/applications` with a `name` containing characters outside letters, digits, spaces, underscores, dots, and dashes
- **THEN** the endpoint responds 400 and no DIAL Core call is made

#### Scenario: A name or description over its limit returns 400

- **WHEN** an authenticated user calls `POST /api/v1/applications` with a 257-character `name` or a 2001-character `description`
- **THEN** the endpoint responds 400 and no DIAL Core call is made

#### Scenario: Bucket resolves but is empty

- **WHEN** the bucket lookup succeeds but returns no bucket value
- **THEN** the endpoint responds 502

#### Scenario: Missing required field returns 400

- **WHEN** an authenticated user calls `POST /api/v1/applications` with `{}` (empty body)
- **THEN** the endpoint responds 400 with a validation error listing the missing fields

#### Scenario: Unauthenticated request returns 401

- **WHEN** `POST /api/v1/applications` is called without a valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Bucket fetch fails propagates mapped status

- **WHEN** the bucket lookup returns a non-2xx status (e.g. 401, 403)
- **THEN** the endpoint responds with the mapped HTTP status

#### Scenario: DIAL Core save conflict returns 409

- **WHEN** the DIAL Core save responds 409 (e.g. name already taken)
- **THEN** the endpoint responds 409 with the mapped error body
- **AND** neither cache is invalidated

#### Scenario: DIAL Core unavailable returns 503

- **WHEN** DIAL Core times out or is unreachable
- **THEN** the endpoint responds 503
