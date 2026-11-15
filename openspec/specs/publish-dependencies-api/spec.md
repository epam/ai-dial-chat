# publish-dependencies-api Specification

## Purpose

Tells a publisher which resources the item they are about to publish refers to that are not in the public bucket, so they can publish those too before the published copy reaches its audience. Read-only: nothing is created, changed or blocked by these endpoints.

## Requirements

### Requirement: A catalog entity's private dependencies are listed by a read endpoint

The backend SHALL expose `GET /api/v1/catalog/:entityType/:entityId/publish-dependencies` on a new `PublishDependenciesController` in `apps/chat-api/src/publish/publish-dependencies.controller.ts`, a sibling of `PublishController` on the same versioned `catalog` path (kept apart so existing controller specs and the file size are untouched, and because this route is advisory), taking the same path parameters as the publish-history route (`CatalogEntityParamsDto`: `entityType`, `entityId`) and following `apps/chat-api/AGENTS.md` (thin controller, `@ApiTags`/`@ApiOperation`/`@ApiResponse` for every status, validated DTOs).

The response SHALL be a `ResourceDependenciesResultDto` with a `dependencies` array of `ResourceDependencyDto` entries. A `ResourceDependencyDto` has:

- `id` — the dependency's DIAL Core resource url, as stored in the reference (for example `prompts/bucket-123/Support/Greeting`);
- `name` — the display name, percent-decoded, without a trailing `__version`;
- `version` — present only for a versioned dependency (application, toolset);
- `type` — one of `application`, `toolset`, `prompt`, `skill`, `file`;
- `location` — the percent-decoded folder path of the dependency inside its owner's bucket, empty at the bucket root.

`entityId` is the same resource path the publish, unpublish and publish-history routes take, sent in the same form.

Request (shape):
```
GET /api/v1/catalog/{entityType}/{entityId}/publish-dependencies
```

Response (200):
```json
{
  "dependencies": [
    {
      "id": "prompts/bucket-123/Support/Greeting",
      "name": "Greeting",
      "type": "prompt",
      "location": "Support"
    },
    {
      "id": "toolsets/bucket-123/Search__1.0.0",
      "name": "Search",
      "version": "1.0.0",
      "type": "toolset",
      "location": ""
    }
  ]
}
```

Response (200), nothing is private:
```json
{ "dependencies": [] }
```

Error responses: `400` when `entityType` or `entityId` fails validation (`IsValidFilePath` rejects path traversal), `401` without a valid session. Every other failure is absorbed as described in "Resolution is best-effort".

Generated-client impact: `operationId: getCatalogPublishDependencies`, no request body, response `ResourceDependenciesResultDto`; frontend callers use the normal (non-`Raw`) generated method through `apps/chat/src/server-api/publish.api.ts` and `libs/chat-hooks/src/catalog/create-publish-api.ts`.

Authorization: any authenticated session. Every upstream read uses the caller's own bearer token, so the endpoint can only describe what the caller may already read.

Caching: none. The lookup runs once each time a Publish panel opens, and a cached result would hide a dependency the user published a moment ago.

Observability: no metric or analytics event. A failure is logged with `logger.warn` (message only, no token or body).

Gating: not behind `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`; it is available wherever Publish is.

#### Scenario: Private prompt referenced by an application is listed
- **GIVEN** an application whose schema marks `skills[].url` as a DIAL resource and whose `skills` contains a `dial-prompt` entry for `prompts/bucket-123/Support/Greeting`
- **WHEN** the owner requests its publish dependencies
- **THEN** the response contains that prompt with `type` `prompt`, `name` `Greeting` and `location` `Support`

#### Scenario: Public dependency is not listed
- **GIVEN** the application references `prompts/public/Org/Shared prompt`
- **WHEN** its publish dependencies are requested
- **THEN** that prompt is absent from the response

#### Scenario: Invalid entity path is rejected
- **WHEN** `entityId` contains a `..` segment
- **THEN** the request is rejected with 400 before any DIAL Core call

#### Scenario: Unauthenticated caller
- **WHEN** the request carries no valid session
- **THEN** the response is 401

