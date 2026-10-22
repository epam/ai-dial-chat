# Spec Delta

## ADDED Requirements

### Requirement: Publish request includes the conversation's attachment files

`POST /api/v1/conversations/publish` SHALL add the conversation's attachment files to the `resources` array it sends to DIAL Core as defined by the `conversation-published-attachments` capability, after the conversation resource. The request and response DTOs, the validation rules, the `displayAuthor` and `rules` handling and the publish-history behavior SHALL be unchanged: publish history is still matched on the conversation's own `sourceUrl`, so the additional file resources do not appear as separate publications. A publish that fails because an attachment is missing SHALL fail with HTTP 422, `code: conversationAttachmentMissing`, a message naming the missing files and a `missingFiles` array, documented in the endpoint's OpenAPI responses; a conversation whose attachments expand beyond the configured file maximum SHALL fail with HTTP 413 (also documented). No cache entry is invalidated on either failure.

Generated-client impact: no new `operationId`; `publishConversation` keeps its request and response DTOs. The 422 response is added to the endpoint's OpenAPI responses.

#### Scenario: Request body for a conversation with one attachment file

- **GIVEN** `path` is `bucket-123/my-chat` and the conversation references `files/bucket-123/docs/report.pdf`
- **WHEN** it is published to `Organization/Data Science`
- **THEN** the `createPublication` body contains the conversation `ADD` resource and an `ADD` resource with `sourceUrl: files/bucket-123/docs/report.pdf` and `targetUrl: files/public/Organization/Data Science/my-chat/docs/report.pdf`

#### Scenario: Publish history still lists one entry per folder

- **GIVEN** a conversation with attachment files was published to `Organization/Data Science`
- **WHEN** the publish history for the conversation is requested
- **THEN** the folder appears exactly once

#### Scenario: Missing attachment aborts the publish

- **WHEN** an individually referenced attachment file does not exist
- **THEN** the endpoint answers 422 with `code: conversationAttachmentMissing` and `createPublication` is not called
