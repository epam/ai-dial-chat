## ADDED Requirements

### Requirement: client-config exposes applicationVisualizers

`GET /api/v1/client-config` SHALL include an `applicationVisualizers` field on its
response DTO (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`),
sourced from the `applicationVisualizers` registry key.

- Type: an object map of application id → `ApplicationVisualizerDto`, declared to
  Swagger with `additionalProperties: { $ref: ApplicationVisualizerDto }` so the
  generated client types it as a record rather than `object`.
- `ApplicationVisualizerDto` is a class (not an interface), so Swagger emits runtime
  metadata, and every field carries `@ApiProperty` with a description and an example.
- Default: `{}` when `APPLICATION_VISUALIZERS` is unset — the feature is dark by
  default.
- The `@ApiProperty` description SHALL state that the field is sourced from
  `APPLICATION_VISUALIZERS`, that each entry's origin must also appear in
  `ALLOWED_IFRAME_ORIGINS`, and that `passAuthInfo` / `passExplicitToken` are accepted
  for configuration parity but are not consumed.

**Generated-client impact:** no new operation. The existing `getClientConfig`
operation's response type gains the field, so `npm run openapi` and
`npm run openapi:check` MUST be run and the regenerated `libs/chat-api-client` output
committed in the same change. Frontend callers keep using the existing non-`Raw`
generated method through `apps/chat/src/server-api`.

**Authorization:** unchanged. The endpoint's existing access rules apply; no new role
is required, and the registry is operator configuration containing no per-user data.

**Caching:** unchanged. The field participates in the endpoint's existing config
resolution and caching behaviour; no new cache key or TTL is introduced, and the value
changes only on redeploy.

Example response fragment:

```json
{
  "config": {
    "applicationVisualizers": {
      "my-app-deployment-id": {
        "title": "my-viz",
        "url": "https://viz.example.com",
        "contentType": "application/x-my-viz, application/x-my-viz-v2",
        "height": 600,
        "mobileHeight": 400
      }
    }
  }
}
```

#### Scenario: Populated registry is returned

- **WHEN** `APPLICATION_VISUALIZERS` declares one entry and the client requests `GET /api/v1/client-config`
- **THEN** the response's `config.applicationVisualizers` contains that entry under its application id

#### Scenario: Unset registry returns an empty object

- **WHEN** `APPLICATION_VISUALIZERS` is unset
- **THEN** `config.applicationVisualizers` is `{}`

#### Scenario: Parity fields survive the round trip

- **WHEN** an entry declares `passAuthInfo: true`
- **THEN** the response preserves `passAuthInfo: true` on that entry
- **AND** no `accessToken` field appears anywhere in the response
