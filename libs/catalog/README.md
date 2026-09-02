# @epam/ai-dial-catalog

Marketplace/catalog component for browsing models, tools, and assistants with search, filtering, sorting, favorites, and detail views.

## Overview

`@epam/ai-dial-catalog` is a self-contained marketplace panel for browsing the AI DIAL entity catalog — models, tools, and assistants. It addresses the challenge of presenting potentially hundreds of items in a performant, filterable, and searchable UI without forcing each app to re-implement pagination, sorting, and details logic. The library supports two view modes (card grid and ag-grid list table), both windowed to the rows in view so a collection of any size keeps a bounded number of DOM nodes, sidebar filters by entity type and topic tags, a favorites section, and a per-item details panel with tabs for API documentation, tool definitions, pricing rows, and usage limits. Use it when an application needs to expose the full DIAL model/tool marketplace or any subset of it, or when building a picker for a specific entity type with consistent UX.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-catalog": "*"
  }
}
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-chat-shared`
- `@tabler/icons-react`
- `ag-grid-community@35.3.0`

## Components

### Catalog

Root component. Manages all state internally (search, filters, view mode, selected item) and renders the toolbar and content area.

`items` and `favorites` are both required — the Browse section and the Favorites
section take separate lists.

```tsx
import { Catalog } from '@epam/ai-dial-catalog';

<Catalog
  items={catalogItems}
  favorites={favoriteItems}
  onToggleFavorite={handleToggleFavorite}
  onUseInChat={handleUseInChat}
/>;
```

Sharing-related details-panel actions are opt-in callbacks — the panel owns the
confirmation step and calls them only once the user confirms:

```tsx
<Catalog
  items={catalogItems}
  favorites={favoriteItems}
  // Owner-side: revokes every recipient's access to an `isMyApp` item.
  // The item stays in the owner's catalog, so the panel stays open.
  onRevokeShare={handleRevokeShare}
  // Resolves the current recipient count when the Manage menu opens. `0`
  // hides "Revoke access"; `undefined` or a rejection leaves it reachable
  // without a count. Omit to offer it for every owned item.
  onFetchRecipientsCount={fetchRecipientsCount}
  // Recipient-side: drops the caller's own access to a `sharedWithMe` item.
  // The item leaves the caller's catalog, so the panel closes.
  onUnshare={handleUnshare}
/>
```

#### Read-only mode

`isReadonly` turns the whole catalog into a pure browsing surface. It is a
single switch — the host does not have to withhold each callback by hand:

- Browse cards drop the favorite star, the footer divider, and the "Featured"
  tag. The footer row goes away entirely for an item with no folder path, since
  the path is the only thing left in it.
- The list view drops its "Favorite" column.
- The "Create" button and the favorites strip are not rendered.
- The details panel withholds its favorite star and every action that mutates
  the item or the caller's relationship to it: Share, Publish, Unpublish, Edit,
  Delete, "Remove from My List", "Revoke access", and the credentials
  Log in / Log out / manage button.

The non-mutating actions stay: the primary "Use in chat" and Download still
render, as do search, sort, filters, tabs, and the details tabs.

```tsx
<Catalog items={catalogItems} favorites={[]} isReadonly />
```

`Card`, `CardGrid`, `ListView`, and `DetailsPanel` each accept `isReadonly`
directly too, for hosts composing their own layout instead of using `Catalog`.

#### Full-width Browse content

By default the Browse content — the card grid and the list view — sits in a
centered column capped at 1180 px, so a wide screen shows empty gutters on both
sides while the title, favorites strip, toolbar, and tabs above it already span
the full width. `isFullWidth` removes that cap:

```tsx
<Catalog items={catalogItems} favorites={favoriteItems} isFullWidth />
```

The 32 px side padding stays either way; only the centered cap goes. Because
the column count is derived from the container's width, the wider container
also yields more card columns (4 instead of 3 once the grid area passes
1280 px).

#### Controlling tabs and Topics options independently of `items`

By default the entity-type tabs and the Topics filter's option list are both
derived from `items` — the same list the grid renders. A host that narrows
`items` for the grid (e.g. filtering by a selected category-tree node) would
otherwise lose a tab, or a Topics option, for any entity type with zero
matches in that narrowed set. Pass `tabs` and/or `topicOptions`, computed from
a wider item set via the exported `buildCatalogTabs`/`getTopicOptions`
helpers, to keep them stable while `items` stays narrowed:

```tsx
import {
  buildCatalogTabs,
  Catalog,
  getTopicOptions,
} from '@epam/ai-dial-catalog';

