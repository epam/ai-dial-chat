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

## Peer Dependencies

- `react` `^19.0.0`
- `@epam/ai-dial-ui-kit` `^0.13.0-dev.26`
- `@epam/ai-dial-chat-shared` `*`
- `@tabler/icons-react` `^3.0.0`

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

### `PromptParametersPopup`

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
} from '@epam/ai-dial-prompts';
```
