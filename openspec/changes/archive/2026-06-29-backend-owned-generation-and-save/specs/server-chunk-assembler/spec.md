## ADDED Requirements

### Requirement: Server-side SSE chunk assembler

`applyChunkToMessage` (`apps/chat-api/src/conversations/utils/apply-chunk.server.ts`) SHALL merge a parsed DIAL SSE chunk into a `ConversationMessageDto`, mirroring the frontend `apply-chunk.ts`. It MUST be a pure function with no imports from `apps/chat`.

It SHALL handle: `delta.content` (string concatenation), `delta.custom_content.attachments` (accumulate), `delta.custom_content.stages` (merge by index, concatenate `name` and `content`), `delta.custom_content.annotations` (merge by index, concatenate title and body), `delta.custom_content.form_schema` (replace, last wins), and `chunk.id` / `delta.responseId` (set the message response id).

#### Scenario: Text deltas concatenate

- **WHEN** successive chunks carry `delta.content` fragments
- **THEN** the assembled message content is their in-order concatenation

#### Scenario: Stages merge by index

- **WHEN** chunks carry `delta.custom_content.stages` entries sharing an index
- **THEN** their `name` and `content` are concatenated within that stage

#### Scenario: form_schema replaced last-wins

- **WHEN** multiple chunks carry `delta.custom_content.form_schema`
- **THEN** the assembled message keeps the last one
