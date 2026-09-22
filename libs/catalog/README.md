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

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-catalog/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-ui-kit` ^0.15.0-dev.9 (requires the public `/grid` entry)
- `@epam/ai-dial-chat-shared`

`ag-grid-community` and `@epam/ai-dial-publish-panel` are normal package
dependencies and install transitively; they are not host peers.

Both `@epam/ai-dial-chat-shared` and `@epam/ai-dial-publish-panel` are kept
external by the library build — a consumer's own bundler resolves them, so
installing both is required rather than optional.

## Entry points

`@epam/ai-dial-catalog` publishes a `./mapping` subpath alongside the root
(`.`) entry: `CredentialsLevel`, `CredentialsBadgeState`, `CredentialStatus`,
`CredentialsUiState`, `ToolsetAuthenticationType`, `CatalogSortKey`,
`CatalogItem`, `CatalogItemCredentials`, `filterCatalogItems`,
`getTopicOptions`, `sortCatalogItems`, `buildCatalogTabs`,
`getCredentialsBadgeState`, `getCredentialsUiState`, and `getSignedInLevel` —
the headless enums and pure item-mapping functions a host can use (e.g. to
sort/filter/tab a catalog item list, or read a toolset's credential state)
without resolving `@epam/ai-dial-publish-panel`, `@epam/ai-dial-react-file-manager`,
or any catalog editor/publish UI:

```tsx
import {
  CredentialsLevel,
  filterCatalogItems,
} from '@epam/ai-dial-catalog/mapping';
```

The root entry keeps re-exporting every one of these names for backward
compatibility — importing them from `@epam/ai-dial-catalog` directly still
works exactly as before, and (unlike a monolithic pre-bundled root) a
production bundler tree-shakes a root import of only these mapping names down
to the same graph `./mapping` produces, since `package.json#sideEffects` marks
every JS module side-effect free; importing `Catalog` from the root still
pulls in the full publish/editor UI as before.

## Components

### DeploymentSelectorField

`DeploymentSelectorField` is a controlled, provider-free deployment picker
for hosts that already resolved their display records. It does not fetch,
persist favorites, open a catalog modal, or mutate a conversation. Supply
those behaviours through callbacks or `renderOverlay` / `renderPanel` slots.

```tsx
import { DeploymentSelectorField } from '@epam/ai-dial-catalog';

<DeploymentSelectorField
  selectedId={selectedId}
  records={[{ id: 'model-a', label: 'Model A' }]}
  placeholder="Choose a model"
  labels={{
    searchPlaceholder: 'Search models',
    searchAriaLabel: 'Search models',
    emptyLabel: 'No models',
    errorLabel: 'Could not load models',
    browseLabel: 'Browse',
  }}
  labelledById="model-label"
  onSelect={setSelectedId}
  onBrowse={openCatalog}
/>;
```

Omit `open` for local popup state, or provide `open` and `onOpenChange` for a
controlled overlay. Enter, Space, and pointer activation open the picker;
selection and Escape close it, restoring focus to the combobox. Result labels
use the UI Kit `Highlight` component for the current search query.

The list view imports Grid through `@epam/ai-dial-ui-kit/grid`. Library builds
keep UI Kit root and subpath imports external. JavaScript is tree-shakeable;
CSS/SCSS imports remain side effects. Load catalog UI through a host lazy boundary.

### Catalog

The card view renders first by default. Once data is available, `Catalog`
prepares the hidden list table during browser idle time using a React
transition (with a short timer fallback when idle callbacks are unavailable).
The first list-view click then reuses that instance. Clicking before preparation
finishes opens the list immediately; it does not wait for the idle callback.
Hidden views are inert, and pending preparation is cancelled when loading
resumes, results become empty, or the catalog unmounts.
During preparation the table keeps its real width inside an invisible,
zero-height wrapper, so AG Grid can lay out its columns without extending the
page. After the first visit, the inactive table uses `display: none`.

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

