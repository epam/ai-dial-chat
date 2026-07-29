## Why

The application currently has no saved-prompts library — "prompt" is only a free-text field stored inside individual conversations. Users have no way to author, organise, share, or reuse prompt templates across conversations. A dedicated Prompts backend API closes this gap by giving the frontend (and future integrations) a well-defined REST interface for a personal + organisation-wide prompt library backed by DIAL Core file storage.

## What Changes

- New NestJS domain `apps/chat-api/src/prompts/` with controller, service, module, and DTOs.
- REST endpoints under `/api/v1/prompts` and `/api/v1/prompts/public` for full CRUD and listing.
- Prompts are persisted as JSON files in DIAL Core file storage (user bucket for personal, `public` bucket for organisation prompts), following the same pattern as conversations.
- Folder hierarchy is represented as virtual path prefixes (same convention used by conversations and files), with dedicated list and move endpoints.
- Sharing a prompt reuses the existing DIAL Core share mechanism (the same `share` service already used for conversations/files).
- OpenAPI schema updated; `@epam/chat-api-client` regenerated.

## Capabilities

### New Capabilities

- `prompts-api`: Core CRUD REST API for prompt entities — list, get, create, update, delete for both personal and organisation prompts. Includes the prompt data model (id, name, description, content with optional `{{variable}}` placeholders, folderId, timestamps).
- `prompts-folders`: Virtual folder support for prompts — create, rename, delete, and move prompts between folders using DIAL Core path prefixes.
- `prompts-share-api`: Share and unshare individual prompts or folders with specific users/roles via the DIAL Core sharing mechanism.

### Modified Capabilities

*(none — no existing spec-level requirements change)*

## Impact

- **New code**: `apps/chat-api/src/prompts/` domain with controller, service, module, DTOs, validation constants, and tests.
- **Backend routes**: list/create at `/api/v1/prompts`; single-item read at `/api/v1/prompts/item?path=...`; update/delete at `/api/v1/prompts?path=...`; public list/read at `/api/v1/prompts/public` and `/api/v1/prompts/public/item?path=...`; folder operations at `/api/v1/prompts/folders`; move at `/api/v1/prompts/move`; sharing through the existing `/api/v1/share`.
- **DIAL Core dependency**: all reads/writes go through `@epam/ai-dial-typescript-sdk` or raw DIAL file-storage calls — no new external dependencies.
- **Generated client**: `npm run openapi` + `npm run openapi:check` must pass after implementation; `libs/chat-api-client` re-generated with new prompt endpoints.
- **No UI** in this change — frontend integration is a follow-on change.