<Catalog
  items={itemsNarrowedByCategory}
  tabs={buildCatalogTabs(allCatalogItems)}
  topicOptions={getTopicOptions(allCatalogItems)}
  favorites={favoriteItems}
/>;
```

### CardGrid

Virtualized grid view of catalog cards.

```tsx
import { CardGrid } from '@epam/ai-dial-catalog';

<CardGrid
  items={filteredItems}
  query={searchQuery}
  onItemClick={handleItemClick}
  onToggleFavorite={handleToggleFavorite}
  selectedItemId={selectedItemId}
/>;
```

Pass `query` so each card highlights the matched text — the grid forwards it to
`Card`, which renders the match through the shared `Highlight` component.

Set `isFullWidth` when the grid is rendered without the 1180 px content cap. It
only sharpens the column-count guess used for the first paint; the measured
container width always wins afterwards.

### ListView

Table view powered by ag-grid with column sorting and row selection. `type` and
`items` are required.

```tsx
import { ListView } from '@epam/ai-dial-catalog';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';

<ListView
  type={CatalogEntityType.Model}
  items={filteredItems}
  query={searchQuery}
  onItemClick={handleItemClick}
  onToggleFavorite={handleToggleFavorite}
  stickyHeaderTop={headingHeight}
/>;
```

The table scrolls with the page, which switches ag-grid's own row
virtualisation off, so `ListView` windows the rows itself: it hands the grid
only the rows around the viewport and reserves the rest of the table's height
with spacers. Rows are a fixed 60 px for that reason — a `styles.typography`
override that changes a cell's line count would break the reserved height.

Name, Folder and Tags share the spare width (Name takes twice the share of the
other two), so widening the table widens the columns that carry variable-length
values rather than only the name.

The Folder cell shows the deepest folder and keeps the full path in a tooltip
and in the accessible name — a breadcrumb of the whole path collapses into
unreadable per-segment stubs at this width. `styles.typography.folderClassName`
styles that tooltip path, `folderLastSegmentClassName` the folder on screen, and
`styles.colors.folderIcon` the leading folder icon.

### Favorites

Renders the user's favorited items in a dedicated, paginated section.

```tsx
import { Favorites } from '@epam/ai-dial-catalog';

<Favorites
  items={favoriteItems}
  totalCount={totalFavoritesCount}
  onItemClick={handleItemClick}
  onToggleFavorite={handleToggleFavorite}
/>;
```

### FavoriteCard

A single favorite tile, exported for hosts composing their own favorites layout.

### Filter / TopicTag

Filter sidebar and topic label components.

```tsx
import { Filter, TopicTag } from '@epam/ai-dial-catalog';

<Filter filters={activeFilters} onChange={setFilters} />
<TopicTag label="Vision" />
```

For the entity-type badge itself, use `EntityTypeLabel` from
`@epam/ai-dial-chat-shared` — that is where the type enum and its color map live.

```tsx
import { EntityTypeLabel, CatalogEntityType } from '@epam/ai-dial-chat-shared';

<EntityTypeLabel type={CatalogEntityType.Model} />;
```

### InfoCard

Tinted card showing a catalog item's identity, used to anchor a message to the
item it is about. Defaults to the `Info` surface; pass `Danger` for destructive
messaging.

```tsx
import {
  InfoCard,
  DetailsConfirmationVariant,
} from '@epam/ai-dial-catalog';

<InfoCard item={item} />
<InfoCard item={item} variant={DetailsConfirmationVariant.Danger} />
```

## Enums

```tsx
import {
  CatalogSortKey,
  CatalogViewMode,
  CatalogDetailsTab,
  CodeLanguage,
  CredentialsLevel,
  CredentialStatus,
  CredentialsBadgeState,
  CredentialsUiState,
  DeploymentSize,
  DetailsConfirmationKind,
  DetailsConfirmationVariant,
  ToolsetAuthenticationType,
} from '@epam/ai-dial-catalog';

/* CatalogEntityType is owned by @epam/ai-dial-chat-shared, not this lib. */
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';

CatalogEntityType.Model; // 'MODEL'
CatalogEntityType.Agent; // 'AGENT'
CatalogEntityType.Toolset; // 'TOOLSET'
CatalogEntityType.Prompt; // 'PROMPT'
CatalogEntityType.Skill; // 'SKILL'

