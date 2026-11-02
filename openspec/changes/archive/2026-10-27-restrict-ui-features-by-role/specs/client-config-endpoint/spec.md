## ADDED Requirements

### Requirement: client-config exposes resolved catalog creation permissions

`GET /api/v1/client-config?appId=chat-ui` SHALL include required `config.catalogCreationPermissions` with required `allowedTypes` (an array of the five creation-type enum values) and `restrictedSchemaIds` (a string array). Evaluation follows `catalog-creation-role-restrictions`. Both arrays SHALL always be present, including when empty. The role maps and user roles SHALL never be serialized.

Request: existing required `GetClientConfigDto.appId`, allowlisted to `chat-ui`, no body or new headers. Authorization SHALL stay `@Public()` plus `OptionalSessionGuard`; no role is required to read config, and anonymous callers receive evaluation with no roles. Response SHALL remain 200 for a valid request, 400 for missing/invalid appId. This change adds no auth, schema-lookup, upstream dependency, or new 401/403/404/502/503 outcome; existing unexpected failures retain the sanitized framework 500 response. A policy is validated at boot, not silently discarded during a request.

Example policy: `{"types":{"custom-app":["developers"]},"schemas":{"schema-A":["team-A"]}}`. Response to a user holding neither role (unrelated fields abbreviated):

```http
GET /api/v1/client-config?appId=chat-ui
```

```json
{
  "appId": "chat-ui",
  "features": { "asrEnabled": false },
  "config": {
    "enabledUiFeatures": null,
    "catalogCreationPermissions": {
      "allowedTypes": ["schema-app", "toolset", "prompt", "skill"],
      "restrictedSchemaIds": ["schema-A"]
    }
  },
  "metadata": { "resolvedAt": "2026-10-27T10:00:00.000Z", "cacheTtlSeconds": 60 }
}
```

`ClientConfigDto` in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts` SHALL document the object through concrete Swagger types and a string enum for creation categories. Append the service-assembled field after the mapped config fields. Update the response key-order and mapper coverage tests.

**Generated client:** retain operationId/SDK method `getClientConfig`, existing request DTO `GetClientConfigDto` and `ClientConfigResponseDto`. Add a non-optional typed permission DTO field to `ClientConfigDto`; enum arrays MUST NOT degrade to `any` or untyped objects. Regenerate `libs/chat-api-client`; retain the normal, non-Raw method through `apps/chat/src/server-api/app-config.api.ts` and its existing singleton.

**Cache:** unchanged `app-config:client:<encodedAppId>:user:<encodedUserId>:roles:<sortedEncodedRoles>`, existing anonymous/no-role sentinels, TTL 60 seconds, expiry/restart invalidation, `Cache-Control: private, no-store`. **Observability:** existing endpoint metrics only, no raw rules/roles in logs. **RTL / i18n:** none at the endpoint.

#### Scenario: No rules returns all creation types
- **WHEN** the policy is absent
- **THEN** the object contains all five type values and `restrictedSchemaIds: []`

#### Scenario: Roles affect only the new permission field
- **WHEN** users with and without a required role request the same configured UI-feature baseline
- **THEN** their permission objects differ but `config.enabledUiFeatures` does not

#### Scenario: An explicit baseline is not filtered
- **WHEN** `ENABLED_UI_FEATURES=header,custom-apps` and custom-app creation is denied
- **THEN** `config.enabledUiFeatures` remains `["header", "custom-apps"]`

#### Scenario: The default baseline stays null
- **WHEN** `ENABLED_UI_FEATURES` is unset and creation is restricted
- **THEN** `config.enabledUiFeatures` remains null and only the new permission object carries creation restrictions

#### Scenario: No role map is disclosed
- **WHEN** any client-config response is serialized
- **THEN** it contains no policy role names or raw policy maps

#### Scenario: Generated client preserves the strong contract
- **WHEN** OpenAPI and the client are regenerated
- **THEN** the permission object and arrays are non-optional and typed, and `npm run openapi:check` passes
