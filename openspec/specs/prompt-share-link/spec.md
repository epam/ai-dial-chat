# prompt-share-link Specification

## Purpose

Prompt share links: how `POST /api/v1/share` qualifies a bucket-relative prompt path and how the frontend tags prompt share requests with the resource kind.

## Requirements

### Requirement: The frontend shares a prompt like any other catalog item

`getShareLink` and `useShareLink` SHALL accept only the item's full resource id — the same `itemId` shape used for every other resource type. Neither accepts nor forwards a `resourceKind` parameter; that parameter, and the `ShareResourceKind`/`CreateShareLinkDtoResourceKindEnum` types it depended on, no longer exist (see `chat-hooks-sharing`).

`SharePopoverContainer` SHALL call `useShareLink` with `item.id` for every entity type, Prompt included, with no per-type branch to attach a resource kind.

`CatalogView.isShareVisible` SHALL return `true` for a Prompt item only when `item.isMyApp` is true.

A prompt SHALL offer edit access, the same as Agent/Skill/Toolset — `CatalogEntityType.Prompt` is a member of `EDITABLE_ACCESS_TYPES`. `ShareService.createShareLink` maps `ShareAccess.Edit` to DIAL Core's `['READ', 'WRITE']` permissions for any resource type, prompts included, so there is no backend restriction backing a view-only default.

#### Scenario: A prompt share request carries no resource kind

- **WHEN** the share popover opens for a prompt item
- **THEN** `useShareLink` is called with the prompt's full `id` and no `resourceKind` argument

#### Scenario: A deployment share request is handled identically

- **WHEN** the share popover opens for an agent item
- **THEN** `useShareLink` is called with the item's `id`, exactly as it is for a prompt item — neither call site passes a resource kind

#### Scenario: A prompt can be shared with edit access

- **WHEN** the share popover opens for a prompt item
- **THEN** `canEditAccess` is `true`, so the access control renders as the "Can view" / "Can edit" dropdown
- **AND** choosing "Can edit" requests a link whose access includes `Edit`, which `createShareLink` maps to DIAL Core permissions `['READ', 'WRITE']` on the prompt's own `prompts/{bucket}/{path}` id