CatalogViewMode.Grid; // 'grid' — card grid, the `initialViewMode` default
CatalogViewMode.Cards; // 'cards' — list view

CatalogDetailsTab.About; // 'about'
CatalogDetailsTab.Content; // 'content' — long-form text body (prompts)

DetailsConfirmationKind.Delete; // 'delete'
DetailsConfirmationKind.Logout; // 'logout'
DetailsConfirmationKind.Unshare; // 'unshare'
DetailsConfirmationKind.RevokeAccess; // 'revokeAccess'
DetailsConfirmationKind.DeleteApiKey; // 'deleteApiKey'
DetailsConfirmationKind.Unpublish; // 'unpublish'
```

### Details-panel confirmations

Every confirmation replaces the panel's details content in place - there is
no modal. `DetailsConfirmationKind` names the active step, and each kind
resolves its title, copy, consequence bullets, confirm label, loading status
text, and palette from `detailsTexts`.

`Delete`, `RevokeAccess`, and `Unpublish` render with the danger palette;
`Unshare` and `Logout` with the info one. `DeleteApiKey` is the only kind
whose card and button diverge - a danger confirm button above an info
identity card, because removing one credential leaves the item untouched.

`Unpublish` is the only kind that needs an input before it can be confirmed.
It appears in the Manage menu only once the panel has resolved
`getPublishHistory` to at least one folder - and when it does, it takes
`Publish`'s place rather than joining it. The menu carries exactly one of the
two: an item with no published copy offers `Publish`, an item with a published
folder offers `Unpublish`, so publishing an already-published item a second
time means unpublishing it first. Because the history lookup is lazy, the entry
may start as `Publish` and swap once the response lands.

Its body depends on how many folders history resolved to: one folder is named in static copy with confirm enabled
immediately, while several render as a single-select radio group with confirm
disabled until the user picks one. Confirming calls
`onUnpublish(item, folderPath)` with that folder's path segments - the same
`string[]` shape `onPublish` receives. The panel stays open on success:
removal is a request an administrator must approve, so the folder still reads
as published afterwards.

```tsx
<DetailsPanel
  item={item}
  isOpen
  onClose={handleClose}
  getPublishHistory={fetchPublishHistory}
  onUnpublish={async (unpublishedItem, folderPath) => {
    await requestUnpublish(unpublishedItem.id, folderPath.join('/'));
  }}
  isUnpublishVisible={(candidate) => candidate.isMyApp === true}
  texts={{
    unpublishLabel: t('buttons.unpublish'),
    unpublishFolderGroupAriaLabel: t('catalog.unpublishFolderGroupAriaLabel'),
  }}
/>
```

Through `Catalog`, the same two callbacks are `onUnpublish` and
`isUnpublishVisible`, and the texts arrive as `detailsTexts`:

```tsx
<Catalog
  items={items}
  getPublishHistory={fetchPublishHistory}
  onUnpublish={handleUnpublish}
  isUnpublishVisible={(candidate) => candidate.isMyApp === true}
  detailsTexts={{ unpublishLabel: t('buttons.unpublish') }}
/>
```

### Prompt entities

`CatalogEntityType.Prompt` is a display category for reusable text prompts.
Prompt items carry a body rather than a runtime, so the host supplies the text
through `details.promptContent`. The details panel renders it read-only in the
`Content` tab — labelled **Details** by default, overridable through
`detailsTexts.tabContentLabel` — with the item's `description` above it. The
body is selectable text and carries no copy control of its own.

A prompt shows exactly two tabs, `Content` then `Overview`, and never `About`:
its description is already in the Content tab, and its storage metadata belongs
in `overview`, so an About tab would only repeat them. Every other entity type
keeps `About` as its first tab. Omit `promptContent` and the Content tab is
hidden, exactly as with `overview`, `pricing`, `limits`, `api`, and `tools`.

The body is rendered as markdown, and each `{{placeholder}}` token is wrapped in
a `span.cat-prompt-variable` so a template can read apart from its prose.
Placeholders inside fenced code are left alone, since there they are being shown
as literal syntax. The lib colours the class itself, from
`--cat-details-variable-text` with a `--text-prompt-parameter` theme fallback.
Override it through `DetailsPanel`'s `styles.colors.variableText`:

```tsx
<DetailsPanel
  item={promptItem}
  isOpen
  onClose={handleClose}
  styles={{ colors: { variableText: '#7c3aed' } }}
