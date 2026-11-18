# Spec Delta

## ADDED Requirements

### Requirement: A publish whose target already exists answers 409 with code target-exists

A published copy is addressed by `{type}/public/{folder}/{name}` (applications and toolsets: `{name}__{version}`) and the path carries no author, so two authors' resources can address the same target. DIAL Core never overwrites a published resource. When `POST /api/v1/catalog/{entityType}/{entityId}/publish` is rejected because the derived target already holds a resource, the endpoint SHALL answer `409` with the body `{ statusCode: 409, message, error: "Conflict", code: "target-exists" }` instead of forwarding Core's raw message in a `400`.

The endpoint SHALL treat Core's rejection as a taken target when Core answers `400` or `409` and either the caller's own read of the derived target's metadata finds a resource, or Core's message says the target already exists. The metadata read SHALL use the caller's own bearer token. The message signal exists so that a copy the caller cannot read (hidden by access rules, or pending approval) is still reported as `target-exists`. Any other rejection SHALL keep its existing mapping.

The `409` applies to every entity type the endpoint accepts (`toolset`, `application`, `prompt`, `skill`, `project`). `code` SHALL be a new enum value, distinct from `name-taken-agent` and `name-taken-toolset`, which describe a duplicate inside the caller's own bucket. The endpoint's documented `409` response SHALL declare this body in the OpenAPI document, and `libs/chat-api-client` SHALL be regenerated from it.

#### Scenario: Second author publishes the same name to the same folder
- **GIVEN** a published copy already exists at the derived target
- **WHEN** another user publishes a different resource that derives the same target
- **THEN** the endpoint answers `409` with `code: "target-exists"`, not `400`

#### Scenario: Copy hidden from the caller
- **GIVEN** the target holds a copy the caller's metadata read cannot see
- **WHEN** Core rejects the publication with a message saying the target already exists
- **THEN** the endpoint still answers `409` with `code: "target-exists"`

#### Scenario: Unrelated Core rejection keeps its mapping
- **WHEN** Core answers `400` for any reason other than an existing target (for example an invalid folder)
- **THEN** the endpoint answers `400` with Core's message, as before

#### Scenario: Prompt, skill and project targets
- **WHEN** a prompt, skill or project publication is rejected because its target exists
- **THEN** the endpoint answers `409` with `code: "target-exists"`

### Requirement: A target-check endpoint reports whether a publish target is taken

The backend SHALL expose authenticated `GET /api/v1/catalog/{entityType}/{entityId}/publish-target` with the query parameters `folderPath` (required, validated like the publish `folderPath`) and `version` (optional, validated like the publish `version`). It SHALL answer `200` with `{ exists: boolean }`: `true` when the caller's own read of the target's metadata finds a resource, `false` when Core reports it absent.

The target SHALL be derived by the same function the publish endpoint uses, from the same `entityType`, `entityId`, `folderPath` and `version`, so a check and a publish for the same inputs address the same path. The endpoint SHALL create nothing and SHALL call Core with the caller's own bearer token.

`exists: false` means the caller could not find a resource, not that none exists: a copy hidden from the caller by access rules, or a publication still pending approval, is not detected. The publish endpoint's `409` remains the safety net for those cases, and for a publication that lands between a check and a submit.

The endpoint SHALL answer the same validation, authentication and Core-failure statuses as the publish endpoint (400, 401, 403, 404 where Core reports the entity unknown, 502, 503). It SHALL be declared in the OpenAPI document with its own response DTO, and `libs/chat-api-client` SHALL be regenerated.

#### Scenario: Target is taken
- **GIVEN** a published copy exists at the target derived from the request
- **WHEN** the caller requests the check for that entity and folder
- **THEN** the answer is `200 { "exists": true }`

#### Scenario: Target is free
- **WHEN** the caller requests the check for a folder that holds no such copy
- **THEN** the answer is `200 { "exists": false }` and nothing is created

#### Scenario: Version changes the target of an application
- **GIVEN** an application published as `{name}__1.0.0` in a folder
- **WHEN** the caller checks the same application and folder with `version=2.0.0`
- **THEN** the answer is `200 { "exists": false }`, because the target is `{name}__2.0.0`

#### Scenario: Check and publish agree
- **WHEN** the check and the publish are given the same `entityType`, `entityId`, `folderPath` and `version`
- **THEN** both derive the same target path

#### Scenario: Invalid input is rejected before Core
- **WHEN** `folderPath` or `version` fails validation
- **THEN** the endpoint answers `400` without calling Core
