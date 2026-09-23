## ADDED Requirements

### Requirement: Deployment details expose an application's theme URL

The deployment details response SHALL carry an application's theme URL.

`ModelCatalogPropertiesDto` (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts:84-105`)
SHALL gain an optional `themeUrl?: string`, documented with `@ApiPropertyOptional` and the example
`https://themes.contoso.example.com`.

`mapCatalogProperties` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts:152-168`)
SHALL add `themeUrl: getString(raw, 'themeUrl')` to its allow-listed projection of DIAL Core's
`catalog_properties`. Its existing contract is unchanged: non-string values are ignored, unknown
keys are not exposed, and the whole object stays `undefined` when no allow-listed key has a value.

Because the mapper is shared by the model, application, and toolset branches of
`deployments-details.service.ts` (`:294`, `:390`, `:459`), the field is projected for all three
whenever DIAL Core happens to carry it. Only the application branch is written by this change's
editor; a model or toolset that carries the key is passed through rather than stripped.

**Generated-client impact**: `ModelCatalogPropertiesDto` gains `themeUrl?: string`. The
`getDeploymentDetails` operation is otherwise unchanged; `apps/chat/src/server-api/deployments.ts:12`
keeps using the normal generated method.

**Cache**: no new cache entry. The existing `deployments:details:<userSub>:<deployment>` entry
carries the new field at its existing TTL and is invalidated by the existing `updateApplication`
invalidation.

**i18n / RTL**: none — this is a response field.

#### Scenario: An application's theme URL is projected

- **WHEN** DIAL Core reports `catalog_properties: { "provider": "Contoso", "themeUrl": "https://themes.contoso.example.com" }`
  for an application
- **THEN** the response carries
  `applicationDetails.catalogProperties = { provider: "Contoso", themeUrl: "https://themes.contoso.example.com" }`

#### Scenario: The field is absent when not stored

- **WHEN** DIAL Core reports `catalog_properties: { "provider": "Contoso" }`
- **THEN** `catalogProperties.themeUrl` is absent and `catalogProperties.provider` is `"Contoso"`

#### Scenario: A non-string value is ignored

- **WHEN** DIAL Core reports `catalog_properties: { "themeUrl": 42 }` and no other allow-listed key
- **THEN** `catalogProperties` is `undefined` in the response, matching the mapper's existing
  "omit when no recognized string value is present" behaviour

#### Scenario: Unknown sibling keys are still not exposed

- **WHEN** DIAL Core reports `catalog_properties: { "themeUrl": "https://a.example.com", "schemaSpecificExtra": "x" }`
- **THEN** the response carries only `themeUrl`
