## ADDED Requirements

### Requirement: SDK-shaped error paths propagate the real upstream HTTP status
Every `chat-api` service method that calls `handleDialSdkError` after receiving an SDK-shaped `{ data, error, response }` result SHALL pass a status value derived from `response.status`, not from the parsed error body alone, so `mapDialHttpStatus` throws the exception matching DIAL Core's actual response.

#### Scenario: deleteConversation surfaces 404 for an already-deleted conversation
- **WHEN** `ConversationService.deleteConversation` calls the DIAL SDK and DIAL Core responds with HTTP 404 and an error body with no `status` field
- **THEN** the method throws `NotFoundException`, not `BadGatewayException`

#### Scenario: getStoredConversation-derived reads surface the real status
- **WHEN** `getConversation`, `duplicateConversation`, or `renameConversation` triggers `getStoredConversation` and DIAL Core responds with a non-2xx status
- **THEN** the caller receives the NestJS exception matching that real status code (e.g. 404 → `NotFoundException`), not a generic `BadGatewayException` from an un-shaped thrown error

#### Scenario: getUserBucket surfaces the real status
- **WHEN** `BucketService.getUserBucket` calls the DIAL SDK and DIAL Core responds with a non-2xx status
- **THEN** `handleDialSdkError` receives that real status and throws the matching exception

#### Scenario: already-correct call sites are unaffected
- **WHEN** any SDK-path service that already passes `{ status: response.status }` (`files.service.ts`, `chat.service.ts`, `rate.service.ts`, `transcription.service.ts`, `user-config.service.ts`) handles an error
- **THEN** its behavior is unchanged by this capability
