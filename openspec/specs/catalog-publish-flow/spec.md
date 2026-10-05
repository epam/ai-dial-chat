# catalog-publish-flow Specification

## Purpose

Publishing a catalog entity: folder-tree destination picking, inline folder creation, access rules, and submission against real backend data.
## Requirements
### Requirement: Folder selection uses the file-manager folder tree
The catalog publish panel SHALL present the destination-folder picker using the `DialFoldersTree` component from `@epam/ai-dial-react-file-manager` (a peer dependency of `libs/publish-panel`) (`showFiles={false}`, with the per-row "Add child"/"Add sibling" context menu described below) rendered inside the shared `PublishFoldersTree` wrapper (exported from `@epam/ai-dial-publish-panel`), instead of the bespoke `PublishFolderPicker` tree. Selection SHALL remain single-folder: selecting a new folder replaces the prior selection.

State ownership: `@epam/ai-dial-publish-panel`'s `usePublishFlow` hook (relocated from `libs/catalog/src/utils/use-publish-flow.ts`, now published as part of the shared publish-panel library) owns `selectedFolderPath`; `usePublishFolders` in `libs/chat-hooks/src/catalog/usePublishFolders/usePublishFolders.ts` (exported from `@epam/ai-dial-chat-hooks`) owns the folder-tree data and logic (`folderItems`, `expandedPaths`, `loadingPaths`, `loadedPaths`, lazy loading, local folder creation, remembered destinations) and is memoised with `useMemo`/`useCallback` so `PublishPanel` does not re-render on every host render. The app-level `apps/chat/src/hooks/publish/usePublishFolders.ts` is a thin wrapper that supplies `listPublicFiles` and persists remembered destinations in `localStorage` under `StorageKey.PublishDestinationFolders`.

RTL/direction impact: the tree and search input SHALL use CSS logical properties only; `DialFoldersTree` renders its own RTL-correct chevrons and indentation internally, so no app- or lib-level directional icon mirroring is added for this requirement.

#### Scenario: User selects a destination folder
- **WHEN** the user clicks a folder node in the publish folder tree
- **THEN** that folder's path becomes `selectedFolderPath`, the tree highlights it as selected, and any previously selected folder is deselected

#### Scenario: Expanding a folder loads its children lazily
- **WHEN** the user expands a folder node that has not yet been loaded
- **THEN** `usePublishFolders` adds the folder to `loadingPaths`, fetches its children via `listPublicFiles`, and on success adds the path to `loadedPaths` and merges the children into `folderItems`

### Requirement: The bucket root is a selectable publish destination, represented as a tree node
`selectedFolderPath: string[] | undefined` SHALL use `undefined` to mean nothing is selected and `[]` to mean the bucket root itself (e.g. the Organization/public root) is selected as the destination — `[]` is a distinct, valid selection, not a "deselected" state. Matching the file manager's own folder-tree pattern (`useDialFileManager.ts`'s root `DialFile` node), `PublishFoldersTree` SHALL represent the bucket root as a real top-level tree node (`rootLabel` prop, default `'Organization'`) wrapping the rest of the tree as its children, selectable and expandable the same way as any folder — not as a control rendered outside the tree.

The root node SHALL always render expanded so its children remain visible without an extra interaction.

#### Scenario: User selects the bucket root as the destination
- **WHEN** the user clicks the root node in the folder tree
- **THEN** `selectedFolderPath` becomes `[]`, the tree highlights the root node as selected, and any previously selected folder is deselected

#### Scenario: User deselects the bucket root
- **WHEN** the user clicks the already-selected root node again
- **THEN** `selectedFolderPath` becomes `undefined` and the root node shows as not selected

