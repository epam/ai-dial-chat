# @epam/ai-dial-skills

Host-agnostic UI for picking a favorite skill to attach to a chat composer.

The lib knows nothing about where skills come from or what a selected skill
means at send time. `FavoriteSkillsPanel` renders a plain list of
`FavoriteSkillItem` objects the host has already resolved (from its own
skills/favorites data), and hands every interaction back through callbacks —
it never fetches, navigates, or modifies the composer itself.

`useSkillSelectorOverlay` owns the selection flow's state — the favorites
overlay, the browse-modal and details-panel open state, the per-session
description cache, and the single selected skill — while the host injects the
listing data, the favorites state, the description fetch, labels, the browse
modal's picker content, and the app-owned details-panel component. The
send-time semantics of a selected skill stay app-owned.

`SkillDetailsSidePanel` composes `@epam/ai-dial-catalog`'s exported
`DetailsPanel` into a right-anchored skill details panel. It adds no chrome of
its own: the host supplies the `CatalogItem`, the details data, and every
action.

`ChatSkill` renders a single used skill — a `/name` ghost button whose
interactive tooltip shows the skill's description and a "View details" action —
identically wherever a skill appears: inside the conversation input and in the
conversation history. Its tooltip content is the same `SkillInfoTooltipContent`
the favorite rows render, so the skill's panel is visually one thing everywhere.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-skills": "*"
  }
}
```

## Peer Dependencies

- `react` `^19.0.0`
- `@epam/ai-dial-ui-kit` `^0.14.0-dev.37`
- `@epam/ai-dial-chat-shared` `*`
- `@epam/ai-dial-catalog` `*`
- `@epam/ai-dial-conversation-input` `*`
- `@tabler/icons-react` `^3.0.0`

## Components

### `ChatSkill`

```tsx
import { ChatSkill } from '@epam/ai-dial-skills';

<ChatSkill
  name="my-skill"
  path="skills/public/my-skill"
  description={resolvedDescription}
  isDescriptionLoading={isFetchingDescription}
  onTooltipOpen={(path) => resolveDescription(path)}
  onViewDetails={(path) => openDetailsPanel(path)}
  onRemove={clearSelection}
/>;
```

Renders one used skill: a ui-kit `GhostButton` whose visible (and accessible)
label is `/` followed by `name`, wrapped in the ui-kit `InteractiveTooltip`
(`asChild`, uncontrolled, 550px max panel width, kit-default Right placement).
The tooltip's content is the shared `SkillInfoTooltipContent` — the description
paragraph (spinner while `isDescriptionLoading` is `true`, omitted when empty)
above the "View details" link button — so the panel matches the favorite rows
exactly. Activating the button body does nothing beyond opening the tooltip; on
a touch-only device the tooltip renders nothing and the button stays
presentation-only.

`onTooltipOpen` fires with the skill's `path` each time the tooltip opens
(hover or focus) — the host's lazy-description trigger wherever the component
renders. `onViewDetails` receives the `path` when the tooltip's "View details"
button is clicked. The × remove control renders only when `onRemove` is
supplied, with its accessible name from `removeLabel` (which defaults to
"Remove {name}"); pass a function that builds a localized label.

### `FavoriteSkillsPanel`

```tsx
import { FavoriteSkillsPanel } from '@epam/ai-dial-skills';
import type { FavoriteSkillItem } from '@epam/ai-dial-skills';

<FavoriteSkillsPanel
  favorites={favoriteSkills}
  onSelect={(item: FavoriteSkillItem) => handleSkillPicked(item)}
  onToggleFavorite={(id) => unfavoriteSkill(id)}
  onBrowse={openBrowseModal}
  onViewDetails={(item: FavoriteSkillItem) => openDetailsPanel(item.id)}
  onItemTooltipOpen={(id) => resolveDescription(id)}
  labels={{ myCollectionLabel: t('input.addMenu.skills.myCollection') }}
