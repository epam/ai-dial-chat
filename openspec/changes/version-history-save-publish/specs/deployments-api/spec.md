# Spec Delta

## ADDED Requirements

### Requirement: DeploymentItemDto exposes versionGroupId

`DeploymentItemDto` SHALL gain an optional `versionGroupId?: string`. For an application item (toolsets are served by `toolset-listing`, see below) whose `id` carries a `__<version>` suffix, it SHALL be the item's folder plus its base name without that suffix, so every version of one resource saved in one folder shares the same value. The base name is split at the last `RESOURCE_VERSION_SEPARATOR` (`__`, from `apps/chat-api/src/common/utils/next-free-path.ts`), so a name that itself contains `__` keeps it. The field SHALL be absent for models and for ids without a version suffix. It SHALL be computed by the BFF when the item is mapped; clients SHALL NOT parse `__` themselves.

The listing's shape, its one-item-per-version rule and every existing field SHALL be unchanged; existing consumers ignore the new field. The OpenAPI schema SHALL document the field and `libs/chat-api-client` SHALL be regenerated.

#### Scenario: Versions of one resource share the group
- **WHEN** the listing holds `applications/abc/Design/Review__1.0.0` and `applications/abc/Design/Review__1.1.0`
- **THEN** both items carry the same `versionGroupId`

#### Scenario: Same name in another folder is another group
- **WHEN** the listing also holds `applications/abc/Research/Review__1.0.0`
- **THEN** its `versionGroupId` differs from the `Design` items'

#### Scenario: Name containing the separator
- **WHEN** an item id is `applications/abc/Design/a__b__2.0`
- **THEN** its `versionGroupId` is built from `a__b`

#### Scenario: Group is stable when the display name changes
- **WHEN** an update changes only `displayName` and `displayVersion`, so the path keeps the version the resource was created with
- **THEN** the item's `versionGroupId` is unchanged

#### Scenario: Models carry no group
- **WHEN** the listing item is a model
- **THEN** `versionGroupId` is absent
