## ADDED Requirements

### Requirement: Create application endpoint

The system SHALL expose `POST /api/v1/applications` that creates a new application for the authenticated session user by calling DIAL Core.

The endpoint SHALL:
- Require a valid session; respond 401 when no session is present.
- Accept a `CreateApplicationBodyDto` request body validated by NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted).
- Use the session `accessToken` as a Bearer token for all DIAL Core calls.
- First resolve the user's storage bucket via `GET {DIAL_CORE_BASE_URL}/v1/bucket`.
- Construct the application path as `{name}__{version}` (URL-encoded), where `version` defaults to `'0.0.1'` when not supplied.
- Create the application via `PUT {DIAL_CORE_BASE_URL}/v1/applications/{bucket}/{encodedPath}` with a mapped body (see below).
- On success, invalidate the `applications:list:<userSub>` cache entry via `cacheManager.del` and return `{ id: "applications/{bucket}/{encodedPath}" }`.
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
}
```

**Body mapping to DIAL Core** (snake_case, sent as JSON to `PUT /v1/applications/{bucket}/{path}`):
```ts
{
  display_name: body.name,
  display_version: body.version ?? '0.0.1',
  application_type_schema_id: body.type,
  description: body.description,  // omitted when undefined
  icon_url: body.iconUrl,          // omitted when undefined
  topics: body.topics,             // omitted when undefined or empty
}
```

**Response DTO** (`CreatedApplicationDto`): `{ id: string }` where `id` is constructed locally as `applications/{bucket}/{encodedPath}`. DIAL Core's PUT response body is not forwarded.

**OpenAPI / generated client**: operationId `createApplication`. Generated method in `libs/chat-api-client/src/generated/src/apis/ApplicationsApi.ts` as `createApplicationRaw` + `createApplication`.

**i18n impact**: None (server-side only).

**RTL / UI impact**: None.

#### Scenario: Successful create returns 201 with constructed id

- **WHEN** an authenticated user calls `POST /api/v1/applications` with `{ "name": "My App", "type": "https://mydial.epam.com/custom_application_schemas/quickapps2" }`
- **AND** `GET /v1/bucket` returns `{ "bucket": "users/alice" }`
- **AND** `PUT /v1/applications/users/alice/My%20App__0.0.1` returns 200
- **THEN** the endpoint responds 201 with `{ "id": "applications/users/alice/My%20App__0.0.1" }`
- **AND** the `applications:list:<userSub>` cache key is deleted

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
