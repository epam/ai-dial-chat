## ADDED Requirements

### Requirement: `OverlayFeature.Prompts` gates the entire prompt surface

`libs/chat-overlay/src/protocol/overlay-protocol.ts` SHALL add `Prompts = 'prompts'` to the `OverlayFeature` enum with a JSDoc line describing what it enables. The addition is additive: an overlay host that does not send `prompts` gets today's behaviour.

`apps/chat` SHALL read it through the existing `useUiFeature(OverlayFeature.Prompts)` hook, gating: prompt items entering the catalog's item list, the Prompt entry in the Create dropdown, and access to the `PromptEditor` route.

#### Scenario: Prompts hidden when the feature is disabled

- **WHEN** `OverlayFeature.Prompts` is not enabled
- **THEN** the catalog contains no Prompt items and no Prompts tab
- **AND** the Create dropdown has no Prompt entry
- **AND** navigating directly to `/prompt-editor` redirects to the catalog

#### Scenario: Prompts visible when the feature is enabled

- **WHEN** `OverlayFeature.Prompts` is enabled and the user has at least one prompt
- **THEN** the catalog shows a Prompts tab containing that prompt

#### Scenario: Existing feature keys are unaffected

- **WHEN** an overlay host sends its current feature list with no `prompts` entry
- **THEN** every other feature resolves exactly as before

---

### Requirement: `mapPromptToCatalogItem` converts prompt DTOs into catalog items

`apps/chat/src/utils/map-prompt-to-catalog-item.ts` SHALL export `mapPromptToCatalogItem(prompt: PromptResponseDto, options)` where `options` carries `{ t: TFunction; source: PromptSource }`. `PromptSource` SHALL be a string enum in `apps/chat/src/types/prompt.ts` with members `Personal = 'personal'`, `SharedWithMe = 'sharedWithMe'`, and `Public = 'public'`.

Field mapping:

| `CatalogItem` field | Value |
| --- | --- |
| `id` | `prompt.id` verbatim — the DIAL prompt path, unprefixed |
| `type` | `CatalogEntityType.Prompt` |
| `name` | `prompt.name` |
| `description` | `prompt.description ?? ''` |
| `version` | `''` — prompts are unversioned |
| `lastUsed` | `formatLastUsed(prompt.updatedAt)` |
| `createdAt` / `updatedAt` | passed through |
| `topics` | `[]` — the backend exposes no prompt topics |
| `folder` | source-prefixed segments (below) |
| `isMyApp` | `true` only for `PromptSource.Personal` |
| `sharedWithMe` | `true` only for `PromptSource.SharedWithMe` |
| `isEditable` | `true` only for `PromptSource.Personal` |
| `isUserFavorite` / `isStarred` | `favoriteIds.has(prompt.id)` — the same set the deployment and toolset mappers read |
| `isFeatured` / `isHidden` | `false` |
| `details.promptContent` | `{ content: prompt.content }` when the list response already carries a body, else omitted |
| `details.overview` | `buildPromptOverview(prompt, source, t)` — always present, since a prompt has no About tab |

`folder` SHALL be derived exactly as the deployment and toolset mappers do: split `prompt.folderId` on `/`, drop empty segments, run each through `safeDecodeURIComponent`, and prefix with `t(CatalogI18nKeys.FolderPersonal)`, `t(CatalogI18nKeys.FolderShared)`, or `t(CatalogI18nKeys.FolderPublic)` according to `source`. The `t` function is passed in as an argument so no i18n import enters a mapper's dependency chain beyond the app.

#### Scenario: Personal prompt in a nested folder

- **WHEN** `mapPromptToCatalogItem({ id: 'Work/AI/summarize', name: 'summarize', content: 'Summarize:', folderId: 'Work/AI', createdAt: 1, updatedAt: 2 }, { t, source: PromptSource.Personal })` is called
- **THEN** the result has `id: 'Work/AI/summarize'`, `type: 'PROMPT'`, `isMyApp: true`, `isEditable: true`, `sharedWithMe: false`
- **AND** `folder` is `['Personal', 'Work', 'AI']`
- **AND** `details.promptContent` is `{ content: 'Summarize:' }`

#### Scenario: Root-level personal prompt

- **WHEN** the prompt's `folderId` is `''`
- **THEN** `folder` is `['Personal']`

#### Scenario: Shared prompt is not editable

- **WHEN** a prompt is mapped with `source: PromptSource.SharedWithMe`
- **THEN** `sharedWithMe` is `true`, `isMyApp` is `false`, and `isEditable` is `false`
- **AND** `folder` begins with the Shared label

#### Scenario: Organisation prompt is not editable

