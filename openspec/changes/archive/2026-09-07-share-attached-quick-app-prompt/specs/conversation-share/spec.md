## MODIFIED Requirements

### Requirement: Conversation share reuses the existing generic share-link endpoint

No new backend endpoint is introduced. `ShareConversationPopoverContainer` SHALL call the existing `getShareLink(itemId, access)` utility (`apps/chat/src/utils/share-link.ts`), which POSTs to `POST /api/v1/share` via `createShareLink` (`apps/chat/src/server-api/share.api.ts`), passing the conversation's DIAL Core resource path as `itemId` and `access: [ShareLinkAccess.View]`.

The backend `POST /api/v1/share` (`apps/chat-api/src/share/share.controller.ts`) `@ApiOperation.description` SHALL be updated to state it creates a share link "for a DIAL Core resource (catalog entity or conversation)", replacing the catalog-only wording. `CreateShareLinkDto`, response DTOs, and the `@Throttle({ limit: 20, ttl: 60000 })` rate limit are unchanged. Conversation-specific related-resource resolution is defined below; non-conversation resources continue to be proxied directly without an additional lookup.

#### Scenario: Conversation itemId is accepted by the existing endpoint

- **WHEN** `POST /api/v1/share` is called with `{ itemId: '<owned-conversation-path>', access: ['view'] }`
- **THEN** the request is validated, the conversation and its related DIAL file resources are resolved server-side, and all resolved resources are included in the request proxied to DIAL Core

#### Scenario: Non-conversation, non-application itemId requires no related-resource lookup

- **WHEN** `POST /api/v1/share` is called with a toolset, skill, model, or prompt `itemId`
- **THEN** the backend does not call DIAL Core's conversation-read or application-read API and proxies the resolved `itemId` directly to the sharing API

#### Scenario: Swagger description reflects conversation support

- **WHEN** the OpenAPI spec is generated (`npm run openapi`)
- **THEN** the `createShareLink` operation description mentions conversations as a valid shareable resource

## ADDED Requirements

### Requirement: Sharing an application includes its attached prompt resources

Before calling DIAL Core's `shareResource`, `ShareService.createShareLink` SHALL load a quick app whose resolved resource URL starts with `applications/`. The read SHALL parse `applications/{bucket}/{path}` via `parseDialApplicationResource` (`apps/chat-api/src/common/utils/dial-application-resource.ts`) into the `bucket`/`path` pair, call `getCustomApplication(bucket, path)`, and forward the caller's bearer token — the same resolution `buildApplicationDetails` already uses.

The service SHALL collect unique DIAL prompt resource URLs from `application_properties.skills[]` entries whose `type` is exactly `'dial-prompt'`. Only entries whose `url` is a DIAL Core prompt resource url (`prompts/{bucket}/{path}`, per `isPromptResourceUrl`) are shareable. The `orchestrator.system_prompt` (`type: 'custom'`, inline content), `contexts[]` (file resources), `tool_sets[]`, and every other skill kind carry no separate DIAL resource and SHALL NOT be added to the sharing request. Deduplication is by exact url string, in first-seen order.

The application resource SHALL remain the first item in `shareResource.resources`, followed by each unique related prompt resource. Every related prompt SHALL receive the same resolved permissions as the application (`READ` for view access, `READ` and `WRITE` for edit access).

A referenced prompt whose bucket (`getResourceBucket`, segment `[1]` of a `prompts/{bucket}/...` url) is neither the application's own bucket nor the public/organization bucket (`PUBLIC_BUCKET`, `apps/chat-api/src/conversations/constants/conversation.constants.ts`) SHALL be silently omitted rather than failing the share — DIAL Core rejects a single share request mixing more than one owning bucket, and the caller cannot grant access to a prompt in another user's private bucket.

The application pre-read is best-effort: it MUST NOT block sharing the application itself. If the read throws, returns an upstream error, or returns no data (an empty body, or a plain custom application with no `application_properties`), the failure SHALL be logged as a warning and the share SHALL proceed with the application resource alone — no related prompts, no failure. Before this related-resource lookup existed, an `applications/...` itemId could be shared as long as `shareResource` succeeded; the pre-read never gates that baseline path. The attached prompts are an enhancement on top of it, not a precondition.

#### Scenario: Attached dial-prompt is shared alongside the application

- **GIVEN** an owned quick app references `prompts/owner-bucket/My prompt` via a `dial-prompt` skill
- **WHEN** a view share link is created for `applications/owner-bucket/My%20App__1.0`
- **THEN** `shareResource.resources` contains the application first and `prompts/owner-bucket/My prompt` second, both with `permissions: ['READ']`

#### Scenario: Duplicate prompt references are shared once

- **GIVEN** the same prompt url appears in multiple `dial-prompt` skill entries alongside a `type: 'custom'` skill
- **WHEN** a share link is created
- **THEN** the prompt url appears exactly once in `shareResource.resources` and the custom skill contributes nothing

#### Scenario: Cross-bucket private prompt is dropped

- **GIVEN** a quick app references `prompts/other-user-bucket/theirs` via a `dial-prompt` skill
- **WHEN** a share link is created for `applications/owner-bucket/my-app__1.0`
- **THEN** `prompts/other-user-bucket/theirs` is omitted from `shareResource.resources` and the share still succeeds

#### Scenario: Public-bucket prompt is kept

- **GIVEN** a quick app references `prompts/public/shared` via a `dial-prompt` skill
- **WHEN** a share link is created for `applications/owner-bucket/my-app__1.0`
- **THEN** `prompts/public/shared` is included in `shareResource.resources`

#### Scenario: Application pre-read failure degrades to app-only sharing without blocking

- **WHEN** DIAL Core rejects or fails the application read performed before sharing
- **THEN** the failure is logged as a warning and the share proceeds with the application resource alone (no related prompts), and `shareResource` is still called
