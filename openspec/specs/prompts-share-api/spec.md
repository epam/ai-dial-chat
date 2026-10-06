# prompts-share-api Specification

## Purpose

Sharing personal prompts through the existing share endpoint.

## Requirements

### Requirement: Personal prompts are shareable via the existing share endpoint

A user SHALL be able to share a personal prompt with another user by calling the existing `POST /api/v1/share` endpoint (implemented in `apps/chat-api/src/share/share.controller.ts`) with the prompt's full DIAL Core resource path as `itemId` — the same `id` value `PromptResponseDto` already returns. No new backend endpoint is introduced for prompt sharing, and no prompt-specific bucket-qualification step runs: the share service already accepts arbitrary DIAL Core resource paths and proxies them to DIAL Core, and a prompt's `itemId` arrives pre-qualified with its bucket exactly like an application's, a toolset's, a conversation's, or a skill's.

The prompt's DIAL Core resource path follows the same conventions as other resources:

```
prompts/{bucket}/{path}
```

A client uses `PromptResponseDto.id` directly as `itemId`; it MUST NOT append `.json` or another `prompts/` path segment, and it needs no separate bucket to assemble the url with — `id` already carries it.

`PromptResponseDto.id` is the raw, unencoded resource path (`buildPromptId`; folder and prompt names with spaces stay literal). Prompts are therefore the one resource kind the share flow re-encodes at share time: `toShareResourceUrl` (`apps/chat-api/src/share/utils/share-resource.util.ts`) percent-encodes each `/`-delimited segment of a `prompts/…` `itemId` via the shared, idempotent `encodeDialResourcePath` utility (`apps/chat-api/src/common/utils/encode-dial-path.ts`) before it is sent to DIAL Core, and passes every other kind through unchanged. The share-management calls (discard, revoke, recipients count) apply the same normalization, and on accept `toPublicItemId` decodes a prompt itemId read back from the invitation so the returned `itemId` matches the catalog's raw id.

`POST /api/v1/share` body:
```
{
  "itemId": "<full DIAL Core resource path of the prompt>",
  "access": ["view"]
}
```

The invitation URL for a prompt SHALL use the catalog accept-invitation route, since prompts are surfaced in the catalog — the existing `conversations/`-prefix check already yields that outcome for a `prompts/…` url, unconditionally, with no dependency on a `resourceKind` parameter. `resolveSharedItemSummary` SHALL return an empty summary for a `prompts/` itemId instead of attempting deployment or toolset resolution: a prompt has no entry in either list, so the lookup could only fail.

On success, `POST /api/v1/share` returns HTTP 201 with the existing
`ShareLinkResponseDto` contract. `expiresInDays` is optional: it is read from
the DIAL Core invitation's `expireAt` and is omitted when the expiry cannot be
determined (see `share-link-expiry`):

```
{
  "url": "<absolute frontend invitation URL>",
  "expiresInDays": <days until the DIAL Core invitation's expireAt, when known>,
  "access": ["view"]
}
```

#### Scenario: Sharing a prompt produces an invitation link

- **WHEN** `POST /api/v1/share` is called with `{ "itemId": "prompts/{bucket}/Work/greeting", "access": ["view"] }`
- **THEN** the response is 201 with `url` and `access`, plus `expiresInDays` when DIAL Core reports the invitation's expiry
- **AND** DIAL Core records the share for that resource path

#### Scenario: Share endpoint accepts prompt paths without additional validation

- **WHEN** the `itemId` resolves to a path under `prompts/`
- **THEN** no prompt-specific validation branch is executed — `itemId` is validated by the same `CreateShareLinkDto` rules as for `applications/`, `toolsets/`, `conversations/`, and `skills/`
- **AND** the only prompt-specific step is `toShareResourceUrl` percent-encoding the path segments before the DIAL Core `shareResource` call

#### Scenario: Sharing a prompt nested inside a folder with a space in its name succeeds

- **WHEN** `POST /api/v1/share` is called with `{ "itemId": "prompts/{bucket}/New%20folder%201/Prompt%201", "access": ["view"] }`
- **THEN** the response is 201 with `url` and `access` (and `expiresInDays` when known), not a 400

#### Scenario: A prompt share invitation uses the catalog accept route

- **WHEN** `createShareLink` is called with an `itemId` starting with `prompts/`
- **THEN** the returned url points at the catalog accept-invitation route, the same as for a conversation `itemId`

#### Scenario: Accepting a prompt invitation resolves no list summary

- **WHEN** an accepted invitation's itemId starts with `prompts/`
- **THEN** the response carries neither `sharedDeployment` nor `sharedToolset`, and no deployment or toolset resolution is attempted
- **AND** the returned `itemId` is the decoded prompt path produced by `toPublicItemId`

---

### Requirement: Shared prompts appear in the personal prompt list

The `GET /api/v1/prompts` endpoint's `sharedWithMe` field (defined in `prompts-api`) SHALL be populated by querying DIAL Core's shared-resources listing for resources under the `prompts/` path namespace. The service calls DIAL Core's shared-resources API (the same `getSharedResources` call `ConversationListingService` uses to populate shared conversations) with `resourceTypes: ['PROMPT']` and `with: 'me'`, skipping `FOLDER` nodes and hidden folder markers, maps results to `PromptResponseDto`, and returns them in `sharedWithMe`.

If DIAL Core returns no shared resources or the call fails non-fatally, `sharedWithMe` SHALL default to an empty array (graceful degradation — the personal and org prompts are still returned).

#### Scenario: Shared prompts are included in the list

- **WHEN** another user has shared a prompt with the current user via DIAL Core
- **AND** `GET /api/v1/prompts` is called
- **THEN** that prompt appears in `sharedWithMe` with a valid `PromptResponseDto`

#### Scenario: No shared prompts returns empty sharedWithMe

- **WHEN** no prompts have been shared with the current user
- **THEN** `GET /api/v1/prompts` returns `sharedWithMe: []`

#### Scenario: DIAL Core shared-resources call failure degrades gracefully

- **WHEN** the DIAL Core shared-resources API returns a non-2xx response
- **THEN** `GET /api/v1/prompts` still returns 200 with personal prompts; `sharedWithMe` is `[]`

---

### Requirement: Swagger description for POST /api/v1/share is updated

The `@ApiOperation.description` on `POST /api/v1/share` (`apps/chat-api/src/share/share.controller.ts`) SHALL state it creates a share link for a DIAL Core resource covering catalog entities, conversations, and prompts — today: "Creates a share link for a DIAL Core resource (catalog entity — agent, application, skill, toolset, or model — conversation, or prompt) …". No DTO, status code, or rate-limit change is required. The description SHALL NOT reference a `resourceKind` parameter, since that parameter no longer exists.

#### Scenario: Updated Swagger description reflects prompt support

- **WHEN** the OpenAPI spec is generated
- **THEN** the `POST /api/v1/share` description mentions prompts alongside conversations and catalog entities, and `CreateShareLinkDto`'s schema has no `resourceKind` field

---

RTL / direction impact: none (backend only).
Feature flag gating: none.
Cache: none — share links are ephemeral and not cached.
Observability: log `WARN` if the DIAL Core shared-resources call for prompts fails, include the HTTP status returned.
