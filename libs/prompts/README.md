# @epam/ai-dial-prompts

Host-agnostic UI for picking a favorite prompt and resolving its
`{{parameter}}` placeholders before the resulting text is handed back to a
chat composer.

The lib knows nothing about where prompts come from or how a chat message is
sent. `FavoritePromptsPanel` renders a plain list of `FavoritePromptItem`
objects the host has already resolved (from its own favorites/prompts data),
and `PromptParametersPopup` only reads and replaces `{{param}}` tokens in a
`content` string it is given — it never fetches, navigates, or inserts text
anywhere itself. The host decides what "select" and "submit" mean.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-prompts": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-prompts/styles.css';
```

## Peer Dependencies

- `react` `^19.2.8`
- `@epam/ai-dial-ui-kit` `^0.15.0-dev.18`
- `@epam/ai-dial-chat-shared` `*`

## Components

### `FavoritePromptsPanel`

```tsx
import { FavoritePromptsPanel } from '@epam/ai-dial-prompts';
import type { FavoritePromptItem } from '@epam/ai-dial-prompts';

<FavoritePromptsPanel
  favorites={favoritePrompts}
  onSelect={(item: FavoritePromptItem) => handlePromptPicked(item)}
  onToggleFavorite={(id) => unfavoritePrompt(id)}
  onBrowse={openBrowseModal}
  labels={{ myCollectionLabel: t('input.addMenu.prompts.myCollection') }}
/>;
```

Renders the header, the favorite rows (icon, name, filled star, description
tooltip), and the "Browse" button. When `favorites` is empty, the list area is
replaced with an empty-state hint; the header and "Browse" button still
render.

The panel is built for the conversation input's Add-menu overlay, which mounts
it inside a `role="menu"` container: every row and the "Browse" action are
`role="menuitem"`, so the desktop submenu's ArrowUp/ArrowDown/Home/End move
between them, and the list wrappers are `role="none"`.

Each row with a non-empty `description` is wrapped in the ui-kit
`InteractiveTooltip` (`asChild`, so the row stays the focus and click target).
The tooltip is uncontrolled: the kit opens it on hover or keyboard focus and
keeps it open while the pointer is on the row or the panel — including while
it travels between them; on a touch-only device it renders nothing and the
row still inserts the prompt on tap. Rows without a description are not
wrapped at all — no tooltip appears for them.

Clicking a row's star plays a short exit animation first, so
`onToggleFavorite` fires ~180 ms after the click rather than synchronously.
The list's height animates to match once the row is gone.

### `PromptParametersPopup`

The package root preserves the existing `PromptParametersPopup` export and props.
It loads the popup and its catalog dependencies only when `open` is true, with an
internal Suspense boundary; consumers do not need to add one. The workflow hook
uses the same wrapper, keeping AG Grid out of the initial bundle.

The `./parameters-popup` subpath exposes the eager component for hosts that want
to manage loading themselves.

```tsx
import { PromptParametersPopup } from '@epam/ai-dial-prompts';
import {
  extractPromptParams,
  resolvePromptParams,
} from '@epam/ai-dial-chat-shared';

const parameters = extractPromptParams(selectedPrompt.content);

<PromptParametersPopup
  open={isPopupOpen}
  promptName={selectedPrompt.name}
  content={selectedPrompt.content}
  parameters={parameters}
  onBack={openedFromBrowseModal ? reopenBrowseModal : undefined}
  onClose={closePopup}
  onCancel={closePopup}
  onSubmit={(values) =>
    insertIntoComposer(resolvePromptParams(selectedPrompt.content, values))
  }
/>;
```

Pass `onBack` only when the popup was opened from the browse modal — omitting
it hides the header's back chevron, matching the direct-from-favorite entry
point. `extractPromptParams`/`resolvePromptParams` live in
`@epam/ai-dial-chat-shared`, alongside the `{{param}}` grammar this component
renders inline via `MarkdownWithPlaceholders`.

`parameters` is a `PromptParameter[]` — each entry a `name` and an optional
`defaultValue`, which `extractPromptParams` reads out of the prompt body. A
token written as `{{language|Spanish}}` labels its field `language` and opens
it holding `Spanish`, so confirming without typing submits the default; a bare
`{{tone}}` opens empty, as before. Every field stays required, so a parameter
without a default still has to be filled before Submit enables.

## Hooks

### `usePromptSelectorOverlay`

```tsx
import {
  usePromptSelectorOverlay,
  type FavoritePromptItem,
} from '@epam/ai-dial-prompts';

const {
  renderOverlay,
  promptCatalogModal,
  parametersPopup,
  openParametersPopup,
} = usePromptSelectorOverlay({
  isEnabled: isPromptsFeatureEnabled,
  prompts: mergedPromptListing, // FavoritePromptItem[] — id/name/content/description
  favoriteIds,
  onToggleFavorite: (id) => removeFavorite(id),
  onInsertText: (text) => insertIntoComposer(text),
  labels: {
    panelLabels: { myCollectionLabel: 'My Collection' },
    parametersLabels: { title: 'Prompt parameters' },
  },
  renderCatalog: ({ isOpen, onSelect, onClose }) => (
    <LazyPromptCatalogModal
      isOpen={isOpen}
      onClose={onClose}
      onSelect={(id) => {
        const prompt = mergedPromptListing.find((p) => p.id === id);
        if (prompt) onSelect(prompt);
      }}
    />
  ),
});

// renderOverlay?.(onClose) — pass as the Add-menu Prompts entry's renderOverlay
// {promptCatalogModal} / {parametersPopup} — render at a stable level outside that popover
```

Owns the favorites overlay, the browse/parameter transitions, and parameter resolution over
`FavoritePromptsPanel`/`PromptParametersPopup`; it renders neither the browse modal nor the
Add-menu row itself. The host supplies the merged prompt listing (a `FavoritePromptItem[]` the
host already resolved from its own sources), favorites state, an `isEnabled` policy, and
`renderCatalog` — its own lazy-loaded browse-modal content, whose `onSelect` receives the full
structural prompt so this hook never fetches or imports a generated DTO. `renderOverlay` is
`undefined` while disabled, and `openParametersPopup` is then a no-op — a host wires
`openParametersPopup` to a route-level "Use in chat" action to open the popup directly, with no
Back action offered.

`parametersPopup` renders `PromptParametersPopup` behind a `React.lazy()`/`Suspense` boundary
internally, so a host that only calls this hook never pulls the popup's `@epam/ai-dial-catalog`
dependency (and the AG Grid it bundles) into its initial chunk.

## Types

```tsx
import type {
  FavoritePromptItem,
  FavoritePromptsPanelColors,
  FavoritePromptsPanelLabels,
  FavoritePromptsPanelProps,
  PromptParametersPopupColors,
  PromptParametersPopupLabels,
  PromptParametersPopupProps,
  RenderPromptCatalogProps,
  UsePromptSelectorOverlayLabels,
  UsePromptSelectorOverlayOptions,
  UsePromptSelectorOverlayResult,
} from '@epam/ai-dial-prompts';
```

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key              | Class                          | Element                                                                 |
| ---------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `favoritesPanel` | `dial-prompts-favorites-panel` | The `FavoritePromptsPanel` root, which carries the themed CSS variables |

```tsx
import { PROMPTS_CLASS } from '@epam/ai-dial-prompts';

PROMPTS_CLASS.favoritesPanel; // 'dial-prompts-favorites-panel'
```

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