### Requirement: Search filters the folder tree client-side
`PublishPanel` (in `libs/publish-panel`) SHALL render the ui-kit `Search` component above the folder tree, labelled through its `searchPlaceholder` label (also used as the field's `aria-label`). Typing a query SHALL filter the currently loaded folder tree by folder name (case-insensitive, matching folder name substrings) before the filtered tree is converted to `DialFile[]` and passed to `DialFoldersTree`.

Filtering SHALL be suspended for as long as the inline create-folder row is open, and resume when creation is confirmed or cancelled. `DialFoldersTree` renders that row underneath its parent node, so a query that filters the parent out (in particular a query matching nothing at all, which renders the empty state instead of the tree) would otherwise hide the editor the user just opened.

i18n keys: `CatalogI18nKeys.PublishFolderSearchPlaceholder`, `CatalogI18nKeys.PublishFolderEmptyState`.

#### Scenario: Search query matches no folders
- **WHEN** the user types a query that matches no loaded folder name
- **THEN** the tree renders the `DialFoldersTree` empty state using `CatalogI18nKeys.PublishFolderEmptyState`

#### Scenario: User creates a folder from a search that matched nothing
- **GIVEN** the search query matches no folder, so the empty state is shown
- **WHEN** the user clicks "Create new folder"
- **THEN** the tree (with the root node) renders again with the inline create row open under the selected parent — or under the root when nothing is selected — pre-filled with the unmatched query as the new folder's name, falling back to the default name when the query is not a valid folder name

#### Scenario: User cancels folder creation started from a search that matched nothing
- **WHEN** the user cancels the inline create row
- **THEN** the filter resumes and the no-results empty state is shown again

### Requirement: Folders are displayed in name order
`PublishFoldersTree` SHALL order folders by name at every level of the tree before converting them to `DialFile[]`, using a case-insensitive, digit-aware comparison (`localeCompare` with `sensitivity: 'base'` and `numeric: true`), so `"Report 2"` precedes `"Report 10"`. Ordering is a display concern owned by the tree: hosts MAY pass `items` in any order (backend listing order, lazily merged children, locally created folders appended at the end) and the rendered order SHALL be the same either way.

#### Scenario: Backend returns folders in an arbitrary order
- **WHEN** the host passes folder nodes in listing order
- **THEN** the tree renders them alphabetically at every level

#### Scenario: A newly created folder keeps its place in the order
- **WHEN** the user confirms a new folder name
- **THEN** the folder is rendered in its name-ordered position among its siblings, not appended to the end of the list

### Requirement: Inline folder creation via the file-manager tree
Creating a new folder SHALL use `DialFoldersTree`'s built-in inline create-folder row (`onCreateFolderSave`, `onCreateFolderCancel`, `createdFolderPath`) instead of the bespoke picker's custom create row. `PublishFoldersTree` SHALL pass the target parent folder path through `createdFolderPath` and SHALL NOT insert a synthetic new-folder node into `items`; `DialFoldersTree` owns the temporary editable row beneath that parent. On save, the app-level `onCreatePublishFolder` callback SHALL be invoked with the parent path and new folder name; the new folder SHALL be merged into the in-memory tree and auto-selected immediately.

`onCreatePublishFolder` (`usePublishFolders` in `libs/chat-hooks`, surfaced to the app through `apps/chat/src/hooks/publish/usePublishFolders.ts`) SHALL NOT call the backend folder-creation endpoint. The folder exists only in the client-side tree until the user actually submits Publish, at which point the real publish request writes to the nested `folderPath`; DIAL Core storage creates any missing path segments implicitly, the same way writing a file to a new prefix does. This avoids leaving an orphaned empty folder on the backend when the user picks a new-folder name and then cancels or navigates away without publishing — unlike `useDialFileManager`'s "New folder" action (File Manager), which does create a real, immediately-persisted folder resource, since that flow's whole purpose is managing folders as first-class content.

#### Scenario: User creates a new folder under the selected parent
- **WHEN** the user confirms a new folder name in the inline create row
- **THEN** `onCreatePublishFolder(parentPath, name)` is called, no backend request is sent, the new folder appears in the tree immediately, and it becomes the selected folder

#### Scenario: User cancels publish after creating a folder locally
- **GIVEN** the user created a new folder in the destination picker and selected it
- **WHEN** the user cancels the Publish panel instead of submitting
- **THEN** no folder was ever created on the backend — nothing to roll back or clean up

### Requirement: Destinations already published to stay available in the tree
Publishing creates a DIAL Core publication *request*, so a destination folder picked during publish is not a listable resource in the Organization/public files bucket the tree is built from (and never becomes one, since approved publications land in the resource type's own public namespace). `usePublishFolders` SHALL therefore expose `rememberPublishFolder(folderPath: string[])`, handing each used destination's path key to the host through `onRememberedFolderKeysChange`, which the app wrapper persists to `localStorage` under `StorageKey.PublishDestinationFolders` (most recent first, deduplicated, capped at 50 entries; the bucket root — an empty path — is not stored), and SHALL merge every remembered path into `folderItems` via `mergeFolderPaths`, creating any missing ancestor node and never duplicating a folder the public bucket already lists. Both publish hosts (`PublishConversationPanelContainer` and `CatalogView`) SHALL call it from their `onPublishSuccess` handler, so only destinations of a publish that actually succeeded are remembered.

#### Scenario: User publishes a second item to a folder created during the first publish
- **GIVEN** the user created a folder in the publish panel and published an item to it
- **WHEN** the user opens the publish panel again for another item
- **THEN** that folder is still listed in the destination tree and can be selected

#### Scenario: Publish fails
- **WHEN** `onPublish` rejects
- **THEN** the destination is not remembered

### Requirement: Per-row "Add sibling" / "Add child" folder creation
In addition to the trailing "Create new folder" button, `PublishFoldersTree` SHALL expose a per-row context menu (`DialFoldersTree`'s `getContextMenuItems` prop) with two actions: "Add child" (creates the new folder inside the clicked folder) and "Add sibling" (creates the new folder as a sibling of the clicked folder, one level up). This mirrors the file manager's own "Add sibling"/"Add child" folder-creation actions (`useFolderCreation`'s `startTreeSiblingFolderCreation`/`startTreeChildFolderCreation` internal to `@epam/ai-dial-react-file-manager`'s `FileManager`, not exported from the package) — reimplemented against the tree's public context-menu API rather than importing the internal hook. "Add sibling" SHALL be omitted for the root node, which has no parent to create a sibling under. Both actions resolve a unique default name and validate exactly like the trailing button (see the two requirements above) — there is no separate code path.

#### Scenario: User adds a child folder via the context menu
- **WHEN** the user opens the context menu on a folder row and selects "Add child"
- **THEN** the inline create-folder row appears nested inside that folder, pre-filled with a unique default name

#### Scenario: User adds a sibling folder via the context menu
- **WHEN** the user opens the context menu on a non-root folder row and selects "Add sibling"
- **THEN** the inline create-folder row appears at the same level as that folder (under its parent), pre-filled with a unique default name

#### Scenario: Root node has no "Add sibling" action
- **WHEN** the user opens the context menu on the bucket root node
- **THEN** only "Add child" is offered — "Add sibling" is not, since the root has no parent

### Requirement: Inline folder creation validates the name client-side
Before invoking `onCreatePublishFolder`, `PublishFoldersTree` SHALL validate the confirmed name via `validateFolderName` (exported from `@epam/ai-dial-publish-panel`, relocated from `libs/catalog/src/utils/publish-folder-tree.ts`) and reject: an empty (post-trim) name, a name containing `..` or any of the forbidden characters `/ \ : ; , = { } &  "`, and a name duplicating a sibling folder (case-insensitive). This mirrors the backend's `IsValidFilePath` path-traversal rule so an invalid destination is rejected in the UI instead of only failing the network request. The same validator SHALL be wired as `DialFoldersTree`'s `onRenameValidate` prop, which the file-manager tree also invokes for the create-folder row, so the input shows an inline error and blocks Save while invalid.

#### Scenario: User enters a path-traversal or forbidden-character folder name
- **WHEN** the user types `../EscapeFolder` (or any name containing `..` or a forbidden character) into the inline create row and confirms
- **THEN** an inline validation error is shown, `onCreatePublishFolder` is NOT called, and no folder is added to the tree

#### Scenario: User enters an empty folder name
- **WHEN** the user confirms an empty or whitespace-only name in the inline create row
- **THEN** an inline validation error is shown and `onCreatePublishFolder` is NOT called

### Requirement: Publish visibility is scoped to editable entities
The catalog Header's Publish action SHALL only be shown (`isPublishVisible`) when the current catalog item is user-owned/editable, in addition to the entity-type gate: `isPublishVisible` (`apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts`) is `item.isMyApp && toPublishEntityType(item.type) != null`, and `toPublishEntityType` (`libs/chat-hooks/src/catalog/publish.ts`) maps Model, Toolset, Agent (Application), Prompt and Skill. This is a client-side UI gate only; it does not replace server-side write-access enforcement.

#### Scenario: Non-editable entity does not show Publish
- **WHEN** the current catalog item is not user-owned/editable
- **THEN** the Header does not render the Publish action regardless of entity type

#### Scenario: Editable publishable entity shows Publish
- **WHEN** the current catalog item is user-owned/editable and its type is Model, Toolset, Application, Prompt, or Skill
- **THEN** the Header renders the Publish action

### Requirement: The submit button label never embeds the destination name
`PublishFooter`'s submit button SHALL read a fixed label (`'Publish'`, or `'Update version {version}'` when replacing an existing version) regardless of which folder or the root is selected. The destination name SHALL NOT be interpolated into the button label, since folder/entity names of arbitrary length would overflow the button.

#### Scenario: A long destination folder name is selected
- **WHEN** the user selects a destination folder or the root with an arbitrarily long name
- **THEN** the submit button still reads `'Publish'` (or the update-version label), unaffected by the destination name's length

### Requirement: Publish submission and history use real backend data
`CatalogView` SHALL call the real `onPublish`, `getPublishHistory`, and `hasPublishWriteAccess` implementations backed by `apps/chat/src/server-api` wrappers instead of mock data (`MOCK_PUBLISH_FOLDERS`, `MOCK_PUBLISH_HISTORY`, and the mock `handlePublish`), which SHALL be deleted once parity is confirmed.

`getPublishHistory` (defined in `apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts` and supplied by `CatalogView`) SHALL call `getCatalogPublishHistory` and map the response through `mapPublishHistoryEntryDto`. For an item whose id addresses the `public` bucket (`isPublicCatalogEntityId`) it SHALL instead synthesise a single entry from the id (`getPublicCatalogEntityFolderPath`) without calling the endpoint; a non-publishable type resolves to `[]`. The earlier stub that always resolved to `[]` (GitHub issue [#7897](https://github.com/epam/ai-dial-chat/issues/7897)) has been removed, and no temporary exception remains; the `503` it worked around was our own `getPublications` response-shape defect — since fixed in `publish/publication.util.ts`, along with the list scope and the metadata-only list response (see `catalog-publish-api`) — not a missing endpoint and not Core being unavailable.

The fetch is load-bearing beyond the publish panel: it is the only source of the folder list the Unpublish action needs, and it is what makes that action visible at all (see `catalog-unpublish-flow`). While it returned a frozen `[]`, `Unpublish` could never appear for any catalog entity.

The publish sub-view SHALL NOT render a versions-history list: `PublishPanel` has no history section and takes no history props, so the fetched history is consumed by `usePublishFlow` (existing-publication detection) and by the Unpublish action. `PublishHistoryList` remains exported from `@epam/ai-dial-publish-panel` for custom layouts and is not rendered by the app.

Submit success: `CatalogView`'s `onPublishSuccess` SHALL raise its notification through `useOperationNotification` (see `entity-operation-notifications`) with the item's resolved `NotifiableEntity` and `EntityOperation.PublishRequested`, passing the entity name and the selected destination folder. The copy SHALL state that a publish request was submitted and appears once an admin approves it — the endpoint creates an admin-pending DIAL Core publication, exactly as the conversation publish flow already reports. The previous `CatalogI18nKeys.PublishSuccess*` pair (`"Published"` / `"\"{{name}}\" published to {{folder}}"`) SHALL be deleted, since it claimed an outcome the backend does not deliver.

Submit failure: `CatalogView` SHALL supply an `onPublishError` handler, threaded down as `CatalogProps.onPublishError` → `DetailsPanelProps.onPublishError` → `usePublishFlow` the same way `onPublishSuccess` already is, so a rejected publish produces an error notification in addition to the inline submit-error callout ([GitHub issue #7898](https://github.com/epam/ai-dial-chat/issues/7898)). It SHALL reuse the same shared `usePublishErrorNotification` hook and shared `publish.*` i18n namespace as the conversation publish flow (see `conversation-publish-flow`), including the offline branch that swaps in `publish.networkErrorMessage` and omits `requestId`. `CatalogView` SHALL also pass the translated `publishLabels.submitError` (`publish.submitErrorCallout`), so the callout no longer renders the publish-panel library's hardcoded English default.

Accessibility: the submit-error callout SHALL use `role="alert"`.

#### Scenario: Publish succeeds
- **WHEN** the user submits a publish request and the backend returns success
- **THEN** `onPublishSuccess` fires, a success notification titled `"<Entity> publish requested"` is shown through `useOperationNotification`, and its body names the entity and destination folder and states an admin must approve it

#### Scenario: Publish notification names the entity kind
- **WHEN** a toolset is published and, separately, a prompt is published
- **THEN** the first notification reads `"Toolset publish requested"` and the second `"Prompt publish requested"`, resolved from the item's `CatalogEntityType`

#### Scenario: Publish fails due to no write access
- **WHEN** the user submits a publish request and the backend returns a 403
- **THEN** `derivePublishState` surfaces the no-access callout and the submit action remains available for a different folder selection

#### Scenario: Publish fails and the panel reports it outside the panel too
- **WHEN** the user submits a publish request and it rejects (backend error or lost connection)
- **THEN** the publish sub-view stays open with the submit-error callout, `onPublishError` receives the rejection reason, and an error notification is shown

#### Scenario: History is fetched from the endpoint, not stubbed
- **WHEN** the publish sub-view or the Manage menu triggers a history lookup for an entity
- **THEN** `getCatalogPublishHistory` is called for that entity and its mapped entries are returned to the catalog, with no code path resolving to a hardcoded empty array

#### Scenario: The publish sub-view shows no versions history
- **WHEN** the user opens the publish sub-view and selects a destination folder
- **THEN** no versions-history list is rendered, whatever `history` contains

#### Scenario: Publish history fails to load
- **WHEN** `getPublishHistory` rejects
- **THEN** the `Unpublish` menu entry stays hidden (see `catalog-unpublish-flow`)

### Requirement: Catalog entity summary is supplied to the shared publish panel as resource metadata
`DetailsPanel` SHALL supply the publish summary to the shared `PublishPanel` (from `@epam/ai-dial-publish-panel`) as the `resource` prop — `{ title: item.name, version: item.version, type: item.type, iconUrl: item.iconUrl }` — plus the version-tag colors through `styles.colors` (`summaryVersionTagBorder`/`summaryVersionTagBackground`/`summaryVersionTagText`, from `detailsColors`), rather than passing a `CatalogItem` or a `renderSummary` slot. `DetailsPanel` SHALL remain the only place in `libs/catalog` that maps a `CatalogItem` to that summary; `PublishPanel` SHALL NOT receive a `CatalogItem`. Because `resource.type` is set, `PublishPanel` builds the entity-header row itself (`ResourceSummary` with type, name, version and icon) and ignores any `renderSummary`, which only replaces the title-only row used when `resource.type` is absent.

#### Scenario: Catalog publish sub-view still shows the entity header and version tag
- **WHEN** the user opens the publish sub-view for a versioned catalog entity (Application, Toolset, or Model)
- **THEN** `PublishPanel` renders the entity-header summary (name, icon, version tag) from the `resource` object `DetailsPanel` passes

#### Scenario: PublishPanel has no compile-time dependency on CatalogItem
- **WHEN** `libs/catalog/src/components/Details/DetailsPanel.tsx` is inspected
- **THEN** it imports `PublishPanel` from `@epam/ai-dial-publish-panel` and passes `resource={{ title, version, type, iconUrl }}`, and no `item: CatalogItem` prop is passed to `PublishPanel`

### Requirement: Catalog publish flow wires the shared access-rules editor and includes rules in the publish request

`DetailsPanel`'s `usePublishFlow` instance SHALL supply `rules`/`setRules` to its inline `PublishPanel` render via the `rules`/`onRulesChange` props, together with `ruleSourceOptions`. `ruleSourceOptions` is threaded down from `CatalogProps.ruleSourceOptions?: string[]` through `Catalog` and `DetailsPanelProps`, the same way `publishFolderItems`/`publishLabels` are, and `DetailsPanel` defaults it to an empty list when absent. `CatalogView` supplies it from `useAppConfig().config.publicationFilterSources`.

`CatalogView` SHALL pass `handlePublish` from the app hook `useCatalogPublishing` (`apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts`) as `onPublish`. Its signature is `(item, folderPath, rules, author, publishCredentials)`; it SHALL map `rules` through `toPublishRuleDto` and forward them to `publishCatalogEntity`, which includes them in the request body sent to `POST /api/v1/catalog/{entityType}/{entityId}/publish` (see `catalog-publish-api`).

#### Scenario: Rules entered in the details panel reach the publish call
- **GIVEN** the user has added one rule (`source: 'title'`, `function: 'EQUAL'`, `targets: ['Internal Tools']`) and selected a destination folder for an application
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with a request body whose `rules` array contains exactly that one rule

#### Scenario: No rules added sends an empty array
- **GIVEN** the user has not added any rules
- **WHEN** the user clicks Publish for a toolset
- **THEN** `publishCatalogEntity` is called with `rules: []`, identical to today's behavior

#### Scenario: Same rules section appears for applications and toolsets
- **WHEN** the Publish sub-view opens inside `DetailsPanel` for an Application and, separately, for a Toolset
- **THEN** the same access-rules section renders identically in both cases, since `PublishPanel` has no entity-type-specific branching for this section

### Requirement: Selecting a destination folder pre-fills the rules editor with that folder's existing rules

`DetailsPanel`'s `usePublishFlow` instance SHALL be supplied an `onFetchExistingRules` option — a thin call to the same `apps/chat/src/server-api/publish-rules.api.ts`'s `getPublishRules(folderPath)` used by the conversation flow — passed down through `CatalogProps` from `CatalogView` (or supplied directly by `DetailsPanel` if threading through `Catalog` is unnecessary; decided at implementation time, matching however `onCreatePublishFolder` is currently threaded). For applications and toolsets, choosing a destination folder replaces the rules editor's contents with that folder's already-configured rules (or empties it, if none).

#### Scenario: Selecting a folder with prior rules pre-fills the editor for an application
- **GIVEN** the user opens the Publish sub-view for an application and selects a destination folder that already has a configured rule
- **WHEN** the lookup resolves
- **THEN** the rules editor shows that existing rule as a chip, without the user having entered it

#### Scenario: A rules-lookup failure does not block the catalog publish flow
- **GIVEN** the user selects a destination folder for a toolset and the rules lookup fails
- **THEN** folder selection, manual rule entry, and the Publish submit action all remain fully usable; only the pre-fill did not occur

### Requirement: Catalog publish panel offers an editable author pre-filled with the publisher's name

The catalog publish sub-view SHALL show the shared publish panel's author field, pre-filled with the signed-in user's display name, and SHALL send the submitted value with the publish request so it becomes the published entity's **Hosted by** value.

State ownership: `DetailsPanel`'s existing `usePublishFlow` instance owns `author`/`setAuthor` (see `publish-panel-library`) and supplies them to its inline `PublishPanel` render via the new required `author`/`onAuthorChange` props, threaded the same way `rules`/`onRulesChange` already are.

Prefill is host-resolved, not lib-resolved. `CatalogProps` and `DetailsPanelProps` (`libs/catalog/src/models/item-details-props.ts`) SHALL gain `publishDefaultAuthor?: string`, threaded `CatalogView` → `Catalog` → `DetailsPanel` → `usePublishFlow`'s `defaultAuthor` option, exactly as `publishFolderItems`/`publishLabels` already are. `CatalogView` SHALL resolve the value from `useUserProfile()`'s `displayName`. Neither `libs/catalog` nor `libs/publish-panel` reads `UserContext`, OIDC claims, or i18n for it, per AGENTS.md §Library isolation; `publishDefaultAuthor` is the app-level adapter contract that carries the host's session knowledge across the boundary.

Submission: `CatalogProps.onPublish` and `DetailsPanelProps.onPublish` SHALL take the author as a fourth argument, matching `usePublishFlow`'s extended `onPublish` signature. `CatalogView.handlePublish` (delegating to `useCatalogPublishing`'s `handlePublish`) SHALL accept that argument and forward it to `publishCatalogEntity`, which SHALL include it in the request body's `author` field sent to `POST /api/v1/catalog/{entityType}/{entityId}/publish` (see `catalog-publish-api`). When the value is empty after trimming, `handlePublish` SHALL omit `author` from the request body entirely rather than sending an empty string, so the backend's session-derived fallback applies.

Unpublish is unaffected: `unpublishCatalogEntity` SHALL NOT gain an author field, since a removal request's `displayAuthor` identifies the requester of that removal rather than the published entity's author.

i18n: the new user-visible strings SHALL be registered on `PublishI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and added to `apps/chat/src/i18n/locales/en.json` — `publish.authorLabel` (`"Author"`), `publish.authorPlaceholder` (`"Author name"`), and `publish.authorHint` (explaining the value is shown as the publication's author in the catalog). `CatalogView` SHALL pass them through `publishLabels` as `authorLabel`, `authorPlaceholder`, and `authorHint`, alongside the labels it already supplies. The library's English defaults SHALL NOT be relied upon by the app.

RTL/direction impact: none beyond the surrounding panel. The field is a ui-kit `Input` positioned with CSS logical properties; no directional icon is introduced, so no `rtl:` mirroring applies.

Feature gating: none. The field is not behind `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` — it is part of the publish panel, whose visibility is already governed by the existing `Publish visibility is scoped to editable entities` requirement.

#### Scenario: Author is pre-filled with the signed-in user's display name

- **GIVEN** the signed-in user's profile resolves `displayName` to `"Daniil Pavlov"`
- **WHEN** the user opens the publish sub-view for a toolset
- **THEN** the author field shows `"Daniil Pavlov"` without the user typing anything

#### Scenario: Edited author reaches the publish call

- **GIVEN** the user replaces the pre-filled author with `"DIAL Team"` and selects a destination folder
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with a request body whose `author` is `"DIAL Team"`

#### Scenario: Untouched pre-filled author is sent as-is

- **GIVEN** the user leaves the pre-filled author unchanged
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with `author` equal to the signed-in user's display name, producing the same **Hosted by** value as before this change

#### Scenario: Cleared author omits the field from the request

- **GIVEN** the user clears the author field
- **WHEN** the user clicks Publish
- **THEN** `publishCatalogEntity` is called with no `author` key in the request body, and the backend falls back to the session-derived display name

#### Scenario: Author resets when a different item is opened

- **GIVEN** the user edited the author for one catalog item without submitting
- **WHEN** the details panel switches to a different item and `publishFlow.reset()` runs
- **THEN** the author field returns to the signed-in user's display name

#### Scenario: Prefill arrives after the panel opens

- **GIVEN** the user profile has not yet resolved when the publish sub-view first renders, so the author field is empty
- **WHEN** `publishDefaultAuthor` resolves to the user's display name and the user has not typed in the field
- **THEN** the field fills with that name

#### Scenario: Labels come from the app's i18n, not the library defaults

- **WHEN** the publish sub-view renders in the catalog
- **THEN** the author field's label, placeholder, and hint are the translated `publish.authorLabel`/`publish.authorPlaceholder`/`publish.authorHint` values passed through `publishLabels`

#### Scenario: Unpublish request carries no author

- **WHEN** the user submits an unpublish request for a published catalog entity
- **THEN** `unpublishCatalogEntity` is called with the same request body shape as before this change, with no `author` field

### Requirement: Catalog publish panel offers a credentials opt-in for authenticated toolsets the publisher is signed in to

The catalog publish sub-view SHALL show the shared publish panel's credentials checkbox for a toolset that needs a login and whose publisher holds one, and SHALL send the chosen value with the publish request so DIAL Core publishes the publisher's own credential alongside the toolset.

**When the control is offered.** `DetailsPanel` SHALL offer it when all of the following hold for the item being published:

- `item.type` is `CatalogEntityType.Toolset`;
- `item.credentials?.authenticationType` is set and is not `ToolsetAuthenticationType.None`;
- `item.credentials.userStatus` is `CredentialStatus.SignedIn` **or** `item.credentials.globalStatus` is `CredentialStatus.SignedIn`.

Both authentication types qualify — OAuth and API key. A shared team API key is the most common internal case, and nothing about the flag is OAuth-specific.

Either credential level qualifies because publishing always acts on the publisher's own source item (`isPublishVisible` already requires `item.isMyApp`): on a personal item `globalStatus` is the owner's own credential, and `userStatus` covers a personal credential configured on top of it. Access the publisher does not hold cannot be passed on, so a toolset the publisher is signed out of SHALL offer no control.

The eligibility decision SHALL be made inside `libs/catalog` from `item.credentials`, which `DetailsPanel` already receives and already branches on for its credentials action (see `catalog-toolset-credentials`). No new fetch, no new loading state, and no new host prop are introduced for it, and `libs/publish-panel` SHALL remain unaware of toolsets and credential levels (see `publish-panel-library`).

**No role gate.** Any publisher who is signed in to the toolset may select the option; administrator status is irrelevant. DIAL Core's existing pending-approval lifecycle — every publication is `PENDING` until an administrator approves — is the control point for the act.

**Default state.** The option SHALL be cleared every time the publish sub-view is opened, including immediately after a publication submitted with it selected, and including for a destination folder whose previous publication carried shared credentials. `usePublishFlow` owns the state and `DetailsPanel` already calls `reset()` on every close path (see `publish-panel-library`).

**Submission.** `CatalogProps.onPublish` and `DetailsPanelProps.onPublish` SHALL take the flag as a fifth argument, matching `usePublishFlow`'s extended signature. `CatalogView.handlePublish` (delegating to `useCatalogPublishing`'s `handlePublish`) SHALL forward it to `publishCatalogEntity` as the request body's `publishCredentials` field (see `catalog-publish-api`), omitting the field entirely when it is `false` so a publish without shared access sends exactly the request it sends today. A non-toolset item, or a toolset that was never offered the control, SHALL never send the field.

**Unpublish is unaffected.** `unpublishCatalogEntity` SHALL NOT gain the field.

**Confidentiality.** No credential value SHALL be read, displayed, logged, or sent by any part of this flow — only the boolean.

**i18n.** The new user-visible strings SHALL be registered on `CatalogI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and added to `apps/chat/src/i18n/locales/en.json` — `catalog.publish.credentialsLabel` (`"Publish with my credentials"`) and `catalog.publish.credentialsHint` (stating that members will use the toolset without authorising and that the credential itself is never shown to them). `CatalogView` SHALL pass them through `publishLabels` as `credentialsLabel` and `credentialsHint`, alongside the labels it already supplies. The library's English defaults SHALL NOT be relied upon by the app.

**RTL/direction impact:** none beyond the surrounding panel. The control is a ui-kit `Checkbox` positioned with CSS logical properties; no directional icon is introduced, so no `rtl:` mirroring applies.

**Feature gating:** none. The control is part of the publish panel, whose visibility is already governed by the existing `Publish visibility is scoped to editable entities` requirement.

#### Scenario: An OAuth toolset the publisher is signed in to offers the option

- **GIVEN** the publisher's own toolset has `authenticationType: OAuth` and `globalStatus: SignedIn`
- **WHEN** the publisher opens the publish sub-view
- **THEN** the credentials checkbox is shown, cleared

#### Scenario: An API-key toolset the publisher is signed in to offers the option

- **GIVEN** the publisher's own toolset has `authenticationType: ApiKey` and `userStatus: SignedIn`
- **WHEN** the publisher opens the publish sub-view
- **THEN** the credentials checkbox is shown, cleared

#### Scenario: A toolset that needs no login offers no option

- **GIVEN** the item is a toolset whose `authenticationType` is `None`, or which has no `credentials` at all
- **WHEN** the publisher opens the publish sub-view
- **THEN** no credentials checkbox is rendered

#### Scenario: A toolset the publisher is signed out of offers no option

- **GIVEN** the item is a toolset with `authenticationType: OAuth` whose `userStatus` and `globalStatus` are both absent or not `SignedIn`
- **WHEN** the publisher opens the publish sub-view
- **THEN** no credentials checkbox is rendered, because access the publisher does not hold cannot be passed on

#### Scenario: A non-toolset entity offers no option

- **GIVEN** the item is an application, prompt, skill, or model
- **WHEN** the publisher opens the publish sub-view
- **THEN** no credentials checkbox is rendered

#### Scenario: A non-administrator may select the option

- **GIVEN** the publisher is not an administrator and is signed in to their own authenticated toolset
- **WHEN** the publisher opens the publish sub-view
- **THEN** the credentials checkbox is shown and can be selected

#### Scenario: Selecting the option reaches the publish call

- **GIVEN** the publisher ticks the credentials checkbox and selects a destination folder
- **WHEN** the publisher clicks Publish
- **THEN** `publishCatalogEntity` is called with a request body whose `publishCredentials` is `true`

#### Scenario: Leaving the option clear sends the unchanged request

- **GIVEN** the publisher leaves the credentials checkbox clear
- **WHEN** the publisher clicks Publish
- **THEN** `publishCatalogEntity` is called with no `publishCredentials` field in the request body

#### Scenario: The option is cleared when the panel is reopened

- **GIVEN** the publisher published the toolset with the credentials checkbox ticked
- **WHEN** the publisher opens the publish sub-view for that toolset again
- **THEN** the checkbox is cleared

#### Scenario: The option is cleared after cancelling

- **GIVEN** the publisher ticks the checkbox and then cancels the publish sub-view
- **WHEN** the publisher reopens it
- **THEN** the checkbox is cleared

#### Scenario: A destination folder previously published to with shared credentials does not pre-select it

- **GIVEN** publish history shows the selected folder's previous publication carried shared credentials
- **WHEN** the publisher selects that folder
- **THEN** the checkbox stays cleared

### Requirement: Catalog publish history records which publications carried shared credentials

`getPublishHistory` (`useCatalogPublishing`) SHALL map the endpoint's `publishCredentials` field onto `PublishHistoryEntry` via `mapPublishHistoryEntryDto`. The app renders no history list, so no marker is shown; `PublishHistoryList` renders it through its `sharedCredentialsLabel` prop in a custom layout (see `publish-panel-library`).

The synthesised single-entry history a public copy's own id produces (`isPublicCatalogEntityId`) SHALL leave `publishCredentials` unset, since that path never calls the endpoint and has no publication record to read it from. Absent reads as `false`.

#### Scenario: A publication made with shared credentials is marked in history

- **WHEN** the history endpoint reports an entry with `publishCredentials: true`
- **THEN** `mapPublishHistoryEntryDto` carries it onto the `PublishHistoryEntry` as `true`

#### Scenario: A publication made without shared credentials is unmarked

- **WHEN** the history endpoint reports an entry with `publishCredentials: false`
- **THEN** the mapped entry is `false`

#### Scenario: A public copy's synthesised history entry carries no flag

- **GIVEN** the item's id addresses the `public` bucket, so history is synthesised from the id rather than fetched
- **WHEN** that entry is produced
- **THEN** its `publishCredentials` is unset and no marker is rendered
