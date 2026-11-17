## MODIFIED Requirements

### Requirement: Client config response exposes appVersion

`ClientConfigDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL
declare a required `appVersion!: string` property annotated with `@ApiProperty` (`type: String`,
non-nullable, with a description stating it is sourced from `CHAT_VERSION` and falls back to the
workspace root `package.json` version, and an example such as `0.45.0`). The field SHALL be
regenerated into `libs/chat-api-client` by `npm run openapi` and verified with
`npm run openapi:check`; generated files SHALL NOT be hand-edited.

Generated-client impact:

| aspect | value |
| --- | --- |
| operationId / SDK method | `getClientConfig` (unchanged — no new endpoint) |
| request DTO | none (GET, no body) |
| response DTO | `ClientConfigResponseDto` → `ClientConfigDto.appVersion: string` |
| frontend caller style | normal (non-`Raw`) generated method, via the existing
  `apps/chat/src/server-api/app-config.api.ts` wrapper |

Example response fragment for `GET /api/v1/app-config`:

```json
{
  "appId": "ai-dial-chat",
  "features": { "footer": true },
  "config": {
    "appVersion": "0.45.0",
    "footerHtmlMessage": "<p>Need help? <a href=\"https://support.example.com\" target=\"_blank\" rel=\"noopener noreferrer\">Contact support</a>.</p>",
    "asrModelId": null,
    "transcribeSizeLimitBytes": 5242880
  },
  "metadata": { "resolvedAt": "2026-08-10T09:00:00.000Z", "cacheTtlSeconds": 60 }
}
```

Error codes are unchanged from the existing endpoint (`401` when the session is missing or
invalid, `500` on an unexpected resolution failure); this change introduces no new error path.

#### Scenario: appVersion present in the response payload

- **WHEN** `GET /api/v1/app-config` succeeds
- **THEN** the response body contains `config.appVersion` as a non-empty string

#### Scenario: OpenAPI artifact stays in sync

- **WHEN** `npm run openapi:check` runs after the DTO change and regeneration
- **THEN** it reports no drift between `apps/chat-api` Swagger metadata and
  `libs/chat-api-client/openapi.json`

---
