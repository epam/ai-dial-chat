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
- Construct the application path as `{name}__{version}` (`appPath`), where `version` defaults to `'0.0.1'` when not supplied; URL-encode it (`encodedPath`) only for the outgoing DIAL Core request.
- Create the application via the client's `saveCustomApplication(bucket, encodedPath, …)` with a mapped body (see below).
- On success, invalidate the `applications:list:<userSub>` cache entry via `cacheManager.del` and return `{ id: "applications/{bucket}/{appPath}" }` — the **unencoded** path, matching the resource id format used elsewhere (e.g. `listApplications`).
- Map DIAL Core non-2xx responses to the appropriate HTTP status using `mapDialHttpStatus`, and transport-level failures via `handleDialFetchError`.
- Apply `@Throttle({ default: { limit: 10, ttl: 60000 } })`.
- Not log the access token, session cookie, or any secret. Safe identifiers (`userSub`, app path) MAY be logged at debug level.
- Follow `apps/chat-api/AGENTS.md` for all controller and service conventions.

**Authorization**: Any authenticated session may call this endpoint. No additional role check is required.

**Cache**: After a successful create, delete key `applications:list:<userSub>` (TTL 30 000 ms). Do not cache the creation result itself.

**Request DTO** (`CreateApplicationBodyDto`):
```ts
{
  name: string;          // required, @IsString, @IsNotEmpty, @Matches(/^[a-zA-Z0-9 _.-]+$/)
  type?: string;         // optional — schema ID (e.g. "https://mydial.epam.com/..."); omit for a plain
                         //   custom application with no schema type. @IsString, @IsNotEmpty, @IsOptional
  description?: string;  // optional, @IsString, @IsOptional
  iconUrl?: string;      // optional, @IsString, @IsOptional, @IsUrl
  version?: string;      // optional, @IsString, @IsOptional, @Matches(/^[a-zA-Z0-9._-]+$/)
                         //   — defaults to "0.0.1" in the service
  topics?: string[];     // optional, @IsArray, @IsString({ each: true }), @IsOptional
  applicationProperties?: Record<string, unknown>; // optional, @IsObject, @IsOptional
  locales?: LocaleTextEntryDto[];  // optional additional-locale name/description entries,
                                   //   @IsArray, @ArrayMaxSize(20), @ValidateNested({ each: true })
  primaryLocale?: string;          // locale `name`/`description` are authored in; required only when
                                   //   `locales` is non-empty, validated against the locale-code pattern
}
```

The `name` and `version` allowlist patterns exist so the `{name}__{version}` resource path can be built without escaping surprises; they are the server-side counterpart of the editor's own inline validation.

**Body mapping to DIAL Core** (the SDK's `DialApplication` shape). Every field beyond the two always-present ones SHALL be omitted rather than sent empty:
```ts
{
  displayName: toLocalizedValue(displayName),   // always — a plain string, or a localized object
                                                //   when additional locales were supplied
  displayVersion: body.version ?? '0.0.1',      // always
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

The service SHALL NOT branch on `body.type` to decide `application_properties` content — that decision belongs to the caller. The frontend `GeneralForm` (`apps/chat/src/pages/AppsEditor/GeneralForm.tsx`) is the current caller, and uses the shared `isQuickAppSchema` helper to decide whether to send the QuickApps 2.0 orchestrator/contexts/tool_sets shape as `applicationProperties`.

**Response DTO** (`CreatedApplicationDto`): `{ id: string; displayName?: LocalizedText; object?: string }`. This endpoint populates only `id`, constructed locally as `applications/{bucket}/{appPath}` (unencoded); DIAL Core's save response body is not forwarded. The two optional fields exist for other producers of the same DTO.

**OpenAPI / generated client**: operationId `createApplication`. Generated method in `libs/chat-api-client/src/generated/src/apis/ApplicationsApi.ts` as `createApplicationRaw` + `createApplication`.

**i18n impact**: None (server-side only).

**RTL / UI impact**: None.

#### Scenario: Successful create returns 201 with unencoded id

- **WHEN** an authenticated user calls `POST /api/v1/applications` with `{ "name": "My App", "type": "https://mydial.epam.com/custom_application_schemas/quickapps2" }`
- **AND** `GET /v1/bucket` returns `{ "bucket": "users/alice" }`
- **AND** the DIAL Core save for the URL-encoded path `users/alice/My%20App__0.0.1` succeeds
- **THEN** the endpoint responds 201 with `{ "id": "applications/users/alice/My App__0.0.1" }` (unencoded path)
- **AND** the `applications:list:<userSub>` cache key is deleted

#### Scenario: Caller-supplied schema properties are forwarded

- **WHEN** an authenticated user calls `POST /api/v1/applications` with `applicationProperties: { orchestrator: { system_prompt: { type: 'custom', variables: {}, content: '' } }, contexts: [], tool_sets: [] }`
- **THEN** the DIAL Core save body includes `application_properties` with that exact value, since none of those keys are hoisted

#### Scenario: Deployment-level keys are hoisted out of applicationProperties

- **WHEN** `applicationProperties` carries `endpoint`, `features`, `inputAttachmentTypes`, or `maxInputAttachments` alongside schema keys
- **THEN** those four are sent as top-level DIAL Core fields and only the remaining keys go into `application_properties`

#### Scenario: Missing applicationProperties omits the field entirely

- **WHEN** an authenticated user calls `POST /api/v1/applications` without `applicationProperties`, or with only hoisted keys in it
- **THEN** the DIAL Core save body carries no `application_properties` field at all

#### Scenario: A create without a schema type omits the schema id

- **WHEN** an authenticated user calls `POST /api/v1/applications` without `type`
- **THEN** the request is accepted and the DIAL Core save body carries no `application_type_schema_id`

#### Scenario: A name with disallowed characters returns 400

- **WHEN** an authenticated user calls `POST /api/v1/applications` with a `name` containing characters outside letters, digits, spaces, underscores, dots, and dashes
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

#### Scenario: DIAL Core unavailable returns 503

- **WHEN** DIAL Core times out or is unreachable
- **THEN** the endpoint responds 503

#### Scenario: Rate limit exceeded returns 429

- **WHEN** more than 10 create requests arrive within 60 seconds for the same session
- **THEN** subsequent requests respond 429
