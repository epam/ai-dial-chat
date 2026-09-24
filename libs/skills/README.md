# @epam/ai-dial-skills

Host-agnostic UI for picking a favorite skill to attach to a chat composer.

The lib knows nothing about where skills come from or what a selected skill
means at send time. `FavoriteSkillsPanel` renders a plain list of
`FavoriteSkillItem` objects the host has already resolved (from its own
skills/favorites data), and hands every interaction back through callbacks —
it never fetches, navigates, or modifies the composer itself.

`useSkillSelectorOverlay` owns the selection flow's state — the favorites
overlay, the browse-modal and details-panel open state, and every currently
mentioned skill, tracked as a character-range anchor within the composer's
draft text — while the host injects the listing data (descriptions included),
the favorites state, labels, the browse modal's picker content, the app-owned
details-panel component, and the current deployment's skills-support flag (a
plain boolean — the lib knows nothing about deployments). While that flag is
`false` the skill entry points are hidden, but a tracked mention stays in the
draft text and folds into `isSkillUnsupported` for the host's own
send-disabled condition. A message can carry any number of mentions,
interleaved anywhere with free text — order (not the shared `/{name}` label)
is what disambiguates two mentions that display the same name but resolve to
different skills. The send-time semantics of a selected skill stay app-owned.

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

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-skills/styles.css';
```

## Peer Dependencies

- `react` `^19.2.8`
- `@epam/ai-dial-ui-kit` `^0.15.0-dev.18`
- `@epam/ai-dial-chat-shared` `*`

## Components

### `SkillSelectorField`

Controlled field for forms whose selected skill belongs to the host draft.
It uses the same UI-kit input as model/agent fields and opens a searchable
favorites dropdown. Browse opens the catalog; the trailing clear button removes
the current selection without opening either popup. The field owns only popup
visibility and the search query. A missing
`displayName` falls back to the full reference. Browsing requires explicit
`isSkillsSupported`; an unsupported selection remains removable.
`isDisabled` disables both actions. `isInvalid`, `labelledById`, and
`describedById` connect host validation to the control. The host renders inline
errors and provides feature gating, metadata, and catalog content.

Pass host-resolved `favorites` (`FavoriteSkillItem[]`), optional
`onToggleFavorite` and `onViewDetails` callbacks, and translated
`labels.panelLabels`, `labels.searchPlaceholder`, and `labels.clearSearchLabel`.
Omitted favorites show the empty hint and Browse. Omitted action callbacks hide
their star/details actions. `renderOverlay(panel, isOpen, onClose)` can replace
the dropdown with a host-owned mobile sheet using the same panel.

```tsx
import { useState } from 'react';
import { SkillSelectorField } from '@epam/ai-dial-skills';

function SkillFieldExample() {
  const [value, onChange] = useState<string>();
  return (
    <>
      <span id="example-skill-label">Skill</span>
      <SkillSelectorField
        value={value}
        onChange={onChange}
        favorites={[{ id: 'skills/public/report', name: 'Report' }]}
        isSkillsSupported
        labelledById="example-skill-label"
        labels={{
          placeholder: 'Choose a skill',
          modalTitle: 'Use skill',
          removeSkillLabel: 'Remove skill',
          unsupportedTooltipLabel:
            'Selected model does not support skills. Remove the skill or select different model to proceed.',
        }}
        renderCatalogContent={(select) => (
          <button onClick={() => select('skills/public/report')}>Report</button>
        )}
      />
    </>
  );
}
```

Public types: `SkillSelectorFieldProps`, `SkillSelectorFieldLabels`, and
`SkillSelectorFieldStyles`. `styles` supports colors (`text`, `background`,
`border`, `error`), `typography.fontClassName`, `triggerClassName`, and `cssVars`.
`SKILLS_CLASS.selectorField` is the stable root class
`dial-skills-selector-field`. The existing stylesheet export includes its theme.

`FavoriteSkillsPanel` also accepts `className` and `rowClassName` for layout
composition. Its optional favorite/details callbacks hide their actions when
omitted. The form field uses full-width panels and 44px minimum-height rows.

The chat overlay's compatibility signal also depends on the selected reference,
independently of catalog loading or deletion; unresolved selections keep a
fallback chip and remain removable. The existing `isEnabled` gate still hides
the chat flow and its outgoing selection when disabled.

### `ChatSkill`

```tsx
import { ChatSkill } from '@epam/ai-dial-skills';