- **WHEN** a prompt is mapped with `source: PromptSource.Public`
- **THEN** `isMyApp` is `false`, `sharedWithMe` is `false`, `isEditable` is `false`
- **AND** `folder` begins with the Public label

#### Scenario: A prompt whose path is in favoriteIds is starred

- **WHEN** any prompt is mapped with `favoriteIds` containing its `id`, regardless of source
- **THEN** `isUserFavorite` and `isStarred` are both `true`

#### Scenario: A prompt whose path is absent from favoriteIds is not starred

- **WHEN** a prompt is mapped with an empty `favoriteIds`
- **THEN** `isUserFavorite` and `isStarred` are both `false`

#### Scenario: Favourite matching is by full path, not by name

- **WHEN** a prompt `Work/AI/summarize` is mapped with `favoriteIds` containing only `summarize`
- **THEN** it is not marked favourited

---

### Requirement: `CatalogView` merges prompt items into the catalog list

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL extend its `catalogItems` memo with a third source, gated on `useUiFeature(OverlayFeature.Prompts)`, mapping `prompts` (Personal), `sharedWithMe` (SharedWithMe), and `publicPrompts` (Public) from `usePrompts()`. The memo's dependency array SHALL include the prompt arrays, the feature flag, and `t`.

`titles.tabLabels` SHALL gain `[CatalogEntityType.Prompt]: t(CatalogI18nKeys.TabPrompts)`.

Selector mode (`isSelectorMode`) SHALL NOT show prompts: `PICKER_VISIBLE_TYPES` stays `{ Model, Agent }`, because the picker chooses a deployment for a conversation.

#### Scenario: Prompts appear in the browse list

- **WHEN** the feature is enabled and `usePrompts()` returns two personal prompts and one organisation prompt
- **THEN** the catalog's item list contains three Prompt items with the correct folder prefixes
- **AND** the Prompts tab label comes from `CatalogI18nKeys.TabPrompts`

#### Scenario: Prompts are excluded from the model picker

- **WHEN** `CatalogView` renders with `isSelectorMode` true
- **THEN** no Prompt item is present and no Prompts tab is rendered

#### Scenario: Prompt items respect the hide-my-apps filter

- **WHEN** `OverlayFeature.CatalogHideMyApps` is enabled
- **THEN** personal prompts (`isMyApp: true`) are filtered out along with every other owned item, while organisation prompts remain

---

### Requirement: Prompt details resolve through the prompts endpoints

`handleFetchDetails` in `CatalogView` SHALL branch before its deployment path: for `CatalogEntityType.Prompt` it calls `getPublicPrompt(item.id)` when the item came from the organisation source and `getPrompt(item.id)` otherwise, and resolves `{ promptContent: { content } }`. It SHALL NOT call `getDeploymentDetails` or `getDeploymentLimits` for a prompt.

Failures SHALL resolve `undefined` exactly as the existing deployment path does, so the panel falls back to the `promptContent` the mapper already seeded and never throws out of the callback.

#### Scenario: Opening a personal prompt's details fetches its content

- **WHEN** the user opens the details panel for a personal prompt
- **THEN** `getPrompt(item.id)` is called and the Content tab renders the resolved body

#### Scenario: Opening an organisation prompt's details uses the public endpoint

- **WHEN** the user opens the details panel for a prompt whose source is Public
- **THEN** `getPublicPrompt(item.id)` is called and no personal-prompt request is issued

#### Scenario: Prompt details never call the deployment endpoints

- **WHEN** the details panel opens for a Prompt item
- **THEN** neither `getDeploymentDetails` nor `getDeploymentLimits` is called

#### Scenario: Details fetch failure falls back to seeded content

- **WHEN** `getPrompt` rejects with a 502 and the mapper had seeded `promptContent` from the list response
- **THEN** `onFetchDetails` resolves `undefined`, the panel keeps rendering the seeded content, and nothing throws

---

### Requirement: Prompt delete, share, favourite, and unshare reflect real backend capability

`CatalogView` SHALL wire each action for prompts as follows:

