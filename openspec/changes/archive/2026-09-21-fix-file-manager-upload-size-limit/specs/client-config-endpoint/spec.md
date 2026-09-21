## ADDED Requirements

### Requirement: client-config exposes maxAttachmentFileSizeBytes

`GET /api/v1/client-config` SHALL include an additional `visibility='client'` key under `config`: `maxAttachmentFileSizeBytes: number` (sourced from `EnvironmentVariables.FILE_UPLOAD_MAX_BYTES` via the `attachments.maxFileSizeBytes` registry entry, default `536870912`) — added to the same cached response `client-config-endpoint` already returns, with no change to the endpoint's existing path, query parameters, authorization (none required), or cache key/TTL.

`ClientConfigResponseDto.config` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add an `@ApiProperty` field for `maxAttachmentFileSizeBytes: number` so the generated `@epam/chat-api-client` types it concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged; its response type's `config` property gains `maxAttachmentFileSizeBytes: number`. Request DTO unchanged. Frontend callers continue to use the normal (non-`Raw`) generated method.

**RTL impact:** None. **i18n impact:** None — a raw byte count, not localized copy.

#### Scenario: Default limit returned when unconfigured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and `FILE_UPLOAD_MAX_BYTES` is unset
- **THEN** the response includes `config.maxAttachmentFileSizeBytes: 536870912`

#### Scenario: Operator-configured limit is returned

- **WHEN** `FILE_UPLOAD_MAX_BYTES=104857600` is set
- **THEN** the response includes `config.maxAttachmentFileSizeBytes: 104857600` — the same value that now also governs the `POST /api/v1/files` Multer limit, since both read the same environment variable

#### Scenario: Generated client type includes the new field

- **WHEN** `npm run openapi` is run
- **THEN** the generated `ClientConfigResponse` type's `config` property includes `maxAttachmentFileSizeBytes: number`