<ChatSkill
  name="my-skill"
  path="skills/public/my-skill"
  description={skill.description}
  onViewDetails={(path) => openDetailsPanel(path)}
/>;
```

Renders one used skill: a ui-kit `GhostButton` whose visible (and accessible)
label is `/` followed by `name`, wrapped in the ui-kit `InteractiveTooltip`
(`asChild`, uncontrolled, 550px max panel width, top placement flipping with
direction). The tooltip's content is the shared `SkillInfoTooltipContent` —
the description paragraph (omitted when empty) above the "View details" link
button — so the panel matches the favorite rows exactly. Activating the
button body does nothing beyond opening the tooltip; on a touch-only device
the tooltip renders nothing and the button stays presentation-only. The
component carries no remove control of its own — removal is the host input's
Backspace-at-start gesture.

`description` is the listing's value, rendered directly with no fetch.
`onViewDetails` receives the `path` when the tooltip's "View details" button
is clicked.

While `isUnsupported` is set the chip renders in an error state: the `/{name}`
label carries `unsupportedLabelClassName` (default `text-error`), the chip
carries `unsupportedClassName` (default `bg-error`), and the tooltip's content
is the unsupported-model message alone (`labels.unsupportedTooltipLabel`) — no
description paragraph and no "View details" button.

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
  labels={{ myCollectionLabel: t('input.addMenu.skills.myCollection') }}
/>;
```

Renders the header, the favorite rows (initials icon, name, filled star), and
the "Browse" button. When `favorites` is empty, the list area is replaced with
an empty-state hint; the header and "Browse" button still render. The panel is
280px wide at the desktop breakpoint and fills its container below it, so a
full-width mobile sheet hosts it edge-to-edge.

Each row is wrapped in the ui-kit `InteractiveTooltip` (`asChild`, so the row
stays the focus and click target). The tooltip is uncontrolled: the kit opens
it on hover or keyboard focus and keeps it open while the pointer is on the
row or the panel — including while it travels between them; on a touch-only
device it renders nothing and the row still selects on tap. Its content is the
skill's `description` — the listing's value, rendered only when non-empty —
above a link-style "View details" button whose label comes from
`labels.viewDetailsLabel`; the "View details" button is reachable whether or
not a description renders. The panel content itself is rendered by the shared
`SkillInfoTooltipContent` component (below), so a `ChatSkill` element shows
the exact same panel.

`onViewDetails` fires when the tooltip's "View details" button is clicked.

Passing `listboxId` switches the panel to listbox mode — the shape a text
field's list autocomplete drives, as the conversation input's `commandMenu`
does: the list becomes a `role="listbox"` with that `id`, named by the
header, and each row a `role="option"` whose `id` derives from `listboxId`
and the item id. The row matching `activeOptionId` carries
`aria-selected="true"` and the row highlight. Rows stay tabbable, while each
row's star and its tooltip's "View details" leave the Tab sequence (both stay
clickable), so Tab moves from row to row. `useSkillSelectorOverlay` forwards
both from the command-menu context; the Add-menu panel keeps the star and
"View details" in the Tab sequence.