/>;
```

Renders the header, the favorite rows (initials icon, name, filled star), and
the "Browse" button. When `favorites` is empty, the list area is replaced with
an empty-state hint; the header and "Browse" button still render.

Each row is wrapped in the ui-kit `InteractiveTooltip` (`asChild`, so the row
stays the focus and click target). The tooltip is uncontrolled: the kit opens
it on hover or keyboard focus and keeps it open while the pointer is on the
row or the panel — including while it travels between them; on a touch-only
device it renders nothing and the row still selects on tap. Its content is the
skill's `description` (rendered only when non-empty — the host resolves it
lazily and may never) above a link-style "View details" button whose label
comes from `labels.viewDetailsLabel`. While `isDescriptionLoading` is `true`,
a spinner renders in the description's place; the "View details" button is
reachable in every description state. The panel content itself is rendered by
the shared `SkillInfoTooltipContent` component (below), so a `ChatSkill`
element shows the exact same panel.

`onItemTooltipOpen` fires with the skill's id each time a row's tooltip opens
(hover or focus); the host uses it to fetch the skill's manifest description
once per session. `onViewDetails` fires when the tooltip's "View details"
button is clicked.

Clicking a row's star plays a short exit animation first, so
`onToggleFavorite` fires ~180 ms after the click rather than synchronously.
The list's height animates to match once the row is gone.

### `SkillInfoTooltipContent`

```tsx
import { SkillInfoTooltipContent } from '@epam/ai-dial-skills';

<SkillInfoTooltipContent
  description="Summarizes long documents into bullet points."
  viewDetailsLabel="View details"
  onViewDetails={() => openDetailsPanel(skill.url)}
/>;
```

The inner content of a skill's interactive tooltip, shared by
`FavoriteSkillsPanel`'s rows and `ChatSkill`: the skill's `description`
paragraph (a `Spinner` while `isDescriptionLoading` is `true`, omitted
entirely when the description is empty or unresolved) above a link-style
"View details" button (`IconEye` on its inline-start, label from
`viewDetailsLabel`). The "View details" button is reachable in every
description state — loading, resolved, or absent.

### `SkillDetailsSidePanel`

```tsx
import { SkillDetailsSidePanel } from '@epam/ai-dial-skills';
import type { CatalogItem } from '@epam/ai-dial-catalog';

<SkillDetailsSidePanel
  item={skillCatalogItem}
  isOpen={isPanelOpen}
  isStarred={isFavorite}
  isDetailsLoading={isFetching}
  onClose={closePanel}
  onToggleFavorite={(id, isStarred) => toggleFavorite(id, isStarred)}
  onUseInChat={(item: CatalogItem) => attachSkill(item.id)}
  isPrimaryActionVisible={() => true}
  renderContentFilePreview={(fileId, fileName) => (
    <FilePreview fileId={fileId} fileName={fileName} />
  )}
  texts={{ primaryActionLabel: 'Use in chat' }}
/>;
```

A thin wrapper over `@epam/ai-dial-catalog`'s `DetailsPanel` narrowed to the
actions a skill details surface offers: favorite toggle, close, "Use in chat",
and content-file previews. Skills open on the content-first tab exactly as
they do on the Catalog page. Publish, share, credentials, and download props
are deliberately absent — `DetailsPanel` hides those actions when they are not
supplied, so no catalog page chrome comes along. The host owns the open state
and the details fetch; the panel itself never fetches.

### `SkillCatalogModal`

```tsx
import { SkillCatalogModal } from '@epam/ai-dial-skills';

<SkillCatalogModal
  isOpen={isCatalogOpen}
  onClose={closeCatalog}
  onSelect={(id) => handleSkillPicked(id)}
  title="Use skill"
  renderContent={(onSelect, onClose) => (
    <CatalogView onSelect={onSelect} onClose={onClose} />
  )}
/>;
```

The "Use skill" browse-modal shell: a large ui-kit `Popup` whose body hosts
host-rendered picker content. The content is mounted only while the modal is
open, wrapped in a `Suspense` with a `null` fallback, so a lazily loaded
picker (e.g. a catalog view chunk) loads in place on first open. The shell
never selects or navigates itself — it hands `onSelect` and `onClose` to
`renderContent` and forwards a selection to `onSelect`.

## Hooks

### `useSkillSelectorOverlay`

```tsx
import {
  useSkillSelectorOverlay,
  type UseSkillSelectorOverlayResult,
} from '@epam/ai-dial-skills';

