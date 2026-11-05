## ADDED Requirements

### Requirement: client-config exposes additionalContentLocales

`GET /api/v1/client-config` SHALL include one more `visibility='client'` field under `config`: `additionalContentLocales: string[]`. It is sourced from the `content.additionalLocales` registry entry (`ADDITIONAL_CONTENT_LOCALES`, falling back to the deprecated `AVAILABLE_LOCALES`), with default `[]`. The field is added to the response `client-config-endpoint` already returns. The endpoint's path, query parameters, authorization (none required) and cache key/TTL are unchanged, so the field is cached and invalidated together with the rest of the response.

`CLIENT_CONFIG_MAPPINGS` (`apps/chat-api/src/app-config/client-config.mapper.ts`) SHALL map `content.additionalLocales` to `additionalContentLocales`. An array value passes through, and anything else becomes `[]`. The empty default SHALL be added to the mapper's default config object. `ClientConfigResponseDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL add an `@ApiProperty({ type: [String] })` field `additionalContentLocales!: string[]`, so the generated `@epam/ai-dial-chat-api-client` types it concretely.

**Generated client impact:** `operationId` `getClientConfig` is unchanged, and its response type's `config` property gains `additionalContentLocales: string[]`. The request DTO is unchanged. Frontend callers keep using the normal (non-`Raw`) generated method.

**RTL impact:** none. **i18n impact:** none; values are locale codes.

Example response (abridged):

```json
GET /api/v1/client-config?appId=chat-ui
200 OK
{
  "config": {
    "publicationFilterSources": ["title", "role", "dial_roles"],
    "additionalContentLocales": ["de", "fr-FR"]
  }
}
```

#### Scenario: Empty list returned when unconfigured

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called and neither `ADDITIONAL_CONTENT_LOCALES` nor `AVAILABLE_LOCALES` is set
- **THEN** the response includes `config.additionalContentLocales: []`

#### Scenario: Operator-configured locales are returned canonicalised

- **WHEN** `ADDITIONAL_CONTENT_LOCALES=de,fr-fr` is set
- **THEN** the response includes `config.additionalContentLocales: ["de", "fr-FR"]`

#### Scenario: Registry-coverage test accepts the new key

- **WHEN** the client-config mapper coverage test (`apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts`) runs
- **THEN** `content.additionalLocales` has exactly one mapping entry, and `additionalContentLocales` is written by no other entry

#### Scenario: Generated client type includes the new field

- **WHEN** `npm run openapi` is run
- **THEN** the generated `ClientConfigDto` type includes `additionalContentLocales: string[]`, and `npm run openapi:check` passes
