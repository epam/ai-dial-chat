## Why

A user can publish a catalog entity or a conversation to the shared Organization area, but there is no way to take it back. Once `createPublication` succeeds and an admin approves it, the resource stays in the public catalog forever from the owner's point of view — the only remedies today are deleting the source resource outright (which is destructive and does not remove the published copy) or asking an administrator out-of-band. DIAL Core already supports the reverse operation (`createPublication` with a `DELETE`-action resource), so the gap is entirely in `chat-api` and the UI.

## What Changes

- **New BFF endpoint** `POST /api/v1/catalog/{entityType}/{entityId}/unpublish` — submits a removal request to DIAL Core for one already-published folder of a catalog entity (application, toolset, model, skill, prompt). Its request DTO mirrors `PublishCatalogEntityDto` field for field, including the now-**optional** `version` — Prompt and Skill resources carry none, and publish stopped requiring one.
- **New BFF endpoint** `POST /api/v1/conversations/unpublish` — the conversation counterpart, mirroring the existing `POST /api/v1/conversations/publish` shape (`path` query param + body).
- Both endpoints call `createPublication` with `resources: [{ action: 'DELETE', targetUrl }]`, where `targetUrl` is the published copy's path under `public/`. **Unpublish is a request, not an immediate removal**: like publish, it lands as a `PENDING` publication that an administrator approves. Copy throughout the UI says "unpublish requested", never "unpublished".
- **Catalog details panel** gains an `Unpublish` entry in the Manage dropdown, gated on the entity having at least one publish-history entry. Selecting it opens the existing in-place confirmation sub-view (the same treatment as Delete / Revoke access) with a new `Unpublish` confirmation kind. When the entity is published to more than one folder, the confirmation body renders the published folders as a single-select list so the user picks which one to remove.
- **Conversation panel** row action menu gains the same `Unpublish` entry, gated the same way on the conversation's publish history, opening a `ConfirmationPopup` (conversations have no details panel with a sub-view).
- **Publish history becomes load-bearing**, not just informational — and it is currently switched off on *both* surfaces. `CatalogView.getPublishHistory` returns a hardcoded `[]` (the `disable-catalog-publish-history-fetch` change), and `PublishConversationPanelContainer` hardcodes an empty `history`; both cite the same DIAL Core `503` (GH #7897). Both fetches are turned back on, because history is the only source of the folder list an unpublish request needs — with the stubs in place the `Unpublish` entry could never appear anywhere. The `503` those stubs worked around was the `getPublications` list-scope defect since fixed in both publish services, not a missing endpoint.
- **`EntityOperation` gains `UnpublishRequested`** with its own success-notification copy for every entity that can be unpublished, replacing the placeholder `Unpublished` copy that `entity-operation-notifications` specified but deliberately left unimplemented.
- Out of scope, with rationale recorded in design.md: unpublishing from several folders in one request; cancelling a still-`PENDING` publish request via Core's `deletePublication`; unpublishing files and folders; any admin-side approval UI.

## Capabilities

### New Capabilities

- `catalog-unpublish-api`: BFF endpoint that submits a `DELETE`-action publication to DIAL Core for a catalog entity, its DTOs, validation, throttling, error mapping, and publish-history cache invalidation.
- `conversation-unpublish-api`: the conversation counterpart endpoint, sharing `publish-target.util.ts` with the catalog one.
- `catalog-unpublish-flow`: the `libs/catalog` details-panel surface — Manage-menu entry, visibility rule derived from publish history, the folder-selection step, and the host callbacks/labels it exposes.
- `conversation-unpublish-flow`: the conversation panel surface — lazy publish-history lookup on menu open, the menu entry, the confirmation popup, and the wiring to the new endpoint.

### Modified Capabilities

- `catalog-publish-api`: the publish-history projection must now ignore `DELETE`-action resources, so a folder with a pending removal still reads as published; its cache key is also invalidated by unpublish. The requirement's stale `{ url: entityId }` call shape and its "task 6.8 unresolved" open-issue note are also corrected — the service passes Core's own-bucket list scope and filters locally, and resolves a prompt's bucket-relative id through `toSourceUrl`.
- `catalog-publish-flow`: `CatalogView.getPublishHistory` calls `getCatalogPublishHistory` for real again, lifting the temporary exception proposed by `disable-catalog-publish-history-fetch` — which is superseded by this change and should be archived as such.
- `conversation-publish-api`: the same history-projection and cache-invalidation change on the conversation side, plus the shared `targetUrl` derivation added to the extracted-utilities requirement.
- `catalog-details-confirmation-subview`: `DetailsConfirmationKind` gains `Unpublish`; the sub-view must now support a confirmation whose body contains an interactive folder choice, not only static copy and bullets. The requirement's kind enumeration is also brought back in line with the code, which has carried a fifth kind, `DeleteApiKey`, that the spec never listed.
- `conversation-publish-flow`: **BREAKING for that requirement** — "Submit always creates a publish request and is not blocked by publication history" is replaced. History is now really fetched, which makes the container's existing `allowReplace={false}` observable: a folder the conversation is already published to shows the already-published callout and blocks re-submission. See design.md D6 for why the code's intent wins over the current requirement text.
- `entity-operation-notifications`: the "Unpublish notification is specified but not implemented" requirement is replaced by an implemented `UnpublishRequested` operation with request-semantics copy (`<Entity> unpublish requested`), for catalog entities and conversations; the copy table's `Unpublished` row and the operation matrix's `Unpublished` column change with it.

## Impact

**Backend (`apps/chat-api`)**

- `src/publish/`: `publish.controller.ts`, `publish.service.ts`, new `dto/unpublish-catalog-entity.dto.ts` and `dto/unpublish-result.dto.ts`. `PublishCatalogEntityDto`'s optional-`version` shape is mirrored, not re-tightened.
- `src/conversations/`: `conversation-publish.controller.ts`, `conversation-publish.service.ts`, new `dto/unpublish-conversation.dto.ts`.
- `src/publish/publish-target.util.ts`: the published-`targetUrl` derivation currently inlined in both publish services is extracted so publish and unpublish cannot drift.
- OpenAPI regeneration (`npm run openapi`, `npm run openapi:check`) and a `libs/chat-api-client` rebuild — new `unpublishCatalogEntity` / `unpublishConversation` operations.

**Libs**

- `libs/catalog`: `Details/Header/Header.tsx`, `Details/DetailsPanel.tsx`, `Details/ConfirmationView/`, `types/details-confirmation.ts`, `models/item-details-props.ts` (new `onUnpublish`, `isUnpublishVisible`, and `unpublish*` texts), README.
- `libs/publish-panel`: no new components; `PublishHistoryEntry` is reused as the folder source for the selection step.

**Frontend (`apps/chat`)**

- `components/CatalogView/CatalogView.tsx`, `components/ConversationPanel/ConversationPanelView.tsx`, `components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`.
- Both publish-history stubs are removed: `CatalogView.getPublishHistory` calls `getCatalogPublishHistory` + `mapPublishHistoryEntryDto` again, and `PublishConversationPanelContainer` takes real history as a prop. `openspec/changes/disable-catalog-publish-history-fetch/` is superseded and should be archived rather than applied.
- `server-api/publish.api.ts`, `server-api/conversation-publish.api.ts`.
- `types/entity-notification.ts`, `utils/entity-notification.ts`, `constants/translation-keys.ts`, `i18n/locales/en.json`.

**Risk**

- The visibility rule depends on publish history, which is a cached, bucket-wide `getPublications` scan filtered client-side. A history call that fails leaves Unpublish hidden — a deliberate choice, since the request cannot be constructed without a folder, but it means a Core outage silently removes the action rather than surfacing an error.
- Both surfaces depend on a fetch that has been stubbed out for a month behind GH #7897. If the `503` turns out not to have been the list-scope defect, `Unpublish` degrades to permanently hidden on the affected surface and the publish panel regains a visible history error state it has not shown since the stub landed — the second is a user-visible regression that the stub was hiding. Verify both endpoints against a live Core before this is called done (task 10.3).
- `targetUrl` for a published copy is reconstructed, not read back from Core's `Publication.resources[].targetUrl`. Design.md D3 records why, and the reconstruction is unit-tested against the exact strings the publish path sends.
