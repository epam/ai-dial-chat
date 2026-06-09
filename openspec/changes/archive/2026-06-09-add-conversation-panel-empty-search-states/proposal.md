## Why

The `ConversationPanel` lib has a single internal `EmptyState` component (text only, no icon) that is used for both "no conversations exist" and "no search results" scenarios — they look identical and give no visual cue about which condition is active. Now that `PanelEmptyState` (icon + label, from `@epam/ai-dial-sidebar`) exists, the panel should use it to surface distinct, visually differentiated states for each case, consistent with the pattern established in `ConversationSourcesPanel`.

## What Changes

- Replace the internal `EmptyState` component in `libs/conversation-panel` with `PanelEmptyState` from `@epam/ai-dial-sidebar`.
- Split the single `isEmpty` render path into two distinct states:
  - **No conversations** — shown when `conversations` is empty (regardless of search/tab). Uses `IconMessageCircle` + existing `emptyLabel` prop.
  - **No search results** — shown when `conversations` is non-empty but filtered to zero by the active query (and/or tab). Uses `IconSearchOff` + a new `noResultsLabel` prop on `ConversationPanelProps`.
- Delete the now-unused `EmptyState` component from `libs/conversation-panel`.

## Capabilities

### New Capabilities

- `conversation-panel-empty-states`: Two distinct empty states in `ConversationPanel` — no-conversations (icon + label) and no-search-results (icon + label) — rendered via `PanelEmptyState` from the sidebar lib.

### Modified Capabilities

- `conversation-history-panel`: The existing requirement that an empty label is shown when no conversations match must be updated to cover the two-state split and the new `noResultsLabel` prop.

## Impact

- `libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx` — logic split, new prop, icon imports.
- `libs/conversation-panel/src/components/EmptyState/EmptyState.tsx` — deleted.
- `libs/conversation-panel/src/models/ConversationPanel.ts` — add `noResultsLabel: string` to `ConversationPanelProps`.
- `apps/chat/src/` — all call sites that mount `ConversationPanel` must pass the new `noResultsLabel` prop.
- `apps/chat/src/i18n/locales/en.json` + `apps/chat/src/constants/translation-keys.ts` — new i18n key for "No results found" in conversation history namespace (or reuse existing `SidebarI18nKeys.NoResults`).
