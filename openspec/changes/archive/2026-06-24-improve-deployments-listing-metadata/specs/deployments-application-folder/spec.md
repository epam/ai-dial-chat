## ADDED Requirements

### Requirement: `applicationFolder` derived from application deployment `id`

The `DeploymentItemDto` SHALL include an optional `applicationFolder?: string` field representing the parent directory path of the application within the DIAL Core storage, derived from the deployment `id`.

The backend SHALL:
- Add `applicationFolder?: string` to `DeploymentItemDto` with `@ApiPropertyOptional({ description: 'Parent folder path for application-type deployments (absent for root-level or non-application items)' })`.
- Compute `applicationFolder` inside `mapToDeploymentItem` (`apps/chat-api/src/deployments/deployments.service.ts:33–84`) only when `type === 'application'`.
- Derive the value as: `id.includes('/') ? id.substring(0, id.lastIndexOf('/')) : undefined`.
- Omit the field (leave it `undefined`) when `type` is `'model'` or `'toolset'`.
- Omit the field when the application `id` contains no `/` separator (root-level application).
- Include `applicationFolder` in the cached `DeploymentItemDto[]` (it is static and derivable from `id`).

#### Scenario: Application `id` contains a single folder segment

- **WHEN** DIAL Core returns an application deployment with `id: "folder1/my-app"` and `object: "application"`
- **THEN** the mapped item has `applicationFolder: "folder1"`

#### Scenario: Application `id` contains nested folder segments

- **WHEN** DIAL Core returns an application deployment with `id: "folder1/folder2/my-app"` and `object: "application"`
- **THEN** the mapped item has `applicationFolder: "folder1/folder2"`

#### Scenario: Application `id` has no folder prefix

- **WHEN** DIAL Core returns an application deployment with `id: "my-app"` (no `/`) and `object: "application"`
- **THEN** the mapped item has `applicationFolder` as `undefined` (field absent in response)

#### Scenario: Model and toolset items never receive `applicationFolder`

- **WHEN** DIAL Core returns a deployment with `object: "model"` or with a `toolset` field
- **THEN** the mapped item has `applicationFolder` as `undefined` regardless of the `id` value
