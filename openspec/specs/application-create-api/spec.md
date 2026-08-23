# Spec: application-create-api

## Purpose

Defines the backend `POST /api/v1/applications` endpoint that creates a new DIAL Core application for the authenticated session user, including request/response DTOs, the DIAL Core body mapping, cache invalidation, and error mapping.

## Requirements

### Requirement: Create application endpoint

The system SHALL expose `POST /api/v1/applications` that creates a new application for the authenticated session user by calling DIAL Core.

The endpoint SHALL:
- Require a valid session; respond 401 when no session is present.
- Accept a `CreateApplicationBodyDto` request body validated by NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted).
- Use the session `accessToken` as a Bearer token for all DIAL Core calls.
- First resolve the user's storage bucket via `GET {DIAL_CORE_BASE_URL}/v1/bucket`.
- Construct the application path as `{name}__{version}` (`appPath`), where `version` defaults to `'0.0.1'` when not supplied; URL-encode it (`encodedPath`) only for the outgoing DIAL Core request URL.
- Create the application via `PUT {DIAL_CORE_BASE_URL}/v1/applications/{bucket}/{encodedPath}` with a mapped body (see below).
- On success, invalidate the `applications:list:<userSub>` cache entry via `cacheManager.del` and return `{ id: "applications/{bucket}/{appPath}" }` — the **unencoded** path, matching the resource id format used elsewhere (e.g. `listApplications`).
- On a non-2xx DIAL Core response, read and log the response body (`this.logger.warn`) before mapping the status, to aid diagnosing DIAL Core validation rejections.
- Map DIAL Core non-2xx responses to the appropriate HTTP status using `mapDialHttpStatus`.
- Apply `@Throttle({ default: { limit: 10, ttl: 60000 } })`.
- Not log the access token, session cookie, or any secret. Safe identifiers (`userSub`, app path) MAY be logged at debug level.
- Follow `apps/chat-api/AGENTS.md` for all controller and service conventions.

**Authorization**: Any authenticated session may call this endpoint. No additional role check is required.

**Cache**: After a successful create, delete key `applications:list:<userSub>` (TTL 30 000 ms). Do not cache the creation result itself.

**Request DTO** (`CreateApplicationBodyDto`):
```ts
{
  name: string;          // required, @IsString, @IsNotEmpty
  type: string;          // required — schema ID (e.g. "https://mydial.epam.com/..."), @IsString, @IsNotEmpty
  description?: string;  // optional, @IsString, @IsOptional
  iconUrl?: string;      // optional, @IsString, @IsOptional, @IsUrl
  version?: string;      // optional, @IsString, @IsOptional — defaults to "0.0.1" in service
  topics?: string[];     // optional, @IsArray, @IsString({ each: true }), @IsOptional
  applicationProperties?: Record<string, unknown>; // optional, @IsObject, @IsOptional
}
```

**Body mapping to DIAL Core** (snake_case, sent as JSON to `PUT /v1/applications/{bucket}/{path}`):
```ts
{
  display_name: body.name,
  display_version: body.version ?? '0.0.1',
  application_type_schema_id: body.type,
  application_properties: body.applicationProperties ?? {},
  description: body.description,  // omitted when undefined
  icon_url: body.iconUrl,          // omitted when undefined
  topics: body.topics,             // omitted when undefined or empty
}
```

`application_properties` SHALL default to `{}` when `body.applicationProperties` is not supplied. The service SHALL NOT branch on `body.type` to decide `application_properties` content — that decision belongs to the caller. The frontend `GeneralForm` (`apps/chat/src/pages/AppsEditor/GeneralForm.tsx`) is the current caller, and uses the shared `isQuickAppSchema` helper (`apps/chat/src/utils/application-schema.ts`) to decide whether to send the QuickApps 2.0 orchestrator/contexts/tool_sets shape as `applicationProperties`.

**Response DTO** (`CreatedApplicationDto`): `{ id: string }` where `id` is constructed locally as `applications/{bucket}/{appPath}` (unencoded). DIAL Core's PUT response body is not forwarded.

**OpenAPI / generated client**: operationId `createApplication`. Generated method in `libs/chat-api-client/src/generated/src/apis/ApplicationsApi.ts` as `createApplicationRaw` + `createApplication`.

**i18n impact**: None (server-side only).

**RTL / UI impact**: None.

#### Scenario: Successful create returns 201 with unencoded id

- **WHEN** an authenticated user calls `POST /api/v1/applications` with `{ "name": "My App", "type": "https://mydial.epam.com/custom_application_schemas/quickapps2" }`
- **AND** `GET /v1/bucket` returns `{ "bucket": "users/alice" }`
- **AND** `PUT /v1/applications/users/alice/My%20App__0.0.1` (URL-encoded path) returns 200
- **THEN** the endpoint responds 201 with `{ "id": "applications/users/alice/My App__0.0.1" }` (unencoded path)
- **AND** the `applications:list:<userSub>` cache key is deleted

#### Scenario: Caller-supplied applicationProperties is forwarded as-is

- **WHEN** an authenticated user calls `POST /api/v1/applications` with `applicationProperties: { orchestrator: { system_prompt: { type: 'custom', variables: {}, content: '' } }, contexts: [], tool_sets: [] }`
- **THEN** the DIAL Core `PUT` body includes `application_properties` with that exact value

#### Scenario: Missing applicationProperties sends empty application_properties

- **WHEN** an authenticated user calls `POST /api/v1/applications` without `applicationProperties`
- **THEN** the DIAL Core `PUT` body includes `application_properties: {}`

#### Scenario: DIAL Core rejection is logged with response body

- **WHEN** `PUT /v1/applications/{bucket}/{path}` responds with a non-2xx status and a JSON error body
- **THEN** the service reads the response body and logs it at `warn` level before mapping the status
- **AND** the access token and session cookie are never included in that log line

#### Scenario: Missing required field returns 400

- **WHEN** an authenticated user calls `POST /api/v1/applications` with `{}` (empty body)
- **THEN** the endpoint responds 400 with a validation error listing the missing fields

#### Scenario: Unauthenticated request returns 401

- **WHEN** `POST /api/v1/applications` is called without a valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Bucket fetch fails propagates mapped status

- **WHEN** `GET /v1/bucket` returns a non-2xx status (e.g. 401, 403)
- **THEN** the endpoint responds with the mapped HTTP status

#### Scenario: DIAL Core PUT conflict returns 409

- **WHEN** `PUT /v1/applications/{bucket}/{path}` responds 409 (e.g. name already taken)
- **THEN** the endpoint responds 409 with the mapped error body

#### Scenario: DIAL Core unavailable returns 503

- **WHEN** DIAL Core times out or is unreachable
- **THEN** the endpoint responds 503

#### Scenario: Rate limit exceeded returns 429

- **WHEN** more than 10 create requests arrive within 60 seconds for the same session
- **THEN** subsequent requests respond 429