const CatalogView = lazy(() => import('./CatalogView'));
const SkillDetailsPanel = lazy(() => import('./SkillDetailsPanel'));

const {
  skillMenuOverlay,
  skillCatalogModal,
  skillDetailsPanel,
  selectedSkillElement,
  selectSkill,
}: UseSkillSelectorOverlayResult = useSkillSelectorOverlay({
  isEnabled: isSkillUsageEnabled,
  skills,
  sharedWithMe,
  publicSkills,
  favoriteIds,
  onToggleFavorite: (id) => unfavoriteSkill(id),
  fetchSkillDescription: (skillId) => fetchManifestDescription(skillId),
  labels: {
    addMenuLabel: 'Skills',
    backLabel: 'Back',
    removeSkillLabel: (name) => `Remove ${name}`,
  },
  renderCatalogContent: (onSelect, onClose) => (
    <CatalogView onSelect={onSelect} onClose={onClose} />
  ),
  detailsPanelComponent: SkillDetailsPanel,
});
```

Owns the Skills Add-menu flow's state. `skillMenuOverlay` is the entry for
the `menuOverlays` prop of `ConversationInput`/`Input` (`undefined` while
`isEnabled` is `false`, so the host omits the menu item entirely); the hook
renders `FavoriteSkillsPanel` as its overlay content, forwarding
`labels.panelLabels`. `skillCatalogModal` renders the lib's `SkillCatalogModal`
shell with `labels.catalogModalTitleLabel` as its title and
`renderCatalogContent` as its body — both elements the host renders at a
stable level outside the popover. `skillDetailsPanel` renders the injected
`detailsPanelComponent` (wrapped in `Suspense`, so a lazily loaded component
is fine); the open state of the modal and the panel, and the wiring of "View
details" and "Use in chat" back to selection, are the hook's.
`selectedSkillElement` is the selected skill as a `ChatSkill` element for the
conversation input's `inlineStartSlot` — at most one, replaced on every
selection, with the shared tooltip (and the same lazy description fetch as
the rows) and a × that clears the selection — and `selectSkill` selects by
resource URL (`skills/{bucket}/{path}`).

Row descriptions are resolved lazily: the first time a row's tooltip opens,
`fetchSkillDescription` runs for that skill, and the result (including a
`null` for "no description") is cached for the session; a fetch already in
flight is never re-triggered.

## Utilities

### `buildFavoriteSkillItem`

```tsx
import { buildFavoriteSkillItem } from '@epam/ai-dial-skills';
import type { FavoriteSkillItem } from '@epam/ai-dial-skills';

const favorites: FavoriteSkillItem[] = listedSkills
  .filter((skill) => favoriteIds.has(skill.url))
  .map((skill) =>
    buildFavoriteSkillItem(skill, descriptions, pendingDescriptionIds),
  );
```

Builds a `FavoriteSkillItem` from a listing entry and the host's resolved
description cache. The entry needs only `{ url, name }` — the host's skill
listing DTO satisfies it directly. A cached `null` (no description or a
failed fetch) and a not-yet-fetched id both produce no description
paragraph; ids in the pending set mark the row as loading, so its tooltip
shows a spinner.

## Types

```tsx
import type {
  ChatSkillLabels,
  ChatSkillProps,
  FavoriteSkillItem,
  FavoriteSkillsPanelColors,
  FavoriteSkillsPanelLabels,
  FavoriteSkillsPanelProps,
  SkillCatalogModalProps,
  SkillDetailsPanelComponentProps,
  SkillDetailsSidePanelProps,
  SkillInfoTooltipContentProps,
  SkillListingEntry,
  SkillSelectorOverlayLabels,
  UseSkillSelectorOverlayOptions,
  UseSkillSelectorOverlayResult,
} from '@epam/ai-dial-skills';
```
