# catalog-delete-routing Specification

## Purpose
Defines how `CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) routes the details panel's owner-side delete action to the correct backend mutation and refetch based on the catalog item's type, so that deleting a skill hits the skills API rather than being misrouted to the applications/deployments delete path.

## Requirements
### Requirement: CatalogView routes owner-side delete by item type

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL
implement the details panel's `onDelete` callback (see
`catalog-details-confirmation-subview` for the confirmation mechanics that
precede this call) by dispatching on `item.type`:

- `CatalogEntityType.Prompt`: call `deletePrompt(item.id)`, then
  `refetchPrompts()`.
- `CatalogEntityType.Toolset`: call `deleteToolset(item.id)`, then
  `refetchToolsets()`.
- `CatalogEntityType.Skill`: parse `item.id` (the `skills/{bucket}/{path}`
  resource URL) with `parseSkillResourceUrl` and call
  `deleteSkill(bucket, path)` (`apps/chat/src/server-api/skills.api.ts`),
  then `refetchSkills()` from `useSkills()`. `deleteSkill` accepts optional `ifMatch` and `signal` arguments but is
  called here with neither, so the delete carries no ETag precondition and is
  not abortable — matching this action's behaviour for every other entity
  type.
- Any other type (application/deployment): call `deleteApplication(item.id)`,
  then `refetchDeployments()` — unchanged from current behavior.

A `Skill` item SHALL NOT be routed to `deleteApplication`. This mirrors the
routing `catalog-unshare` already documents for `onUnshare` (Toolset →
`refetchToolsets`, Skill → `refetchSkills`, otherwise →
`refetchDeployments`), keeping the two owner-facing mutation paths
(Delete, Unshare) structurally consistent.

On success, a success notification is shown via
`notifyOperationSuccess`/`EntityOperation.Deleted` (see
`entity-operation-notifications`). The notifiable entity is not fixed per
branch: it is resolved by `resolveCatalogItemEntity(item.type, deployment)`,
looking the deployment up by id or reference, so the notification names the
kind of thing the user actually deleted rather than a generic noun.

On rejection — including a malformed skill `item.id`, where a `null` parse
from `parseSkillResourceUrl` causes `handleDelete` to throw an `Error`
naming the offending id before any request is made — the error-notification
path in `handleDelete`'s `catch` block runs (trace id surfaced), and the
error is re-thrown so the confirmation sub-view stays open per
`catalog-details-confirmation-subview`.

The per-type refetch runs **inside** the same `try` as the mutation, so a
refetch that fails after a successful delete is reported as a delete failure
and leaves the confirmation open. This is deliberately narrower than
`handleUnshare`, which performs its refetch in a separate `try` and swallows
a refetch failure — there, the discard has already succeeded irreversibly and
must not be presented as retryable. Delete has no equivalent carve-out today;
if one is wanted, it belongs in this requirement rather than being assumed.

#### Scenario: Deleting a skill calls the skills endpoint

- **GIVEN** a catalog item with `type: CatalogEntityType.Skill` and
  `id: 'skills/{bucket}/{path}'`
- **WHEN** the delete confirmation is confirmed for that item
- **THEN** `deleteSkill` is called once with the parsed `bucket` and `path`,
  `deleteApplication` is not called, `refetchSkills` is called, and
  `refetchDeployments` is not called

#### Scenario: Deleting a non-skill item is unaffected

- **GIVEN** a catalog item with `type` other than `Prompt`, `Toolset`, or
  `Skill`
- **WHEN** the delete confirmation is confirmed for that item
- **THEN** `deleteApplication` is called once with the item id and
  `refetchDeployments` is called, exactly as before this change

#### Scenario: A malformed skill resource id fails without calling deleteApplication

- **GIVEN** a catalog item with `type: CatalogEntityType.Skill` and an
  `id` that `parseSkillResourceUrl` cannot parse
- **WHEN** the delete confirmation is confirmed for that item
- **THEN** `deleteSkill` and `deleteApplication` are both not called, an
  error notification is shown, and the confirmation sub-view remains open

#### Scenario: The success notification names the deleted item's kind

- **WHEN** a delete succeeds for any item type
- **THEN** `notifyOperationSuccess` is called with the entity that
  `resolveCatalogItemEntity` derives from the item's type and its matching
  deployment, together with `EntityOperation.Deleted` and the item's name

#### Scenario: A refetch failure after a successful delete still reports an error

- **WHEN** the delete request succeeds but the following refetch rejects
- **THEN** the delete error notification is shown and the confirmation
  sub-view stays open, because the refetch shares the mutation's `try` block