The entity-type tab row appears only when `items` span **two or more** types: a
single tab is not a choice, so a catalog restricted to one entity type (an
agent picker, a prompt picker) renders no tab row at all. The active tab still
resolves to that one type, so the grid is unaffected.

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

#### Overriding the Browse heading

By default the Browse section's heading is the plain text label
`titles.browseTitle` (default `'Browse'`) rendered next to the item count. Pass
`browseHeaderRenderer` to replace that whole slot with any node — e.g. a clickable
breadcrumb — instead. When supplied, the item count is not rendered alongside
it, so include it in the node if needed; the host owns click handling and
visual composition entirely, since the lib has no notion of the underlying
navigation (a category tree, etc.).

```tsx
<Catalog
  items={itemsNarrowedByCategory}
  favorites={favoriteItems}
  browseHeaderRenderer={
    <Breadcrumb segments={selectedPath} onSegmentClick={handleJumpToSegment} />
  }
/>
```

#### Custom empty state

By default, the Browse section renders a `PanelEmptyState` (an icon plus
`titles.noResultsTitle`) when the current search/filter/tab combination
matches nothing. Pass `renderEmptyState` to replace it with any node — e.g. a
richer illustration, description, and a scoped "Create" call to action:

```tsx
import { Catalog, type CatalogEmptyStateContext } from '@epam/ai-dial-catalog';

<Catalog
  items={catalogItems}
  favorites={favoriteItems}
  renderEmptyState={({
    query,
    activeTab,
    hasTopicFilters,
    isMyAppsActive,
  }: CatalogEmptyStateContext) =>
    query ? (
      <NoResultsIllustration query={query} />
    ) : (
      <EmptyCollectionIllustration
        activeTab={activeTab}
        isMyAppsActive={isMyAppsActive}
        hasTopicFilters={hasTopicFilters}
      />
    )
  }
/>;
```

`renderEmptyState` is called only once the result set that would otherwise be
handed to the active view (Grid or List) is actually empty — never while
`isLoading` is `true`, and never while there are items to show — and it
replaces both views' default empty state in the one content area they share,
so only one instance of the returned node is ever mounted regardless of the
current view mode. The context reflects `Catalog`'s live, resolved state,
whether each field is managed internally or via the corresponding controlled
prop (`activeTab`, `filterTopics`, `isMyAppsActive`). Returning `null` or
`undefined` — or omitting the prop entirely — keeps the default empty state,
including `titles.noResultsTitle`. Like `titles.noResultsTitle`, the callback
runs on every render while the result set stays empty (e.g. on every
keystroke of a query that keeps matching nothing), so keep it cheap.

This prop only exists on `Catalog` — `CardGrid` and `ListView` keep their own
built-in default empty state and gain no new prop, so a host composing its
own layout from those exported components directly does not get the custom
empty state for free.

### CardGrid

Virtualized grid view of catalog cards. Switching views preserves the hidden
grid's measured layout and mounted cards. Hidden views ignore scroll/resize
measurements until they become visible; unchanged visible rows are reused.

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

### Card

Single catalog item card, exported for hosts composing their own grid or list.

```tsx
import { Card } from '@epam/ai-dial-catalog';

<Card
  item={item}
  query={searchQuery}
  onClick={handleItemClick}
  onToggle={handleToggleFavorite}
  initialIsStarred={isFavorited}
/>;
```

The card's `description` is rendered as sanitized Markdown using the same rendering pipeline as the About tab's details view (sanitization via `rehypeSanitize`). Markdown syntax (e.g. `**bold**`, lists, links), HTML-like snippets, and plain text all render correctly. Inline images are suppressed to keep the description within the card's fixed 2-line clamp; they appear normally in the About tab. Links render as real `<a>` elements and activate independently without triggering the card's own `onClick` handler; clicks on other description content still open the card details.

