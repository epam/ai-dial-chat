## MODIFIED Requirements

### Requirement: Prompt delete, share, favourite, and unshare reflect real backend capability

`CatalogView` SHALL wire each action for prompts as follows:

- **Delete** — `handleDelete` gains a Prompt branch calling `deletePrompt(item.id)` then `refetchPrompts()`. Success and failure notifications reuse the existing `CatalogI18nKeys.DetailsDeleteSuccess*` / `DetailsDeleteError` keys.
- **Share** — enabled. `isShareVisible` returns `true` for a personal prompt (`item.isMyApp`) and `false` for shared or organisation prompts. `SharePopoverContainer` calls `useShareLink` with `item.id` for a Prompt item exactly as it does for every other entity type — `item.id` is already the prompt's full `prompts/{bucket}/{path}` resource path, so no resource-kind tag or backend qualification step is involved; `canEditAccess` is `true`.
- **Favourite** — enabled. `onToggleFavorite` resolves the user-config section through `resolveFavoriteEntityType(item.type)`, which maps Prompt to `FavoriteEntityType.Prompt`, Toolset to `FavoriteEntityType.Toolset`, and everything else to `FavoriteEntityType.Deployment`. Prompts appear in the Favorites strip like any other favourited item, keyed by the prompt's full resource-path `id`.
- **Download** — enabled for every prompt source. See `prompt-download` for the file format and the wiring.
- **Edit** — enabled for personal prompts and shared prompts whose listing metadata yields `canEdit: true`; always hidden for organisation prompts even if upstream metadata unexpectedly carries `WRITE`.
- **Unshare (Remove from My List)** — supported, mirroring the skill wiring. `isUnshareVisible` returns `true` for Prompt (subject to `Header`'s built-in `isMyApp`/`sharedWithMe` gate) because `DiscardSharedCatalogItemDto` (`apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts`) accepts `prompts/{bucket}/{path}` directly, the same allowlist entry `skills/{bucket}/{path}` already has.
- **Publish** — supported. `PUBLISHABLE_ENTITY_TYPES` (`apps/chat/src/utils/publish.ts`) maps Prompt to `CatalogPublishEntityType.Prompt`, so the existing `Boolean(item.isMyApp) && toPublishEntityType(item.type) != null` rule offers it on personal prompts only. Server-side, `publish.service.ts` sends a prompt's `entityId` (already the full `prompts/{bucket}/{path}` resource path) unmodified — the same as a skill's `entityId` — with no bucket-qualification helper involved; a prompt carries no version, so the publication title is trimmed. `libs/catalog`'s built-in publish default still excludes Prompt, which is inert here because `CatalogView` always supplies `isPublishVisible`.
- **Revoke access** — supported, mirroring the skill wiring. `RevokeSharedAccessDto` accepts `prompts/{bucket}/{path}` directly, the same allowlist entry `skills/{bucket}/{path}` already has. `Header`'s built-in rule (`!!onRevokeShare && item.isMyApp === true && (recipientsCount == null || recipientsCount > 0)`) now governs visibility the same way it does for every other owned entity type; `CatalogView` passes `isRevokeShareVisible` returning `true` for Prompt (subject to that built-in rule), mirroring `isUnshareVisible`.

#### Scenario: Deleting a prompt removes it from the catalog

- **WHEN** the user confirms Delete on their own prompt
- **THEN** `deletePrompt(item.id)` is called, `refetchPrompts()` runs, the item disappears from the catalog, and a success notification is shown

#### Scenario: Delete failure surfaces a trace id

- **WHEN** `deletePrompt` rejects
- **THEN** an error notification with the request id from `getApiErrorDetails` is shown and the error is re-thrown so the panel exits its pending state

#### Scenario: Own prompt can be shared

- **WHEN** the details panel opens for a personal prompt
- **THEN** the Share control is rendered and opens `SharePopoverContainer`
- **AND** the share request carries `itemId: item.id` and no resource-kind field

#### Scenario: Organisation prompt cannot be shared

- **WHEN** the details panel opens for an organisation prompt
- **THEN** no Share control is rendered

#### Scenario: Writable shared prompt exposes Edit

- **WHEN** a shared prompt carries `canEdit: true`
- **THEN** its details panel renders Edit and navigating through it preserves the prompt's full resource-path id

#### Scenario: Organisation prompt remains read-only despite metadata

- **WHEN** an organisation prompt's upstream metadata contains `WRITE`
- **THEN** its catalog item still has `isEditable: false` and no Edit action is rendered

#### Scenario: Favouriting a prompt writes to the prompts config section

- **WHEN** the user toggles the star on a prompt
- **THEN** `toggleFavorite(item.id, true, FavoriteEntityType.Prompt)` is called
- **AND** neither the deployments nor the toolsets section is written

#### Scenario: A favourited prompt appears in the Favorites strip

- **WHEN** the catalog renders with a prompt whose full resource-path id is in `favoriteIds`
- **THEN** that prompt is present in the `favorites` array passed to `Catalog`

#### Scenario: Unshare control is available on a shared prompt

- **WHEN** the details panel opens for a prompt shared with the current user
- **THEN** a "Remove from My List" action is rendered
- **AND** confirming it calls `discardSharedCatalogItem(item.id)` and, on success, `refetchPrompts()`

#### Scenario: Revoke-access control is available on a personal prompt with recipients

- **WHEN** the details panel opens for a prompt the user owns that has at least one recipient
- **THEN** a "Revoke access" action is rendered, the same as for an owned Model, Agent, or Toolset

#### Scenario: Publishing a personal prompt sends its own full resource id

- **WHEN** the user publishes their own prompt `prompts/{callerBucket}/Work/AI/summarize` to an Organization folder
- **THEN** the publish request carries `entityType: 'prompt'` and `entityId: 'prompts/{callerBucket}/Work/AI/summarize'`
- **AND** the backend's publication `sourceUrl` is that same value, unmodified
- **AND** the publication title carries no trailing space, because a prompt has no version

#### Scenario: Publish is not offered on a prompt the user does not own

- **WHEN** the details panel opens for a shared or organisation prompt
- **THEN** the Manage menu contains no Publish entry

#### Scenario: Deployment actions are unchanged

- **WHEN** the details panel opens for a Model, Agent, or Toolset item
- **THEN** its favourite, publish, share, unshare, and revoke controls render exactly as before this change