### Requirement: A conversation's private dependencies are listed by a read endpoint

The backend SHALL expose `GET /api/v1/conversations/publish-dependencies?path=` on a new `ConversationPublishDependenciesController` in `apps/chat-api/src/conversations/conversation-publish-dependencies.controller.ts`, a sibling of `ConversationPublishController` on the same versioned `conversations` path, validated with the existing `ConversationPathDto` (so a project-conversation locator is rejected), and returning the same `ResourceDependenciesResultDto`. It reads the conversation from the caller's own bucket.

Generated-client impact: `operationId: getConversationPublishDependencies`, query DTO `ConversationPathDto`, response `ResourceDependenciesResultDto`, normal generated method through `apps/chat/src/server-api/conversation-publish.api.ts`. Error responses, authorization, caching, observability and gating are the same as for the catalog endpoint.

Request:
```
GET /api/v1/conversations/publish-dependencies?path=gpt-4o__Planning__0b9c
```

#### Scenario: Private application model is listed
- **GIVEN** the conversation's model is `applications/bucket-123/Research agent__2.0.0`
- **WHEN** its publish dependencies are requested
- **THEN** the response contains that application with `type` `application`, `version` `2.0.0`

#### Scenario: Project conversation locator is rejected
- **WHEN** `path` is a project-conversation locator
- **THEN** the response is 400

### Requirement: A dependency is a direct reference to a resource outside the public bucket

The set returned for an item SHALL contain only its **direct** references. A listed dependency's own references SHALL NOT be resolved. A reference is a dependency when it is a DIAL Core resource url of type application, toolset, prompt, skill or file whose bucket segment is not `public`. A reference without a bucket is not a dependency: a built-in model or bare deployment id has none and is always reachable. Duplicates SHALL collapse by `id` and keep first-seen order.

The set SHALL exclude resources that publishing the item already carries along, because they are not left private:

- a DIAL file declared by an application (`dial:file`), which DIAL Core copies and relinks on publish;
- the application's uploaded icon, which chat-api adds to the publication request;
- a file in the conversation author's own bucket, which chat-api publishes with the conversation.

#### Scenario: Only direct references are returned
- **GIVEN** an application references a private toolset that itself references a private prompt
- **WHEN** the application's publish dependencies are requested
- **THEN** the response contains the toolset and not the prompt

#### Scenario: Files that publish with the item are not dependencies
- **GIVEN** an application declares a context file in its bucket and has an uploaded icon
- **WHEN** its publish dependencies are requested
- **THEN** neither the context file nor the icon is listed

#### Scenario: Built-in model reference is ignored
- **GIVEN** an application's orchestrator `deployment_id` is the bare model id `gpt-4o`
- **WHEN** its publish dependencies are requested
- **THEN** it is not listed

#### Scenario: Duplicate reference is listed once
- **GIVEN** the same private skill is referenced twice
- **WHEN** the dependencies are requested
- **THEN** it appears once, at its first position

### Requirement: An application's dependencies are read from its own schema

For an application that has an `application_type_schema_id`, the resolver SHALL fetch that schema through `ApplicationSchemasService` and collect every value held by a property marked `dial:resource` in the application's `application_properties`, following `$ref`, `oneOf` / `anyOf` selected by the discriminating `type`, arrays and nested objects. It SHALL NOT hardcode skill, toolset or deployment shapes. Values are classified by their resource prefix (`applications/`, `toolsets/`, `prompts/`, `skills/`); a `dial:file` value is never a dependency (see the exclusions above).

An application without an `application_type_schema_id` (a plain custom application) has no dependencies.

Known gap: a quick app system prompt of `type: 'dial'` keeps its prompt in a `path` property that its schema does not mark `dial:resource`; that reference is not listed. Marking is owned by the schema, not by this endpoint.

#### Scenario: Schema-marked deployment reference is listed
- **GIVEN** the schema marks `tool_sets[].deployment_id` as `dial:resource` and an entry holds `applications/bucket-123/Calculator__1.0.0`
- **WHEN** the application's publish dependencies are requested
- **THEN** the response lists `Calculator` with `type` `application` and `version` `1.0.0`

