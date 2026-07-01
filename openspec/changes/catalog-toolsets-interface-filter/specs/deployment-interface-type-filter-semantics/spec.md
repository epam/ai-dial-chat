## ADDED Requirements

### Requirement: interfaceTypes filter semantics on GET /api/v1/deployments

The system SHALL enforce explicit per-value semantic inclusion and exclusion rules when filtering deployments by `interfaceTypes`. Rules are applied **in-process** inside `DeploymentsService` after unfiltered list retrieval (from cache or DIAL Core), using `DeploymentItemDto.type` and `DeploymentItemDto.interfaces` as the predicate inputs.

Allowed values and their semantics:

| Value | Included `type` values | Additional `interfaces` condition |
|---|---|---|
| `chat` | `model`, `application` | `interfaces` array includes `'chat'`; toolsets are **never** included |
| `embedding` | `model` only | `interfaces` array includes `'embedding'`; applications and toolsets are **never** included |
| `mcp` | `toolset`, `application` | toolsets always pass; applications pass only when `interfaces` includes `'mcp'`; models are **never** included |
| `custom_ui` | `application` only | `interfaces` array includes `'custom_ui'`; models and toolsets are **never** included |
| `all` | `model`, `application`, `toolset` | no `interfaces` check; all items pass |

When `interfaceTypes` is omitted, behavior is identical to `all`.

When an item has `interfaces: undefined` or `interfaces: []`, it passes only `all` (or the omitted case) and no other filter value.

When multiple values are provided (e.g. `interfaceTypes=chat&interfaceTypes=mcp`), an item passes if it satisfies **any** of the requested filter values (union semantics).

Invalid values (not in the allowed enum) SHALL result in HTTP 400.

#### Scenario: chat filter excludes toolsets even if interfaces array contains chat

- **WHEN** a toolset item has `type: 'toolset'` and `interfaces: ['chat']`
- **AND** `GET /api/v1/deployments?interfaceTypes=chat` is called
- **THEN** the toolset is excluded from the response

#### Scenario: chat filter includes model with chat interface

- **WHEN** a model item has `type: 'model'` and `interfaces: ['chat']`
- **AND** `GET /api/v1/deployments?interfaceTypes=chat` is called
- **THEN** the model is included in the response

#### Scenario: chat filter includes application with chat interface

- **WHEN** an application item has `type: 'application'` and `interfaces: ['chat']`
- **AND** `GET /api/v1/deployments?interfaceTypes=chat` is called
- **THEN** the application is included in the response

#### Scenario: embedding filter excludes applications

- **WHEN** an application item has `type: 'application'` and `interfaces: ['embedding']`
- **AND** `GET /api/v1/deployments?interfaceTypes=embedding` is called
- **THEN** the application is excluded from the response

#### Scenario: embedding filter excludes toolsets

- **WHEN** a toolset item has `type: 'toolset'`
- **AND** `GET /api/v1/deployments?interfaceTypes=embedding` is called
- **THEN** the toolset is excluded from the response

#### Scenario: embedding filter includes model with embedding interface

- **WHEN** a model item has `type: 'model'` and `interfaces: ['embedding']`
- **AND** `GET /api/v1/deployments?interfaceTypes=embedding` is called
- **THEN** the model is included in the response

#### Scenario: mcp filter excludes models

- **WHEN** a model item has `type: 'model'` and `interfaces: ['mcp']`
- **AND** `GET /api/v1/deployments?interfaceTypes=mcp` is called
- **THEN** the model is excluded from the response

#### Scenario: mcp filter includes toolsets unconditionally

- **WHEN** a toolset item has `type: 'toolset'` and `interfaces` is absent
- **AND** `GET /api/v1/deployments?interfaceTypes=mcp` is called
- **THEN** the toolset is included in the response

#### Scenario: mcp filter includes application with mcp interface

- **WHEN** an application item has `type: 'application'` and `interfaces: ['mcp']`
- **AND** `GET /api/v1/deployments?interfaceTypes=mcp` is called
- **THEN** the application is included in the response

#### Scenario: mcp filter excludes application without mcp interface

- **WHEN** an application item has `type: 'application'` and `interfaces: ['chat']`
- **AND** `GET /api/v1/deployments?interfaceTypes=mcp` is called
- **THEN** the application is excluded from the response

#### Scenario: custom_ui filter excludes models

- **WHEN** a model item has `type: 'model'` and `interfaces: ['custom_ui']`
- **AND** `GET /api/v1/deployments?interfaceTypes=custom_ui` is called
- **THEN** the model is excluded from the response

#### Scenario: custom_ui filter excludes toolsets

- **WHEN** a toolset item has `type: 'toolset'`
- **AND** `GET /api/v1/deployments?interfaceTypes=custom_ui` is called
- **THEN** the toolset is excluded from the response

#### Scenario: custom_ui filter includes application with custom_ui interface

- **WHEN** an application item has `type: 'application'` and `interfaces: ['custom_ui']`
- **AND** `GET /api/v1/deployments?interfaceTypes=custom_ui` is called
- **THEN** the application is included in the response

#### Scenario: all filter includes every deployment type

- **WHEN** `GET /api/v1/deployments?interfaceTypes=all` is called
- **THEN** the response contains models, applications, and toolsets regardless of their `interfaces` values

#### Scenario: omitted interfaceTypes returns all deployments

- **WHEN** `GET /api/v1/deployments` is called with no `interfaceTypes` parameter
- **THEN** the response contains models, applications, and toolsets — identical to `interfaceTypes=all`

#### Scenario: item with absent interfaces passes only all filter

- **WHEN** a model item has `type: 'model'` and `interfaces` is `undefined`
- **AND** `GET /api/v1/deployments?interfaceTypes=chat` is called
- **THEN** the model is excluded from the response

#### Scenario: multi-value filter uses union semantics

- **WHEN** `GET /api/v1/deployments?interfaceTypes=chat&interfaceTypes=mcp` is called
- **AND** the full deployment list contains 1 chat model, 1 toolset, 1 embedding model
- **THEN** the response contains the chat model and the toolset; the embedding model is excluded

#### Scenario: comma-separated multi-value is accepted

- **WHEN** `GET /api/v1/deployments?interfaceTypes=chat,mcp` is called
- **THEN** the behavior is identical to `interfaceTypes=chat&interfaceTypes=mcp`

#### Scenario: invalid interfaceTypes value returns 400

- **WHEN** `GET /api/v1/deployments?interfaceTypes=unknown` is called
- **THEN** the endpoint responds 400 with a validation error referencing `interfaceTypes`
