## ADDED Requirements

### Requirement: The tab list may come from Config Studio

From schema 1.2.0, `fileManager.availableTabs` SHALL be a managed key. When it is active and `FILE_MANAGER_AVAILABLE_TABS` is not explicitly set to a list with a known id, the published list SHALL supply `config.fileManagerTabs`. The list SHALL decide which tabs are shown, not their order: the tabs and the active-tab correction SHALL follow the fixed order All, My files, Shared, Organization, whatever order is published.

#### Scenario: Published list narrows the tabs

- **WHEN** a fresh snapshot sets `["my_files", "organization"]`, the key is active, and the variable is unset
- **THEN** File Manager shows My files and Organization, and no Shared or All tab

#### Scenario: Published order is not the display order

- **WHEN** the published list is `["organization", "shared", "my_files", "all"]`
- **THEN** the tabs are All, My files, Shared, Organization, in that order

#### Scenario: All needs two source tabs

- **WHEN** the published list is `["all", "organization"]`
- **THEN** `config.fileManagerTabs` is `["organization"]` and only the Organization tab is shown, exactly as from `FILE_MANAGER_AVAILABLE_TABS=all,organization`

#### Scenario: Only All falls back to every tab

- **WHEN** the published list is `["all"]`
- **THEN** `config.fileManagerTabs` is all four ids, exactly as from `FILE_MANAGER_AVAILABLE_TABS=all`

#### Scenario: Explicit variable wins

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS=my_files` is explicit and the snapshot sets all four ids
- **THEN** `config.fileManagerTabs` is `["my_files"]`

#### Scenario: Variable with no known id does not shadow

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS=review` and the snapshot sets `["shared", "organization"]`
- **THEN** `config.fileManagerTabs` is `["shared", "organization"]`, because the variable resolves to no value

## MODIFIED Requirements

### Requirement: ClientConfigResponseDto exposes fileManagerTabs

`ClientConfigDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) SHALL expose `fileManagerTabs!: string[]`, populated during `AppConfigService.getClientConfig` by the `fileManager.availableTabs` → `fileManagerTabs` mapping in `apps/chat-api/src/app-config/client-config.mapper.ts` (`applyClientConfigValue`), which normalizes the resolved value with `normalizeFileManagerTabs` (`apps/chat-api/src/app-config/file-manager-tabs.normalizer.ts`) for every source: the known ids it lists, in the fixed order `all`, `my_files`, `shared`, `organization`; `all` dropped below two source tabs; and all four ids when the value is not an array or lists no source tab, with a warning for a non-empty list. Its Swagger `example` SHALL be `['all', 'my_files', 'shared', 'organization']`.

#### Generated-client impact

- **operationId**: unchanged (`getClientConfig`). The field's shape is unchanged; only its Swagger example changes, and `npm run openapi` regenerates the artifact.
- **Response DTO**: `ClientConfigDto.fileManagerTabs: string[]`.
- **Frontend caller**: `apps/chat/src/server-api/app-config.api.ts`'s existing `getClientConfig` is unchanged (normal, non-`Raw` method).

**Example response** (`GET /api/v1/client-config?appId=ai-dial-chat`):

```json
{
  "appId": "ai-dial-chat",
  "features": { "asrEnabled": false },
  "config": {
    "asrModelId": null,
    "transcribeSizeLimitBytes": 5242880,
    "defaultDeploymentId": null,
    "fileManagerTabs": ["all", "my_files", "shared", "organization"]
  },
  "metadata": { "resolvedAt": "2026-09-28T00:00:00.000Z", "cacheTtlSeconds": 60 }
}
```

Error codes are unchanged from the existing endpoint.

#### Scenario: Default deployment returns the four-tab default

- **WHEN** `FILE_MANAGER_AVAILABLE_TABS` is unset and `GET /api/v1/client-config?appId=ai-dial-chat` is called
- **THEN** the response's `config.fileManagerTabs` is `["all", "my_files", "shared", "organization"]`

#### Scenario: The response lists tabs in the fixed order

- **WHEN** the resolved value is `["organization", "my_files"]`
- **THEN** `config.fileManagerTabs` is `["my_files", "organization"]`

#### Scenario: A list with no source tab falls back to every tab

- **WHEN** the resolved value is `["all"]`
- **THEN** `config.fileManagerTabs` is `["all", "my_files", "shared", "organization"]` and a warning is logged, so File Manager and the attach picker keep their sections
