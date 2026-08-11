## MODIFIED Requirements

### Requirement: GET /api/v1/deployments endpoint

The system SHALL expose `GET /api/v1/deployments` that proxies DIAL Core `GET /v1/deployments` and returns all models and applications (excluding toolsets) visible to the authenticated session user, optionally filtered by interface type.

The endpoint:
- MUST require authentication via `SessionGuard`; respond 401 when no valid session is present.
- SHALL accept an optional `interface_type` query parameter as a repeatable string value validated against `('chat' | 'embedding' | 'mcp' | 'custom_ui' | 'all')`; passing an unrecognised value MUST respond 400.
- SHALL accept an optional `refresh` query parameter validated as a boolean (`true` or `false` after DTO transformation); passing any other value MUST respond 400.
- SHALL forward the `interface_type` values to DIAL Core `GET /v1/deployments` as a single comma-joined query parameter (e.g. `interface_type=chat,mcp`) when more than one value is provided, not as repeated query keys — DIAL Core only honors the first occurrence of a repeated key.
- SHALL call DIAL Core using the `@epam/ai-dial-typescript-sdk` client (`listDeployments`), passing the session access token.
- SHALL map the DIAL Core response `deployments` array to `DeploymentItemDto[]` using the normalisation rules in the `DeploymentItemDto shape` requirement below.
- SHALL exclude toolset-typed entries (DIAL Core items with a `toolset` field present) from the mapped response, regardless of the `interface_type` filter applied — toolsets are served exclusively by the dedicated `GET /api/v1/toolsets` listing, whose payload carries fields (`auth_settings`, `endpoint`) that DIAL Core's `/v1/deployments` toolset entries do not include.
- SHALL respond 200 with `{ deployments: DeploymentItemDto[] }` on success.
- SHALL respond 502 when DIAL Core returns a non-2xx response.
- SHALL respond 503 when DIAL Core is unreachable or times out.
- SHALL apply `@Throttle({ default: { limit: 60, ttl: 60000 } })`.
- SHALL cache the unfiltered DIAL Core response under key `deployments:list:<userSub>` for 30 000 ms and filtered DIAL Core responses under key `deployments:list:<userSub>:interface:<type[,type]>` for 30 000 ms.
- SHALL, when a filtered cache entry is absent but the unfiltered cache entry is present, apply `interface_type` filtering in-process after cache retrieval without calling DIAL Core.
- SHALL bypass server-side deployments cache entirely when `refresh=true`, call DIAL Core, and replace the relevant cache entry with the fresh mapped response.
- SHALL set response header `Cache-Control: private, max-age=30` for normal requests.
- SHALL set response header `Cache-Control: private, no-store` when `refresh=true`.
- MUST NOT log the session access token.

#### Scenario: Authenticated user receives all deployments without filter

- **WHEN** `GET /api/v1/deployments` is called with a valid session and no `interface_type` parameter
- **THEN** the endpoint responds 200 with `{ deployments: DeploymentItemDto[] }` containing all models and applications from DIAL Core, with no toolset-typed entries

#### Scenario: Authenticated user filters by single interface type

- **WHEN** `GET /api/v1/deployments?interface_type=chat` is called with a valid session
- **THEN** the endpoint responds 200 with `{ deployments: DeploymentItemDto[] }` containing only deployments whose DIAL Core `interfaces` array includes `'chat'`

#### Scenario: New fields present on response items

- **WHEN** `GET /api/v1/deployments` returns items with DIAL Core `owner` populated
- **THEN** each item in the response includes `owner`, `isMy`, and (for folder-nested applications) `applicationFolder`

#### Scenario: Backward compatibility — clients ignoring new fields are unaffected

- **WHEN** an existing client calls `GET /api/v1/deployments` and does not read `owner`, `isMy`, or `applicationFolder`
- **THEN** the response is identical to the prior behavior for all pre-existing fields

#### Scenario: Authenticated user filters by multiple interface types

- **WHEN** `GET /api/v1/deployments?interface_type=chat&interface_type=mcp` is called with a valid session
- **THEN** the endpoint forwards `interface_type=chat,mcp` to DIAL Core as one comma-joined parameter
- **AND** the endpoint responds 200 with deployments matching either `'chat'` or `'mcp'` interface types

#### Scenario: MCP-interface applications are included, MCP toolsets are excluded

- **WHEN** `GET /api/v1/deployments?interface_type=mcp` is called and DIAL Core's response includes both an application with `dial:applicationTypeMcp` and a toolset, both exposing the `mcp` interface
- **THEN** the response includes the MCP-capable application
- **AND** the response does NOT include the toolset, even though it matches the requested interface

#### Scenario: Invalid interface_type value returns 400

- **WHEN** `GET /api/v1/deployments?interface_type=unknown` is called
- **THEN** the endpoint responds 400 with a validation error referencing `interface_type`

#### Scenario: Invalid refresh value returns 400

- **WHEN** `GET /api/v1/deployments?refresh=maybe` is called
- **THEN** the endpoint responds 400 with a validation error referencing `refresh`

#### Scenario: Unauthenticated request rejected

- **WHEN** `GET /api/v1/deployments` is called without a valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Rate limit exceeded

- **WHEN** the request rate exceeds 60 per minute for the client IP
- **THEN** the endpoint responds 429

#### Scenario: DIAL Core unreachable

- **WHEN** DIAL Core does not respond within the SDK timeout
- **THEN** the endpoint responds 503

#### Scenario: DIAL Core returns error

- **WHEN** DIAL Core returns a non-2xx response to `GET /v1/deployments`
- **THEN** the endpoint responds 502

#### Scenario: Cache hit — interface_type filter applied to cached list

- **WHEN** `deployments:list:<userSub>` is present in cache and `interface_type=chat` is requested
- **THEN** the service returns cached deployments filtered in-process without calling DIAL Core

#### Scenario: Refresh bypasses deployments cache

- **WHEN** `deployments:list:<userSub>:interface:chat` is present in cache and `GET /api/v1/deployments?interface_type=chat&refresh=true` is requested
- **THEN** the service calls DIAL Core instead of returning the cached entry
- **AND** the response header is `Cache-Control: private, no-store`