`isMenu` is for a host that mounts the panel inside a `role="menu"` container,
as the conversation input's Add-menu overlay does: the rows and the "Browse"
action become `role="menuitem"` (the list wrappers `role="none"`), so the
desktop submenu's ArrowUp/ArrowDown/Home/End move between them.
`useSkillSelectorOverlay` sets it on the Add-menu panel; without it (and
without `listboxId`) the rows are `role="button"`.

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
paragraph (the listing's value, omitted entirely when empty) above a
link-style "View details" button (`IconEye` on its inline-start, label from
`viewDetailsLabel`). The "View details" button is reachable whether or not a
description renders.

While `unsupportedMessage` is set, the content is that message alone — no
description paragraph and no "View details" button. That state is why
`onViewDetails` is optional: the unsupported branch renders no button, so
the callback goes unused there.

`viewDetailsTabIndex` sets the "View details" button's `tabIndex`; pass `-1`
to keep it clickable but out of the Tab sequence, as `FavoriteSkillsPanel`
does in listbox mode.

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

### `SkillArchiveUploadDialog`

```tsx
import { SkillArchiveUploadDialog } from '@epam/ai-dial-skills';

<SkillArchiveUploadDialog
  isOpen={isDialogOpen}
  errorText={selectionError}
  accept=".zip,.md"
  labels={{
    dialogTitle: 'Upload skill',
    dropZoneLabel: 'Drag and drop it or click here to upload',
    dropZoneMobileLabel: 'Click here to upload',
    formatsLabel: 'File formats .zip and SKILL.md',
    fileInputAriaLabel: 'Upload a skill ZIP archive or a SKILL.md file',
    closeAriaLabel: 'Close',
  }}
  onClose={closeDialog}
  onFilesSelected={handleFilesSelected}
  onFilesRejected={handleFilesRejected}
/>;
```

Presentation for a skill-archive upload: a `Popup` with a drop area showing the accepted formats
and any local rejection message. It has no dependency on an import controller — wire
`onFilesSelected`/`onFilesRejected` to `@epam/ai-dial-chat-hooks`' `useSkillArchiveImport` (or an
equivalent host controller). Every label falls back to an English default, so `labels` may be
omitted entirely for an English-only host.

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
  commandMenu,
  skillCatalogModal,
  skillDetailsPanel,
  message,
  messageRevision,
  activeMentions,
  onDraftChange,
  onBackspaceAtCaret,
  caretPositionOverride,
  isSkillUnsupported,
  selectedSkills,
  resetSkillMentions,
  seedSkillMentions,
  renderHistorySkillSegments,
  renderHistorySkills,
}: UseSkillSelectorOverlayResult = useSkillSelectorOverlay({
  isEnabled: isSkillUsageEnabled,
  isSkillsSupported: selectedDeployment?.features?.skillsSupported === true,
  skills,
  sharedWithMe,
  publicSkills,
  favoriteIds,
  onToggleFavorite: (id) => unfavoriteSkill(id),
  labels: {
    addMenuLabel: 'Skills',
    backLabel: 'Back',
    emptyQueryHintLabel: 'Type to filter',
  },
  renderCatalogContent: (onSelect, onClose) => (
    <CatalogView onSelect={onSelect} onClose={onClose} />
  ),
  detailsPanelComponent: SkillDetailsPanel,
});

// Forwarded straight through to ConversationInput/EditMessageInput:
<ConversationInput
  message={message}
  messageRevision={messageRevision}
  activeMentions={activeMentions}
  onChange={(text) => {
    onDraftChange(text);
    /* ...whatever else the host already does with the typed text... */
  }}
  onBackspaceAtCaret={onBackspaceAtCaret}
  caretPositionOverride={caretPositionOverride}
  menuOverlays={skillMenuOverlay ? [skillMenuOverlay] : undefined}
  commandMenu={commandMenu}
  isSendDisabled={isSkillUnsupported}
  onSend={async (text, attachments) => {
    await sendMessage(text, attachments, { skills: selectedSkills });
    resetSkillMentions();
  }}
