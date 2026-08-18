## MODIFIED Requirements

### Requirement: Personal prompts are shareable via the existing share endpoint

A user SHALL be able to share a personal prompt with another user by calling the existing `POST /api/v1/share` endpoint (implemented in `apps/chat-api/src/share/share.controller.ts`) with the prompt's DIAL Core resource path as `itemId`. No new backend endpoint is introduced for prompt sharing — the share service already accepts arbitrary DIAL Core resource paths and proxies them to DIAL Core.

The prompt's DIAL Core resource path follows the same conventions as other resources:

```
prompts/{sessionBucket}/{path}
```

A client constructs this resource URL from the `PromptResponseDto.id` returned by the prompt
CRUD endpoints and the user's session bucket. It MUST NOT append `.json` or another
`prompts/` path segment.

When the backend builds this resource URL, each `/`-delimited segment of `{path}` SHALL be percent-encoded via the shared `encodeDialResourcePath` utility (`apps/chat-api/src/common/utils/encode-dial-path.ts`) before being sent to DIAL Core, so that folder and prompt names containing spaces or other characters requiring encoding do not produce an invalid resource link. This matches the encoding already applied when building resource URLs for conversations, files, and toolsets.

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

#### Scenario: Sharing a prompt nested inside a folder with a space in its name succeeds

- **WHEN** `POST /api/v1/share` is called with `{ "itemId": "New folder 1/Prompt 1", "resourceKind": "prompt", "access": ["view"] }`
- **THEN** the resource path sent to DIAL Core is `prompts/{bucket}/New%20folder%201/Prompt%201`
- **AND** the response is 201 with `url`, `expiresInDays`, and `access`, not a 400
