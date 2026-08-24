## MODIFIED Requirements

### Requirement: POST /api/v1/prompts/move?path= moves a prompt to a different folder

`POST /api/v1/prompts/move` SHALL accept required `path`, optional owner `bucket`, and `MovePromptDto { targetFolderId }`. With no `bucket`, it moves a prompt in the caller's session bucket. With `bucket`, it operates in that owner namespace only when DIAL Core grants `WRITE`. It preserves the existing target-path conflict check, write-new/delete-old sequence, timestamps, and `400`/`401`/`404`/`409`/`502`/`500` errors.

#### Scenario: Moving a personal prompt

- **WHEN** `POST /api/v1/prompts/move?path=greeting` is called with `{ "targetFolderId": "Work" }`
- **THEN** the caller's prompt moves to `Work/greeting`

#### Scenario: Moving a writable shared prompt preserves its owner

- **WHEN** `POST /api/v1/prompts/move?path=greeting&bucket=owner-bucket` is called with `{ "targetFolderId": "Work" }`
- **THEN** the operation targets `prompts/owner-bucket/greeting` and never the caller's bucket

#### Scenario: Move conflict returns 409

- **WHEN** the target path already exists in the resolved bucket
- **THEN** the response status is 409
