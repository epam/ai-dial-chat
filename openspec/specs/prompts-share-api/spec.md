## ADDED Requirements

### Requirement: Personal prompts are shareable via the existing share endpoint

A user SHALL be able to share a personal prompt with another user by calling the existing `POST /api/v1/share` endpoint (implemented in `apps/chat-api/src/share/share.controller.ts`) with the prompt's DIAL Core resource path as `itemId`. No new backend endpoint is introduced for prompt sharing — the share service already accepts arbitrary DIAL Core resource paths and proxies them to DIAL Core.

The prompt's DIAL Core resource path follows the same conventions as other resources:

```
prompts/{sessionBucket}/{path}
```

A client constructs this resource URL from the `PromptResponseDto.id` returned by the prompt
CRUD endpoints and the user's session bucket. It MUST NOT append `.json` or another
`prompts/` path segment.

`POST /api/v1/share` body:
```
{
  "itemId": "<DIAL Core resource path of the prompt>",
  "access": ["view"]
}
```

On success, `POST /api/v1/share` returns HTTP 201 with the existing
`ShareLinkResponseDto` contract:

```
{
  "url": "<absolute frontend invitation URL>",
  "expiresInDays": 3,
  "access": ["view"]
}
```

#### Scenario: Sharing a prompt produces an invitation link

- **WHEN** `POST /api/v1/share` is called with `{ "itemId": "prompts/{bucket}/Work/greeting", "access": ["view"] }`
- **THEN** the response is 201 with `url`, `expiresInDays`, and `access`
- **AND** DIAL Core records the share for that resource path

#### Scenario: Share endpoint accepts prompt paths without additional validation

- **WHEN** the `itemId` resolves to a path under `prompts/`
- **THEN** no prompt-specific validation branch is executed — the existing share service proxies the request as-is

---

### Requirement: Shared prompts appear in the personal prompt list

The `GET /api/v1/prompts` endpoint's `sharedWithMe` field (defined in `prompts-api`) SHALL be populated by querying DIAL Core's shared-resources listing for resources under the `prompts/` path namespace. The service calls DIAL Core's shared-resources API (the same call used by `ConversationService` to populate shared conversations) filtered to prompt paths, maps results to `PromptResponseDto`, and returns them in `sharedWithMe`.

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

The `@ApiOperation.description` on `POST /api/v1/share` (`apps/chat-api/src/share/share.controller.ts`) SHALL be updated to state it creates a share link "for a DIAL Core resource (catalog entity, conversation, or prompt)", replacing the previous wording. No DTO, status code, or rate-limit change is required.

#### Scenario: Updated Swagger description reflects prompt support

- **WHEN** the OpenAPI spec is generated
- **THEN** the `POST /api/v1/share` description mentions prompts alongside conversations and catalog entities

---

RTL / direction impact: none (backend only).
Feature flag gating: none.
Cache: none — share links are ephemeral and not cached.
Observability: log `WARN` if the DIAL Core shared-resources call for prompts fails, include the HTTP status returned.
