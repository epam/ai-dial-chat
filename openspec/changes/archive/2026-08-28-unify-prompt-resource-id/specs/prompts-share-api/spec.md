## MODIFIED Requirements

### Requirement: Personal prompts are shareable via the existing share endpoint

A user SHALL be able to share a personal prompt with another user by calling the existing `POST /api/v1/share` endpoint (implemented in `apps/chat-api/src/share/share.controller.ts`) with the prompt's full DIAL Core resource path as `itemId` — the same `id` value `PromptResponseDto` already returns. No new backend endpoint is introduced for prompt sharing, and no prompt-specific qualification step runs: the share service already accepts arbitrary DIAL Core resource paths and proxies them to DIAL Core, and a prompt's `itemId` now arrives pre-qualified with its bucket exactly like an application's, a toolset's, a conversation's, or a skill's.

The prompt's DIAL Core resource path follows the same conventions as other resources:

```
prompts/{bucket}/{path}
```

A client uses `PromptResponseDto.id` directly as `itemId`; it MUST NOT append `.json` or another `prompts/` path segment, and it needs no separate bucket to assemble the url with — `id` already carries it.

When the backend built this resource url from a bucket-relative path in the past, each `/`-delimited segment of `{path}` was percent-encoded via the shared `encodeDialResourcePath` utility (`apps/chat-api/src/common/utils/encode-dial-path.ts`) before being sent to DIAL Core. That encoding step is now applied once, when the frontend originally requests the prompt and receives its `id`, not at share time — `itemId` is passed through unmodified, matching every other resource type's share flow.

`POST /api/v1/share` body:
```
{
  "itemId": "<full DIAL Core resource path of the prompt>",
  "access": ["view"]
}
```

The invitation URL for a prompt SHALL use the catalog accept-invitation route, since prompts are surfaced in the catalog — the existing `conversations/`-prefix check already yields that outcome for a `prompts/…` url, unconditionally, with no dependency on a `resourceKind` parameter. `resolveSharedItemSummary` SHALL return an empty summary for a `prompts/` itemId instead of attempting deployment or toolset resolution: a prompt has no entry in either list, so the lookup could only fail.

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
- **THEN** no prompt-specific validation branch is executed — the existing share service proxies the request as-is, the same as for `applications/`, `toolsets/`, `conversations/`, and `skills/`

#### Scenario: Sharing a prompt nested inside a folder with a space in its name succeeds

- **WHEN** `POST /api/v1/share` is called with `{ "itemId": "prompts/{bucket}/New%20folder%201/Prompt%201", "access": ["view"] }`
- **THEN** the response is 201 with `url`, `expiresInDays`, and `access`, not a 400

#### Scenario: A prompt share invitation uses the catalog accept route

- **WHEN** `createShareLink` is called with an `itemId` starting with `prompts/`
- **THEN** the returned url points at the catalog accept-invitation route, the same as for a conversation `itemId`

#### Scenario: Accepting a prompt invitation resolves no list summary

- **WHEN** an accepted invitation's itemId starts with `prompts/`
- **THEN** the response carries neither `sharedDeployment` nor `sharedToolset`, and no deployment or toolset resolution is attempted

---

### Requirement: Swagger description for POST /api/v1/share is updated

The `@ApiOperation.description` on `POST /api/v1/share` (`apps/chat-api/src/share/share.controller.ts`) SHALL state it creates a share link "for a DIAL Core resource (catalog entity, conversation, or prompt)". No DTO, status code, or rate-limit change is required. The description SHALL NOT reference a `resourceKind` parameter, since that parameter no longer exists.

#### Scenario: Updated Swagger description reflects prompt support

- **WHEN** the OpenAPI spec is generated
- **THEN** the `POST /api/v1/share` description mentions prompts alongside conversations and catalog entities, and `CreateShareLinkDto`'s schema has no `resourceKind` field
