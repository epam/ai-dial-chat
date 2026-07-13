# Search result highlighting

Whenever implementing or modifying a search feature (search bars, filterable dropdowns, model/deployment pickers, conversation search, file/attachment search, sources panels, catalog/app search, etc.), render the matched text of each result using the shared `Highlight` component from `libs/chat-shared/src/components/Highlight/Highlight.tsx` (exported as `Highlight` from `@epam/ai-dial-chat-shared`) — never a bespoke `<mark>`/regex-based highlighter or plain unhighlighted text.

```tsx
// Correct
import { Highlight } from '@epam/ai-dial-chat-shared';

<Highlight text={item.title} query={searchQuery} />

// Wrong — plain text or custom highlighting logic
<DialEllipsisTooltip text={item.title} />
```

`Highlight` takes `text`, `query`, and optional `markClassName`/`className`, highlights the first case-insensitive match, and already handles ellipsis truncation and tooltip-on-overflow via `DialEllipsisTooltip`. If a call site's UI genuinely can't fit `Highlight`'s API, extend the component rather than duplicating its logic elsewhere.

When the query lives above the result-rendering component in the tree, thread it down as an explicit prop (e.g. `searchQuery`) through every intermediate layer — do not skip layers and leave the leaf component rendering plain text.