The "Featured" chip's colors follow the item's entity type by default. Override
it for every entity type with `styles.colors.featuredChipStyle` (merged over
the chip's own style, e.g. `{ backgroundColor, color, border }`); `Catalog`
forwards its own `styles.colors.featuredChipStyle` to both the browse-grid card
and the details-panel header.

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
Window changes render without row movement/fade animations or deferred cell
drawing, and keep the column configuration stable while scrolling.

Name, Folder and Tags share the spare width (Name takes twice the share of the
other two), so widening the table widens the columns that carry variable-length
values rather than only the name.

Edge padding follows AG Grid's first/last displayed-column markers, including
when switching tabs restores hidden columns. The Favorite header and star
button share the same end inset; the star renderer fills the cell width.

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

### DetailsPanel

The right-anchored details panel `Catalog` opens internally, exported for
hosts composing it into other surfaces (e.g. a chat route's skill details side
panel). Only `item`, `isOpen`, and `onClose` are required; every action is
opt-in and hidden when its prop is absent, and mounting it never mounts the
catalog page chrome — the host owns the item, the details fetch, and the
action handlers. Skills open on the content-first tab; prompts and deployments
open on their usual first tab.

```tsx
import { DetailsPanel } from '@epam/ai-dial-catalog';
import type { CatalogItem } from '@epam/ai-dial-catalog';

<DetailsPanel
  item={item}
  isOpen={isDetailsOpen}
  onClose={closeDetails}
  isStarred={item.isUserFavorite}
  onToggleFavorite={(id, isStarred) => toggleFavorite(id, isStarred)}
  onUseInChat={(item: CatalogItem) => attachToChat(item)}
  texts={{ primaryActionLabel: 'Use in chat' }}
/>;
```

See `DetailsPanelProps` (and its `texts` / `styles` overrides) in the Types
section below; a skills-scoped wrapper lives in `@epam/ai-dial-skills`.

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

Supplying `isUnpublishVisible` does one more thing: for an item it returns
`true` for, the Manage trigger renders while the history lookup is still
outstanding, even when that leaves the menu momentarily empty. Without this an
item whose only entry would be `Unpublish` could never show one, because the
lookup that produces it is started by hovering, focusing or opening that same
trigger. A host that supplies no rule keeps the plain "hidden while empty"
behaviour.

Its body depends on how many folders history resolved to: one folder is named in static copy with confirm enabled
immediately, while several render as a single-select radio group with confirm
disabled until the user picks one. Confirming calls
`onUnpublish(item, folderPath)` with that folder's path segments - the same
`string[]` shape `onPublish` receives. The panel stays open on success:
removal is a request an administrator must approve, so the folder still reads
as published afterwards.

`onPublish(item, folderPath, rules, author, publishCredentials)` receives the
publication's display author as its fourth argument — the value the publish
panel's Author field holds, already trimmed. Seed that field with
`publishDefaultAuthor`: the library has no access to the signed-in user, so
the host resolves its own display name and passes it in. An empty `author` is
a valid state that never blocks submit; what it means is the host's decision
(`apps/chat` omits the field from the request so the backend attributes the
publication to the caller's own session name).

The fifth argument is the credentials opt-in. The panel renders that checkbox
only for a `Toolset` whose `credentials.authenticationType` is set and is not
`ToolsetAuthenticationType.None`, and whose `credentials.userStatus` or
`credentials.globalStatus` is `CredentialStatus.SignedIn` — access the
publisher does not hold cannot be passed on. No host prop controls this; the
decision is derived from the item the panel already has, and there is no role
gate. For every other item the argument is always `false`. It is cleared on
every open, including immediately after a publication that carried it.

Its copy travels through the existing `publishLabels` prop as
`credentialsLabel` and `credentialsHint`.

`historySharedCredentialsLabel` travels the same way, for the marker
`PublishHistoryList` puts on a past publication that carried shared
credentials — but **it has no visible effect today**: `PublishPanel` keeps its
versions-history section behind a `TODO`, so the marker (like
`historyLoadingLabel` and `historyErrorLabel` beside it) only appears once
that section is re-enabled. The data path is wired and unit-tested; supplying
the label now simply means nothing else has to change then.

```tsx
<DetailsPanel
  item={toolset}
  isOpen
  onClose={handleClose}
  onPublish={async (item, folderPath, rules, author, publishCredentials) => {
    await publishEntity(item, {
      folderPath,
      rules,
      author,
      publishCredentials,
    });
  }}
  publishLabels={{
    credentialsLabel: t('catalog.publish.credentialsLabel'),
    credentialsHint: t('catalog.publish.credentialsHint'),
    historySharedCredentialsLabel: t(
      'catalog.publish.historySharedCredentials',
    ),
  }}
/>
```

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

Note that `Catalog` forwards only `detailsTexts` and `styles.colors.featuredChipStyle`
to the panel — every other `ItemDetailsColors` field, this one included, is
reachable only when a host renders `DetailsPanel` itself.

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
to **visible** when omitted, so a predicate can only narrow visibility. It
only ever gates the star on individual rows — it has no effect on whether the
list view's "Favorite" column itself is shown; see `columnVisibility` below
for that.

### Overriding which list-view columns show per tab

The list view's optional columns — `folder`, `tags`, and `favorite` — each
have a built-in default rule (`folder` hides for `CatalogEntityType.Model`;
`tags` and `favorite` are always shown). `columnVisibility` replaces any of
these per column, given the active tab's `type`; columns left out of the map
keep their default. `favorite`'s resolved visibility is additionally combined
(AND) with `isReadonly`.

```tsx
<Catalog
  items={items}
  favorites={favorites}
  // The star itself is still gated per-row by isFavoriteVisible — this only
  // decides whether the list view's "Favorite" column exists at all.
  columnVisibility={{
    favorite: (type) => type !== CatalogEntityType.Model,
    // Also drop Tags for Skills — this app's skills carry no topics.
    tags: (type) => type !== CatalogEntityType.Skill,
  }}
/>
```

This only affects the list view's table — the Browse grid's cards are
unaffected, since they don't render these as columns.

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
  DetailsPanelProps,
  ItemDetailsStyles,
  ItemDetailsTexts,
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
 * Matches an item's `name` only — case-insensitive, whitespace-trimmed. An
 * item's `description`, `type`, and a prompt's body are not searched: the name
 * is the only text the card and list row highlight.
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

## Rollback

`catalog` is published by `tools/publish-lib.mjs`, which reads the version from this package's
`package.json` and writes it into `dist/package.json` before `npm publish`. To roll a consuming
host back to a previous `@epam/ai-dial-catalog` release:

1. Pin the host's dependency back to the previous version (e.g.
   `"@epam/ai-dial-catalog": "1.1.0-dev.410"` instead of `"1.1.0-dev.412"`).
2. `catalog` declares `@epam/ai-dial-chat-shared` and `@epam/ai-dial-publish-panel` as peers
   and is published from the same repository revision as both — revert those packages to their
   own matching previous versions in the same host update, rather than leaving a newer sibling
   installed against an older `catalog` (or vice versa).
3. Reinstall (`npm install`) so the host's lockfile records every reverted package's previous
   resolved version and integrity hash, rather than a partial mix of pre- and post-change
   versions.

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. A card's
`aria-label` is the item's own name, so it was never usable as a selector
either. Five elements carry a stable public class:

| Key            | Class                        | Element                                                              |
| -------------- | ---------------------------- | -------------------------------------------------------------------- |
| `root`         | `dial-catalog-root`          | The catalog's `section` root, which carries the themed CSS variables |
| `toolbar`      | `dial-catalog-toolbar`       | The toolbar above the results: title row, search, sort, view toggle  |
| `card`         | `dial-catalog-card`          | One grid card, in every state — featured and selected are additive   |
| `favoriteCard` | `dial-catalog-favorite-card` | One favorites card                                                   |
| `listView`     | `dial-catalog-list-view`     | The list view's root: the bordered row box, or its empty state       |

```tsx
import { CATALOG_CLASS } from '@epam/ai-dial-catalog';

CATALOG_CLASS.card; // 'dial-catalog-card'
```

```css
.dial-catalog-card {
  border-radius: 12px;
}

/* Everything inside a card is reached by descending from it. */
.dial-catalog-card .dial-kit-tag {
  text-transform: none;
}
```

Both card kinds are a `CardShell` from
[`@epam/ai-dial-ui-kit`](https://www.npmjs.com/package/@epam/ai-dial-ui-kit), so
`dial-kit-card-shell` is on the same element — these classes are what tell a
catalog card apart from any other card in the same host.

### What has no class, and why

The set is the catalog's layout skeleton, not one class per component. Card
internals — the icon, the name, the topic tags, the featured chip — are reached
by descending from the card's class, which keeps the contract small enough to
stay accurate as the catalog's internals change.

The virtualised grid box inside `CardGrid` is left out on purpose: its height is
recomputed every scroll frame, so a host styling it would be fighting the
virtualizer rather than the design.

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.

### ApplicationCredentials

`ApplicationCredentials` renders application service credentials with the same
`CredentialsRow`, identity/status icon and configured-key card used by toolset
credentials management. It owns only form drafts, pending state, validation,
offline-use checkbox state and removal confirmation. The host supplies normalized
`ApplicationCredential[]`, localized `ApplicationCredentialsTexts`, and callbacks.
It imports no API client, application DTO, i18n, routing, or authentication provider.

```tsx
import {
  ApplicationCredentials,
  CredentialStatus,
  ToolsetAuthenticationType,
} from '@epam/ai-dial-catalog';

<ApplicationCredentials
  services={[
    {
      id: 'finance',
      name: 'Finance',
      authenticationType: ToolsetAuthenticationType.ApiKey,
      status: CredentialStatus.SignedOut,
      canLogout: true,
      canConsentToOfflineUsage: true,
    },
  ]}
  onRetry={reloadCredentials}
  onLogin={async (serviceId, { apiKey, offlineUsageConsent }) => {
    const success = await login(serviceId, { apiKey, offlineUsageConsent });
    if (success) await reloadCredentials();
    return success;
  }}
  onLogout={async (serviceId) => {
    await logout(serviceId);
    await reloadCredentials();
  }}
/>;
```

The callback names in the example are host implementations. `onLogin` resolves
`true` on success or `false` on cancellation; a rejection displays its user-facing
error message and keeps the draft. `onLogout` runs only after confirmation.
`canLogout` and `canConsentToOfflineUsage` default to false; a host can represent a
non-removable redirect-based connection without exposing provider details. A
`hasSharedCredentials` banner is informational. Status changes belong to the host:
callbacks refresh and supply new service data. Key the component by application
identity to reset drafts when switching applications.

`isLoading` and `hasError` expose metadata loading/retry states. With no services,
the default is no content; `showEmptyState` enables an explicit empty message.
`ApplicationCredentialLoginParams` and `ApplicationCredentialsProps` are exported
alongside the service and text models. Text overrides use English defaults and the
same credentials CSS variables as the toolset rows.

`Catalog` and `DetailsPanel` accept `renderCredentials?: (item: CatalogItem) => ReactNode`.
The slot appears below the item header in the open, editable, normal details view.
A host adapter can render `ApplicationCredentials` here and reuse it in another
surface. The host decides which items qualify and supplies API/authentication
behavior and translations; `useApplicationCredentials` from
`@epam/ai-dial-chat-hooks` can own metadata loading with host-configured clients.
Existing toolset `onLogin` / `onLogout` contracts are unchanged.

The public `DeploymentSelectorField` restores focus through the input's
supported `onFocus` event and never requires a private input ref or DOM query.
Its keyboard and Browse behavior is exercised by the packed scheduler consumer.