- **Delete** — `handleDelete` gains a Prompt branch calling `deletePrompt(item.id)` then `refetchPrompts()`. Success and failure notifications reuse the existing `CatalogI18nKeys.DetailsDeleteSuccess*` / `DetailsDeleteError` keys.
- **Share** — enabled. `isShareVisible` returns `true` for a personal prompt (`item.isMyApp`) and `false` for shared or organisation prompts. `SharePopoverContainer` SHALL pass `CreateShareLinkDtoResourceKindEnum.Prompt` to `useShareLink` for a Prompt item, so the backend qualifies the bucket-relative path; `canEditAccess` is `false`, since a prompt is not in `EDITABLE_ACCESS_TYPES`.
- **Favourite** — enabled. `onToggleFavorite` resolves the user-config section through `resolveFavoriteEntityType(item.type)`, which maps Prompt to `FavoriteEntityType.Prompt`, Toolset to `FavoriteEntityType.Toolset`, and everything else to `FavoriteEntityType.Deployment`. Prompts appear in the Favorites strip like any other favourited item.
- **Unshare (Remove from My List)** — unsupported. `isUnshareVisible` returns `false` for Prompt, because `DiscardSharedCatalogItemDto` (`apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts:6`) restricts `itemId` to `applications|toolsets|conversations` paths and would reject a prompt path with 400.
- **Revoke access** — out of scope: `libs/catalog` has no owner-side revoke action on this branch, so there is nothing to suppress for prompts or any other type.
- **Publish** — unsupported. `toPublishEntityType` (`apps/chat/src/utils/publish.ts`) returns `undefined` for Prompt, so `isPublishVisible` is already `false` via the existing `Boolean(item.isMyApp) && toPublishEntityType(item.type) != null` rule with no edit needed.

Each unsupported action's absence is a documented backend-capability limitation, not a defect.

#### Scenario: Deleting a prompt removes it from the catalog

- **WHEN** the user confirms Delete on their own prompt
- **THEN** `deletePrompt(item.id)` is called, `refetchPrompts()` runs, the item disappears from the catalog, and a success notification is shown

#### Scenario: Delete failure surfaces a trace id

- **WHEN** `deletePrompt` rejects
- **THEN** an error notification with the request id from `getApiErrorDetails` is shown and the error is re-thrown so the panel exits its pending state

#### Scenario: Own prompt can be shared

- **WHEN** the details panel opens for a personal prompt
- **THEN** the Share control is rendered and opens `SharePopoverContainer`
- **AND** the share request carries `resourceKind: 'prompt'`

#### Scenario: Organisation prompt cannot be shared

- **WHEN** the details panel opens for an organisation prompt
- **THEN** no Share control is rendered

#### Scenario: Favouriting a prompt writes to the prompts config section

- **WHEN** the user toggles the star on a prompt
- **THEN** `toggleFavorite(item.id, true, FavoriteEntityType.Prompt)` is called
- **AND** neither the deployments nor the toolsets section is written

#### Scenario: A favourited prompt appears in the Favorites strip

- **WHEN** the catalog renders with a prompt whose path is in `favoriteIds`
- **THEN** that prompt is present in the `favorites` array passed to `Catalog`

#### Scenario: No unshare control on a shared prompt

- **WHEN** the details panel opens for a prompt shared with the current user
- **THEN** no "Remove from My List" action is rendered
- **AND** the Content tab and primary action are still available

#### Scenario: Deployment actions are unchanged

- **WHEN** the details panel opens for a Model, Agent, or Toolset item
- **THEN** its favourite, publish, share, and unshare controls render exactly as before this change

---

### Requirement: Non-functional contract for prompt catalog integration

- **Memoisation**: the prompt-item mapping MUST live inside the existing `catalogItems` `useMemo`; `handleFetchDetails`, `handleDelete`, and every visibility predicate MUST be `useCallback`'d so `Catalog`'s fetch effect and ag-grid column identity are not invalidated on unrelated re-renders.
- **i18n**: new keys `catalog.tabPrompts` (`CatalogI18nKeys.TabPrompts`) and `catalog.details.tabContent` (`CatalogI18nKeys.DetailsTabContent`). Copy/Delete/Edit/Cancel labels reuse existing `ButtonsI18nKeys` members. Every key is declared in `translation-keys.ts` and `en.json` in the same change.
- **RTL / direction impact**: the Content tab and folder breadcrumb use logical properties only; no new physical-direction class and no mirrored icon are introduced by the app adapter.
- **Accessibility**: the Content tab's copy control keeps a stable `aria-label` with a separate `role="status" aria-live="polite"` confirmation region; the Prompts tab participates in the existing `TabRow` keyboard model unchanged.
- **Observability**: none beyond the shared API client's per-request logging.
- **Rate limiting / caching**: no new client cache. Backend throttles already apply per the prompts controller.
- **Authorization**: every prompt endpoint is session-authenticated and scoped to the caller's own bucket by the backend; the frontend adds no role check. Organisation prompts are read-only for all users.

#### Scenario: Prompt mapping does not invalidate the details fetch

- **WHEN** `CatalogView` re-renders because an unrelated notification is shown
- **THEN** `handleFetchDetails`'s identity is unchanged and `Catalog` does not re-issue a details fetch

#### Scenario: No raw translation key literal is passed to `t()`

- **WHEN** the prompt-related code calls `t()`
- **THEN** every key comes from a `translation-keys.ts` enum member, never a string literal