/>
```

Note that `Catalog` forwards only `detailsTexts` to the panel, not styles, so
every `ItemDetailsColors` field — this one included — is reachable only when a
host renders `DetailsPanel` itself.

```tsx
const promptItem: CatalogItem = {
  id: 'Work/AI/summarize',
  type: CatalogEntityType.Prompt,
  name: 'summarize',
  version: '',
  lastUsed: '2 days ago',
  description: 'Summarize a document',
  folder: ['Personal', 'Work', 'AI'],
  topics: [],
  details: {
    promptContent: { content: '## Original\n\n{{original_email}}' },
    overview: {
      sections: [
        { title: 'Prompt', specs: [{ label: 'Folder', value: 'Work / AI' }] },
      ],
    },
  },
};
```

The lib never learns where a prompt comes from: the body arrives already
resolved, and the host decides every prompt-specific action through the
existing `onFetchDetails` / `onEdit` / `onUseInChat` props.

`promptContent.description` is an optional summary that takes precedence over
the item's own `description` when rendering the line above the body. It exists
for hosts whose summary is only known once details resolve — an entity whose
list metadata carries no description can still show one, without the tab row
changing shape mid-interaction.

### Multi-file content

An item whose body is one of several files supplies `promptContent.files` as
a `CatalogContentTreeNode[]` — a folder/file union, folders nesting further
`items` — and the `selectedFileId` the body belongs to. The Content tab then
renders a hierarchical file selector above the body (a `Dropdown` trigger
showing the open file's basename, its overlay a folder/file tree the lib owns
and draws itself), alongside a file count. **The selector appears only when
the tree contains two or more file nodes, at any depth** — a single file,
however deep it sits, is the body itself, so a selector with one option is
noise.

Every node's `id` is opaque to the lib: a file's `id` round-trips to
`onLoadContentFile` unchanged, and a folder's `id` only keys the selector's
own expand/collapse state. Two files may share a `name` as long as they sit
under different parents — only `id` needs to be unique among a node's
siblings' descendants.

Picking a file calls `onLoadContentFile` with that file's `id` verbatim — the
lib never parses it — and renders whatever text it resolves as Markdown.
Reselecting the file named by `selectedFileId` restores the original `content`
without a request. A rejection, or a resolved `undefined`, renders
`texts.contentFileErrorLabel`. The picked file, the expanded folders, and the
selector's open state are all dropped whenever the panel switches item or the
body is re-fetched.

```tsx
<DetailsPanel
  item={{
    ...skillItem,
    details: {
      promptContent: {
        content: '# Instructions',
        selectedFileId: 'SKILL.md',
        files: [
          {
            type: CatalogContentNodeType.File,
            id: 'SKILL.md',
            name: 'SKILL.md',
          },
          {
            type: CatalogContentNodeType.Folder,
            id: 'scripts',
            name: 'scripts',
            items: [
              {
                type: CatalogContentNodeType.File,
                id: 'scripts/run.py',
                name: 'run.py',
              },
            ],
          },
        ],
      },
    },
  }}
  isOpen
  onClose={handleClose}
  onLoadContentFile={handleLoadContentFile}
  texts={{ contentFileCountLabel: (count) => `${count} files` }}
/>
```

#### Typed previews

For hosts that already own a complete file-preview surface,
`renderContentFilePreview(fileId, fileName)` supplies that surface directly.
It takes precedence over both loading callbacks. The catalog still owns the
tree and selection, and exposes only the opaque id plus the tree node's
basename; fetching, MIME handling, state, and rendering remain host-owned.

```tsx
<DetailsPanel
  item={skillItem}
  isOpen
  onClose={handleClose}
  renderContentFilePreview={(fileId, fileName) => (
    <HostFilePreview fileId={fileId} fileName={fileName} />
  )}
/>
```

`onLoadContentFilePreview` is an additive, richer alternative to
`onLoadContentFile`: instead of a plain string always rendered as Markdown, it
resolves a `CatalogContentFilePreview` — `{ type: 'markdown', text }`,
`{ type: 'text', text, language? }` (rendered read-only with syntax
highlighting), `{ type: 'image', url }`, or `{ type: 'unsupported' }`. When
both callbacks are supplied, `onLoadContentFilePreview` takes precedence for
every pick and `onLoadContentFile` is not called. The lib never fetches,
classifies, or decodes bytes itself — it only renders the shape it is handed.

An `image` preview's `url` may be a `blob:` URL the host created for that
call; the panel revokes it (and only a `blob:` URL, never a host-supplied
permanent one) when a different file or item is displayed, and on unmount.

```tsx
<DetailsPanel
  item={skillItem}
  isOpen
  onClose={handleClose}
  onLoadContentFilePreview={handleLoadContentFilePreview}
