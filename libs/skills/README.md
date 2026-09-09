# @epam/ai-dial-skills

Host-agnostic UI for picking a favorite skill to attach to a chat composer.

The lib knows nothing about where skills come from or what a selected skill
means at send time. `FavoriteSkillsPanel` renders a plain list of
`FavoriteSkillItem` objects the host has already resolved (from its own
skills/favorites data), and hands every interaction back through callbacks —
it never fetches, navigates, or modifies the composer itself. The host decides
what "select", "browse", and "view details" mean; the browse modal, the lazy
description fetch behind a row's tooltip, and the send-time semantics of a
selected skill are app-owned concerns outside this lib.

`SkillDetailsSidePanel` composes `@epam/ai-dial-catalog`'s exported
`DetailsPanel` into a right-anchored skill details panel. It adds no chrome of
its own: the host supplies the `CatalogItem`, the details data, and every
action.

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
- `@tabler/icons-react` `^3.0.0`

## Components

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
stays the focus and click target). The tooltip opens on hover or keyboard
focus and stays open while the pointer is on the row or the panel — leaving
either side only schedules a close after a short grace period (300 ms), which
entering either side cancels, so the pointer can travel between them; on a
touch-only device it renders nothing and the row still selects on tap. Its
content is the skill's `description` (rendered only when non-empty — the host
resolves it lazily and may never) above a link-style "View details" button
whose label comes from `labels.viewDetailsLabel`. While
`isDescriptionLoading` is `true`, a spinner renders in the description's
place; the "View details" button is reachable in every description state.

`onItemTooltipOpen` fires with the skill's id each time a row's tooltip opens
(hover or focus); the host uses it to fetch the skill's manifest description
once per session. `onViewDetails` fires when the tooltip's "View details"
button is clicked.

Clicking a row's star plays a short exit animation first, so
`onToggleFavorite` fires ~180 ms after the click rather than synchronously.
The list's height animates to match once the row is gone.

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

## Types

```tsx
import type {
  FavoriteSkillItem,
  FavoriteSkillsPanelColors,
  FavoriteSkillsPanelLabels,
  FavoriteSkillsPanelProps,
  SkillDetailsSidePanelProps,
} from '@epam/ai-dial-skills';
```