#### Scenario: Skill of kind dial-skill is listed
- **GIVEN** the application's `skills` holds a `dial-skill` entry for `skills/bucket-123/Docs helper`
- **WHEN** its publish dependencies are requested
- **THEN** the response lists it with `type` `skill`

#### Scenario: Custom application without a schema
- **GIVEN** an application with no `application_type_schema_id`
- **WHEN** its publish dependencies are requested
- **THEN** the response is `{ "dependencies": [] }` and no schema is fetched

### Requirement: A conversation's dependencies are read from its stored body

The resolver SHALL collect, from the conversation in the caller's bucket: the conversation's `model.id`, its `assistantModelId` and each `selectedAddons` id when they are application or toolset resource urls (both model ids are read because an assistant is the model while `assistantModelId` is the model it runs on); each `custom_content.skills[].url` of a message; and each attachment `url` / `reference_url` that is a `files/` resource, after dropping a `#fragment` and an optional legacy `metadata/` prefix, whose bucket is neither the author's own nor `public`. References found only in `playback` or `replay` stacks, inline `data` attachments and external urls SHALL NOT be collected.

#### Scenario: File from another user's bucket is listed
- **GIVEN** a message attachment points at `files/other-bucket/docs/report.pdf` and the author's bucket is `bucket-123`
- **WHEN** the conversation's publish dependencies are requested
- **THEN** the response lists `report.pdf` with `type` `file` and `location` `docs`

#### Scenario: File in the author's own bucket is not listed
- **GIVEN** an attachment points at `files/bucket-123/docs/report.pdf`
- **WHEN** the dependencies are requested
- **THEN** it is not listed

#### Scenario: Private skill used by a message is listed
- **GIVEN** a message's `custom_content.skills` holds `skills/bucket-123/Docs helper`
- **WHEN** the dependencies are requested
- **THEN** the skill is listed with `type` `skill`

#### Scenario: Stack-only reference is ignored
- **GIVEN** a file is referenced only from the conversation's `replay` stack
- **WHEN** the dependencies are requested
- **THEN** it is not listed

### Requirement: Entity kinds without references resolve to an empty list

For `toolset`, `prompt`, `skill`, `project` and `model` the endpoint SHALL return `{ "dependencies": [] }` without any DIAL Core call, because their DIAL Core model carries no reference to another resource (a toolset's icon and catalog files are copied by Core on publish).

#### Scenario: Prompt has none
- **WHEN** the dependencies of a prompt are requested
- **THEN** the response is 200 with an empty list and no upstream request is made

### Requirement: Resolution is best-effort and never blocks publishing

If reading the item, its schema, or any other upstream data fails or times out, the service SHALL log a warning with `Logger` and respond 200 with an empty list. The endpoint SHALL NOT throw 502 or 503 for such a failure, because the list is advisory and publishing does not depend on it.

#### Scenario: Application read fails
- **GIVEN** DIAL Core returns 500 when the application is read
- **WHEN** its publish dependencies are requested
- **THEN** the response is 200 `{ "dependencies": [] }` and a warning is logged without the bearer token

#### Scenario: Schema fetch fails
- **GIVEN** the schema fetch fails
- **WHEN** the dependencies are requested
- **THEN** the response is 200 with an empty list

### Requirement: The dependencies reach hosts through a lib-level client contract

`libs/chat-hooks` SHALL expose `getCatalogPublishDependencies` on `createPublishApiClient` for catalog entities, returning the generated DTO, and a mapper that turns a `ResourceDependencyDto` into the publish-panel library's `PublishDependency`. The client instance is supplied by the caller; the lib never builds one. Hosts own the request wrappers (`apps/chat/src/server-api/publish.api.ts`, `apps/chat/src/server-api/conversation-publish.api.ts`); the conversation request has no lib wrapper, as for the conversation publish history, so the app wrapper calls the generated conversations API and maps the result with the same mapper.

#### Scenario: Mapper preserves display fields
- **WHEN** a DTO `{ id, name, version, type: 'toolset', location }` is mapped
- **THEN** the result carries the same `id`, `name`, `version` and `location` with the library's toolset type
