# Add `CatalogEntityType.Prompt` and wire the chat-api prompts APIs

## Why

`apps/chat-api` already ships a complete prompts domain — personal CRUD, organisation (public) reads, folder create/rename/delete, move, and share — specified in `openspec/specs/prompts-api/spec.md`, `openspec/specs/prompts-folders/spec.md`, and `openspec/specs/prompts-share-api/spec.md`, implemented in `apps/chat-api/src/prompts/prompt.controller.ts:37-289`, and already exposed as ten generated SDK methods in `libs/chat-api-client/src/generated/src/apis/PromptsApi.ts`.

Not one of those endpoints has a frontend caller. There is no `apps/chat/src/server-api/prompts.api.ts`, `promptsApi` is absent from the client registry in `apps/chat/src/server-api/api-client.ts:158-176`, and `CatalogEntityType` (`libs/catalog/src/types/entity-type.ts:2-7`) has no `Prompt` member. A user has no way to see, create, or reuse a prompt anywhere in the product, so a fully built and tested backend capability is dead weight.

## What Changes

- **`libs/catalog`: new `CatalogEntityType.Prompt` member**, with its entity colour (`libs/catalog/src/constants/entity-colors.ts`), tab label and canonical tab position (`libs/catalog/src/utils/catalog-tabs.ts:10-23`), and list-view Folder-column visibility. The type flows automatically into `EntityTypeLabel`, `AppIdentity`, cards, `ListView`, search (`filterCatalogItems` already matches on `item.type`), sort, and favourites with no per-type branching.
- **`libs/catalog`: a Prompt content details tab.** A new `CatalogItemPromptContent` entry on `CatalogItemTabData` plus a `CatalogDetailsTab.Content` tab renders the prompt body in a read-only, copyable block. Absent field ⇒ tab hidden, matching how `tools`, `limits`, `pricing` and `api` already gate their tabs (`libs/catalog/src/models/item-details-data.ts`).
- **`libs/catalog`: Prompt-aware built-in action defaults.** `Header.tsx:139-152` currently defaults the primary action to Model/Agent and Publish to Model/Agent/Toolset. Prompt joins the primary-action default; it stays out of the Publish default, which is inert because `CatalogView` always supplies `isPublishVisible`. Every host-owned decision still arrives through the existing `isPrimaryActionVisible` / `isPublishVisible` / `isShareVisible` predicates plus the new `isDownloadVisible` — no new host knowledge enters the lib.
- **`apps/chat`: `server-api/prompts.api.ts` covering all ten generated methods** — `listPrompts`, `getPrompt`, `createPrompt`, `updatePrompt`, `deletePrompt`, `listPublicPrompts`, `getPublicPrompt`, `createPromptFolder`, `renamePromptFolder`, `deletePromptFolder`, `movePrompt` — as thin wrappers in the shape of `apps/chat/src/server-api/toolsets.ts:11-40`, with `promptsApi` registered in `api-client.ts`.
- **`apps/chat`: `PromptsContext`** owning prompt/folder state and exposing `prompts`, `publicPrompts`, `sharedWithMe`, `folders`, `isLoading`, `error`, `refetch*`, following the `DeploymentsContext` + `ThemeContext` pattern (`useMemo`'d value, guard hook that throws outside the provider, cancelled-flag fetches).
- **`apps/chat`: prompts merged into `CatalogView`.** `mapPromptToCatalogItem` (personal ⇒ `isMyApp`, `sharedWithMe` ⇒ Shared folder, public ⇒ Public folder) joins the `catalogItems` memo at `CatalogView.tsx:185-217`, gated on a new `OverlayFeature.Prompts` key exactly as toolsets are gated today.
- **`apps/chat`: new `PromptEditor` route page** (`ROUTES.PromptEditor = '/prompt-editor'`), lazy-loaded, following `ToolsetEditor`. Handles create, edit, move-to-folder, and folder create/rename/delete — the surface that consumes the remaining endpoints. Reached from the catalog's Create dropdown and the details panel's Edit action.
- **`apps/chat`: "Use in chat" for a Prompt** navigates to the composer with the prompt body pre-filled via router state, reusing the existing `inputMessage` seam in `ConversationRoute.tsx:57-60,238,266` — no new composer prop.
- **Delete / share / revoke for prompts** reuse the details panel's existing confirmation sub-views and `SharePopoverContainer`; only the `onDelete` / `onUnshare` / `onRevokeShare` handler bodies in `CatalogView` learn about the prompt branch.
- **i18n**: ~30 new keys (`catalog.tabPrompts`, `catalog.createPrompt`, prompt-editor form labels and validation messages, prompt delete/save notifications), each declared in `apps/chat/src/constants/translation-keys.ts` and `en.json`.
- **Non-breaking.** `CatalogEntityType` is an additive enum member; `tabLabels` is already `Partial<Record<…>>`; the new details tab and content field are optional. Every backend addition is additive too — an optional share field and a new user-config section that `migrateConfig` fills for older shapes.

### Scope revision (post-review)

The change originally forbade any backend edit. Three follow-ups the first pass had documented as backend limitations were then pulled into scope, so `apps/chat-api`, `openapi.json`, and the generated client are now part of it:

- **Prompt favourites** — a new `prompts.installed` user-config section plus `PATCH /api/v1/user-config/prompts`. This also *removed* the `isFavoriteVisible` lib predicate the first pass had added to hide the star.
- **Prompt share links** — an optional `resourceKind` on `CreateShareLinkDto` so the backend can qualify a bucket-relative prompt path against the caller's bucket, which resolves the change's first open question.
- **`.dial_folder` filtering** — DIAL folder markers no longer surface as broken prompts in any listing.

Two further UI revisions came with them: a prompt's details panel shows exactly two tabs (Content, Overview) rather than About + Content, and the editor's form moved into a new `libs/prompt-editor`.

A third round added publishing a prompt to an Organization folder (backend `CatalogEntityType.Prompt` plus bucket qualification in `publish.service.ts`) and downloading a prompt as a `version: 5` JSON envelope (D15) through a new `onDownload` / `isDownloadVisible` pair on `CatalogProps`.

### Non-goals

- No prompt **unshare** — the discard DTO rejects prompt paths, and `getSharedPrompts` strips the owner bucket such a call would need.
- No prompt **import** — download writes a re-importable envelope, but nothing in this change reads one back.
- No prompt variables/templating (`{{placeholder}}` substitution), no prompt-picker inside the chat composer, and no prompt versioning. All are separate features on top of this one.
- No prompt folder tree UI inside the catalog itself; folder management lives in the editor page.

### Alternatives considered

1. **Dedicated `/prompts` page with its own list UI** — rejected. It duplicates search, sort, filter, favourites, sharing, and the details panel that `libs/catalog` already provides, and it leaves prompts invisible to the unified catalog search users already know.
2. **Read-only prompt listing first, mutations later** — rejected on the explicit scope decision to consume every prompts endpoint. It would also ship a catalog tab a user can look at but never populate, since nothing else in the product creates prompts.
3. **Inline modal editor instead of a route page** — rejected. Prompt content is a long-form field and folder management is a second dimension of state; both fit an editor page. The route also gives deep-linkable edit URLs, matching `ToolsetEditor`, `AppsEditor`, and `CustomAppEditor`.
4. **Reuse `CatalogEntityType.Skill` rather than adding a member** — rejected. `Skill` is already exported and colour-mapped for a different concept; overloading it would break the type label, tab, and any host filtering on it.

### Rollback / backward compatibility

Every addition is additive and feature-gated. Turning off `OverlayFeature.Prompts` removes the tab, the Create option, and the editor entry points, leaving the catalog byte-identical to today.

One persisted shape does change: user-config `version` 3 → 4, gaining `prompts: { installed: [] }`. No migration step is required — `migrateConfig` fills the section on read, and a v3 file read by new code or a v4 file read by old code both degrade to an empty favourites list. The API additions are an optional request field and a new endpoint, so no existing caller is affected.

### Scope creep to flag

This change touches two shared libs and one global provider:

- `libs/catalog` gains a public enum member, an optional details-tab model, and one detail component — reviewers should confirm the lib stays host-agnostic (see Impact below).
- `libs/chat-overlay` gains one `OverlayFeature` member, which is part of the published overlay protocol.
- A new app-level context provider mounts near the app root.

## Capabilities

### New Capabilities

- `catalog-prompt-entity-type`: The `CatalogEntityType.Prompt` member and everything it implies inside `libs/catalog` — entity colour, tab label/order, list-view columns, the optional prompt-content details tab, and Prompt's place in the built-in primary-action / publish / share action defaults. Host-agnostic; no endpoint or app knowledge.
- `prompts-frontend-api`: `apps/chat/src/server-api/prompts.api.ts` — thin typed wrappers over all ten generated `PromptsApi` methods, plus `promptsApi` registration in `api-client.ts`, error mapping, and the request/response DTO contract each wrapper exposes.
- `prompts-context`: `PromptsContext` / `usePrompts` — ownership of personal prompts, organisation prompts, shared-with-me prompts, and folders; loading and error states; refetch after every mutation; provider placement and the throw-outside-provider guard.
- `prompt-catalog-integration`: `mapPromptToCatalogItem`, the `OverlayFeature.Prompts` gate, prompt items merged into `CatalogView`'s item list, prompt details fetching, and the prompt branches of delete / share / revoke / use-in-chat.
- `prompt-editor`: The `@epam/ai-dial-prompt-editor` lib (form + folder picker, no validation, no API, no i18n) and the `PromptEditor` route page that supplies them — create, edit, move between folders, and folder create/rename/delete; validation mirroring the backend DTO limits; loading, empty, and error states; navigation back to the catalog.
- `prompt-favorites`: The `prompts.installed` user-config section, `PATCH /api/v1/user-config/prompts`, and the frontend wiring that folds prompt paths into the one `favoriteIds` set.
- `prompt-share-link`: `CreateShareLinkDto.resourceKind` and the server-side bucket qualification that lets a prompt's bucket-relative path become a DIAL share link.
- `prompt-listing-markers`: `.dial_folder` markers excluded from every prompt listing and from folder renames.

### Modified Capabilities

- `catalog-use-in-chat`: currently requires that the primary action is available only for chat-capable Model and Application items and explicitly absent for other types. Prompt becomes a third type with a primary action, and its action pre-fills the composer instead of only selecting a deployment.
- `catalog-create-options`: the Create dropdown gains a Prompt entry, visible only when `OverlayFeature.Prompts` is enabled, navigating to `ROUTES.PromptEditor`.
- `catalog-item-details-fetch`: `onFetchDetails` currently always resolves through the deployment-details endpoint. It gains a type-dispatched path so a Prompt item resolves its content through the prompts endpoints instead.

## Impact

**Libraries**

- `libs/catalog`: `types/entity-type.ts`, `types/detail-tab.ts`, `constants/entity-colors.ts`, `utils/catalog-tabs.ts`, `models/item-details-data.ts`, `models/item-details-props.ts` (new label fields), `components/ListView/columns.ts`, `components/Details/DetailsPanel.tsx`, `components/Details/Header/Header.tsx`, a new `components/Details/TabsContent` content view, `index.ts` exports, and `README.md`.
- `libs/chat-overlay`: one new `OverlayFeature` member in `protocol/overlay-protocol.ts`.
- **Library isolation**: no REST path, generated client, DTO, route, or feature-flag lookup enters `libs/catalog`. The lib receives the prompt body as an already-resolved string on `CatalogItemTabData`, and every prompt-specific decision (which items exist, whether Prompt is share/publish-visible, what Edit and Use-in-chat do) arrives through the existing `items` / `isPrimaryActionVisible` / `isPublishVisible` / `isShareVisible` / `onEdit` / `onUseInChat` / `onFetchDetails` props already on `CatalogProps`. `apps/chat/src/server-api/prompts.api.ts` and `CatalogView` are the adapters.

**Application (`apps/chat`)**

- New: `server-api/prompts.api.ts`, `context/PromptsContext.tsx`, `utils/map-prompt-to-catalog-item.ts`, `pages/PromptEditor/*`, `types/prompt-editor.ts`.
- Modified: `server-api/api-client.ts`, `components/CatalogView/CatalogView.tsx`, `pages/ConversationRoute/ConversationRoute.tsx`, `types/routes.ts`, `app/app.tsx` (route registration + provider mount), `utils/publish.ts`, `context/FavoriteApplicationsContext.tsx` (a `Prompt` favourite entity kind), `constants/translation-keys.ts`, `i18n/locales/en.json`.

**Backend / API**

- `prompts/`: `utils/prompt-mapper.util.ts` (`isHiddenPromptPath`), `personal/prompts-personal.service.ts`, `public/prompts-public.service.ts`, `folder/prompts-folder.service.ts`.
- `user-config/`: `dto/user-config.dto.ts` (the `prompts` section, `createDefaultUserConfig`, version 4), a new `dto/update-installed-prompt.dto.ts`, `user-config.service.ts`, `user-config.controller.ts`.
- `share/`: `dto/create-share-link.dto.ts` (`resourceKind`), `share.service.ts`, `share.controller.ts`.
- `libs/chat-api-client`: regenerated from the updated swagger. `npm run openapi:check` stays green as proof that spec and client agree. Note the generator writes `openapi.json` unformatted — run Prettier over it afterwards.

**i18n**

- ~30 new user-visible strings. Generic action labels (Create, Edit, Delete, Save, Cancel, Copy, Use in chat) reuse existing `ButtonsI18nKeys` members rather than adding duplicates.

**Testing**

- Vitest units for the new mapper, the server-api wrappers, `PromptsContext`, the editor page, and the new lib pieces; `CatalogView` spec extended for the prompt tab, create option, and prompt action branches.
