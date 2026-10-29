## ADDED Requirements

### Requirement: Project resources are accepted by the share resource-path allowlist and resource-kind map

`CATALOG_RESOURCE_PATH_PATTERN` in `apps/chat-api/src/share/dto/catalog-resource-path.validator.ts` SHALL accept `projects/{bucket}/{path}` in addition to the prefixes this capability already lists. The regex alternation becomes `applications|toolsets|conversations|skills|prompts|projects`, and the validator's default message names `projects`.

- **Shared validator.** The validator is shared, so `RevokeSharedAccessDto`, `GetShareRecipientsDto` and `DiscardSharedCatalogItemDto` all accept project ids with no further change.
- **Resource-kind map.** `RESOURCE_KIND_BY_PREFIX` in `apps/chat-api/src/share/utils/share-resource.util.ts` SHALL gain `['projects/', 'PROJECT']`, so `resolveResourceKind` resolves project ids for `getRecipientsCount` and `discardShared`.
- **No special encoding.** `toShareResourceUrl` and `toPublicItemId` keep their prompt-only special case, so project ids pass through unchanged.

Creating a share link already validates any DIAL id (`CreateShareLinkDto`, `IsDialResourceId`), so it needs no change. The project page always requests view-only links (`canEditAccess={false}` in `SharePopoverContainer`).

`SharePopoverContainer` (`apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx`) SHALL take `itemId: string` and `canEditAccess: boolean` instead of a `CatalogItem`:

- `EDITABLE_ACCESS_TYPES` moves to `canEditShareAccess(type: CatalogEntityType): boolean` in `apps/chat/src/utils/share.ts`;
- `CatalogView` passes `itemId={item.id}` and `canEditAccess={canEditShareAccess(item.type)}`, so catalog behavior is unchanged.

**Feature flag:** the project page that opens the popover is gated by `projectsEnabled`. The share endpoints are not.

#### Scenario: Revoke access for a project

- **WHEN** `POST /api/v1/share/revoke` is called with `{ "itemId": "projects/a1b2c3/q4-launch" }`
- **THEN** the DTO validates, and the BFF calls DIAL Core's revoke for that resource

#### Scenario: Recipient count resolves the project kind

- **WHEN** `GET /api/v1/share/recipients?itemId=projects%2Fa1b2c3%2Fq4-launch` is called
- **THEN** `getSharedResources` is called with `resourceTypes: ['PROJECT']`

#### Scenario: Catalog share access is unchanged

- **WHEN** the catalog opens the share popover for a Skill
- **THEN** `canEditAccess` is `true`, and for a Model it is `false`, as before