/>;
```

Owns the Skills Add-menu flow's state — a message can carry any number of
skill mentions, interleaved anywhere with free text, each tracked as a
character-range anchor within the composer's draft text. `skillMenuOverlay`
is the entry for the `menuOverlays` prop of
`ConversationInput`/`EditMessageInput`/`Input`; `commandMenu` is the
`/`-prefix command-menu config for the input's `commandMenu` prop — the same
favorites panel in search mode over the typed query, with
`labels.emptyQueryHintLabel` as its empty-query hint, rendered in listbox
mode so ArrowDown/ArrowUp and Enter in the input pick a skill. Both entries are
`undefined` while `isEnabled` is `false` or `isSkillsSupported` is `false`
(the current deployment does not support skills), so the host omits the
menu item and the slash dropdown entirely; the hook renders
`FavoriteSkillsPanel` as both entries' content, forwarding
`labels.panelLabels`. `skillCatalogModal` renders the lib's `SkillCatalogModal`
shell with `labels.catalogModalTitleLabel` as its title and
`renderCatalogContent` as its body — both elements the host renders at a
stable level outside the popover. `skillDetailsPanel` renders the injected
`detailsPanelComponent` (wrapped in `Suspense`, so a lazily loaded component
is fine); the open state of the modal and the panel, and the wiring of "View
details" and "Use in chat" back to selection, are the hook's.

`message`/`messageRevision` carry the draft text after the most recent
selection, with every `/{name}` mention spliced in — pass straight through
to the composer's own `message`/`messageRevision` props, the same one-shot
"populated by a starter selection" mechanism those props already support
(not a value fed back on every keystroke). `activeMentions` is every
currently-tracked mention's character range, for the composer's
`activeMentions` prop (the live-composing highlighted-run render).
`onDraftChange` reconciles tracked mentions against the composer's own
`onChange` value on ordinary typing — wire it alongside whatever else the
host already does with that callback. `onBackspaceAtCaret` and
`caretPositionOverride` forward straight to the composer's identically-named
props. `isSkillUnsupported` is `true` while at least one mention exists and
`isSkillsSupported` is `false` (always `false` while `isEnabled` is `false`):
hosts fold it into their send-disabled condition — a live-composing mention
has no per-mention error styling of its own (it's a plain highlighted run,
not a `ChatSkill`), so this boolean is the only unsupported-state signal
while composing. `selectedSkills` is the send-time
`custom_content.skills` payload — every tracked mention's `{ url }`, in
left-to-right text order, or `undefined` while nothing is mentioned (so the
field is omitted from the message entirely; order, not the shared `/{name}`
label, is what disambiguates two mentions that display the same name but
resolve to different skills). `resetSkillMentions` clears every tracked
mention and the draft alongside it — call after a successful send.
`seedSkillMentions(content, skills)` seeds the draft and its tracked mentions
from a persisted message — call once when entering edit mode on a message
that carries `custom_content.skills`.

`renderHistorySkillSegments(content, skills)` renders a **user** message's
`content` and `custom_content.skills` as an ordered array interleaving
plain-text runs and `ChatSkill` elements at each mention's actual text
position — for `UserMessageBubble`'s `textSegments` prop. `renderHistorySkills(skills)`
renders every entry as a flat list of `ChatSkill` elements, ignoring text
position — for `AssistantMessageBubble`'s `beforeContent` slot, since
assistant text is model-generated markdown and never authors positioned
mentions. Both resolve each entry's name and description from the injected
listing pools matched on its url (the name falling back to the url's last
non-empty segment, the description omitted when no pool carries the url),
and share the same "View details" panel; both return `null` while `isEnabled`
is `false` or the array is empty/absent, and a mention
`renderHistorySkillSegments` cannot locate in `content` is simply omitted
from the render. The chips render beside the bubble's first text line, so
pass `historyChipLabelClassName` with the label class the bubbles' body text
uses, keeping the chips' height matched to that line.

Row and chip descriptions come from the listing entries the host injects —
no per-skill fetch happens anywhere in the flow, and opening a tooltip
triggers zero requests.

## Utilities

### `buildFavoriteSkillItem`

```tsx
import { buildFavoriteSkillItem } from '@epam/ai-dial-skills';
import type { FavoriteSkillItem } from '@epam/ai-dial-skills';

const favorites: FavoriteSkillItem[] = listedSkills
  .filter((skill) => favoriteIds.has(skill.url))
  .map((skill) => buildFavoriteSkillItem(skill));
```

Builds a `FavoriteSkillItem` from a listing entry, mapping its `description`
straight through. The entry needs only `{ url, name }` — the host's skill
listing DTO satisfies it directly, and an entry that carries no `description`
produces no description paragraph.

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

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key              | Class                         | Element                                                                |
| ---------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `favoritesPanel` | `dial-skills-favorites-panel` | The `FavoriteSkillsPanel` root, which carries the themed CSS variables |
| `chip`           | `dial-skills-chip`            | The `/name` chip a `ChatSkill` renders inside the composer             |

```tsx
import { SKILLS_CLASS } from '@epam/ai-dial-skills';

SKILLS_CLASS.chip; // 'dial-skills-chip'
```

The chip is a `GhostButton` from
[`@epam/ai-dial-ui-kit`](https://www.npmjs.com/package/@epam/ai-dial-ui-kit), so
`dial-kit-base-button` is on the same element. Its height is exactly its label
line with no vertical padding, which is what aligns it with the composer's first
text line — keep the block padding at zero when restyling it:

```css
.dial-skills-chip {
  padding-inline: 0.75rem;
}
```

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
