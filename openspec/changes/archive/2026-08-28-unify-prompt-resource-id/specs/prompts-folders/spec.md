## MODIFIED Requirements

### Requirement: POST /api/v1/prompts/move?id= moves a prompt to a different folder

`POST /api/v1/prompts/move` SHALL accept a single required `id` query parameter carrying the prompt's full resource path (`prompts/{bucket}/{path}`) and `MovePromptDto { targetFolderId }`. The service moves the exact resource named by `id`, relying on DIAL Core to grant or reject the write — the caller's own prompt and a writable shared prompt in another bucket are handled by the identical code path, with no branch on whose bucket `id` names. `targetFolderId` remains a bucket-relative folder path, since the moved prompt always stays within the same bucket `id` already names. It preserves the existing target-path conflict check, write-new/delete-old sequence, timestamps, and `400`/`401`/`404`/`409`/`502`/`500` errors.

#### Scenario: Moving a personal prompt

- **WHEN** `POST /api/v1/prompts/move?id=prompts%2Fmy-bucket%2Fgreeting` is called with `{ "targetFolderId": "Work" }`
- **THEN** the caller's prompt moves to `prompts/my-bucket/Work/greeting`

#### Scenario: Moving a writable shared prompt preserves its owner

- **WHEN** `POST /api/v1/prompts/move?id=prompts%2Fowner-bucket%2Fgreeting` is called with `{ "targetFolderId": "Work" }` by a requestor with `WRITE`
- **THEN** the operation targets `prompts/owner-bucket/Work/greeting` and never the caller's own bucket

#### Scenario: Move conflict returns 409

- **WHEN** the target path already exists in the resolved bucket
- **THEN** the response status is 409

#### Scenario: Malformed id is rejected before any DIAL Core call

- **WHEN** `id` does not match the `prompts/{bucket}/{path}` allowlist
- **THEN** the response status is 400
