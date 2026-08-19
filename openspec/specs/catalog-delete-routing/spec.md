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
  then `refetchSkills()` from `useSkills()`. `deleteSkill` is called with no
  `ifMatch` (no precondition/concurrency check), matching this action's
  existing behavior for every other entity type.
- Any other type (application/deployment): call `deleteApplication(item.id)`,
  then `refetchDeployments()` — unchanged from current behavior.

A `Skill` item SHALL NOT be routed to `deleteApplication`. This mirrors the
routing `catalog-unshare` already documents for `onUnshare` (Toolset →
`refetchToolsets`, Skill → `refetchSkills`, otherwise →
`refetchDeployments`), keeping the two owner-facing mutation paths
(Delete, Unshare) structurally consistent.

On success, a success notification is shown via
`notifyOperationSuccess`/`EntityOperation.Deleted` (see
`entity-operation-notifications`), unchanged for all types. On rejection —
including a `null` parse from `parseSkillResourceUrl` for a malformed
skill `item.id` — the existing error-notification path in `handleDelete`'s
`catch` block runs (trace id surfaced), and the error is re-thrown so the
confirmation sub-view stays open per `catalog-details-confirmation-subview`.

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