/>
```

### Download

`onDownload` is the item's download action. Where it renders depends on
`isDownloadPrimary`:

- **Manage-menu entry (default for every type but `Skill`).** The call is
  fire-and-forget: the panel does not await the result or show a pending
  state, so failures are the host's to surface.
- **Primary action (default for `CatalogEntityType.Skill`).** Rendered in the
  same prominent slot as "Use in chat", never duplicated in the Manage menu.
  The panel awaits the call, disables the button and marks it `aria-busy`
  while pending, ignores a second click while one is already in flight, and
  announces progress through an `aria-live` region. The pending state clears
  whether the call resolves or rejects; failures are still the host's to
  surface.

Scope visibility with `isDownloadVisible`, which defaults to **visible for
every item** whenever `onDownload` is supplied. Scope placement with
`isDownloadPrimary`, which defaults to `item.type === CatalogEntityType.Skill`.

```tsx
<Catalog
  items={items}
  favorites={favorites}
  // Prompts and skills both carry a downloadable body.
  isDownloadVisible={(item) =>
    item.type === CatalogEntityType.Prompt ||
    item.type === CatalogEntityType.Skill
  }
  // Only skills get the prominent, primary-slot placement — this is already
  // the default and is shown here only for clarity.
  isDownloadPrimary={(item) => item.type === CatalogEntityType.Skill}
  onDownload={handleDownload}
/>
```

### Declaring unsupported per-item capabilities

`isUnshareVisible`, `isRevokeShareVisible`, and `isUnpublishVisible` let a host
hide the recipient-side "Remove from My List", the owner-side "Revoke access",
and "Unpublish" for items whose backing capability does not exist, without the
lib knowing why. All three default to **visible** when omitted.

`isFavoriteVisible` is the same family for the favorite star: returning `false`
for an item hides the star in the browse grid, the list view, the favorites
strip, and the details panel, and makes that item non-favoritable. It defaults
to **visible** when omitted, so a predicate can only narrow visibility.

```tsx
<Catalog
  items={items}
  favorites={favorites}
  // Hide both on prompts — the host's API rejects prompt paths.
  isUnshareVisible={(item) => item.type !== CatalogEntityType.Prompt}
  isRevokeShareVisible={(item) => item.type !== CatalogEntityType.Prompt}
  isUnpublishVisible={(item) => item.type !== CatalogEntityType.Prompt}
  // Models are platform-managed, not user-owned apps — suppress the star.
  isFavoriteVisible={(item) => item.type !== CatalogEntityType.Model}
  onUnshare={handleUnshare}
  onRevokeShare={handleRevokeShare}
  onUnpublish={handleUnpublish}
/>
```

Each is combined (AND) with its built-in rule — `sharedWithMe`/`isMyApp` for
unshare, `isMyApp` plus the recipient count resolved by
`onFetchRecipientsCount` for revoke, and at least one resolved
`getPublishHistory` folder for unpublish — so a predicate can only ever narrow
visibility, never widen it. `isFavoriteVisible` has no built-in rule beyond
"visible by default", so it gates the star on its own.

## Types

```tsx
import type {
  CatalogItem,
  ApiResource,
  CatalogItemApiDetails,
  CatalogItemPromptContent,
  ToolDefinition,
  PricingRow,
  UsageLimitRow,
} from '@epam/ai-dial-catalog';
```

## Utilities

```tsx
import {
  buildCatalogTabs,
  filterCatalogItems,
  getTopicOptions,
  sortCatalogItems,
} from '@epam/ai-dial-catalog';

/*
 * Matches an item's `name`, `description`, or `type` — case-insensitive.
 * Note that a prompt's body is not searched: `details.promptContent` is
 * resolved lazily and is not part of the search index.
 */
const filtered = filterCatalogItems(items, 'gpt');
const sorted = sortCatalogItems(filtered, CatalogSortKey.NameAZ);

/*
 * Derives the entity-type tabs / Topics filter options that `Catalog` would
 * compute internally from `items`. Use these to feed `Catalog`'s `tabs` /
 * `topicOptions` props from a wider item set — see "Controlling tabs and
 * Topics options independently of `items`" above.
 */
const tabs = buildCatalogTabs(items);
const topicOptions = getTopicOptions(items);
```
