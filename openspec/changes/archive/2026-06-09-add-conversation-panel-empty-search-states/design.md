## Context

`ConversationPanel` (in `libs/conversation-panel`) currently uses an internal `EmptyState` component that renders a centered text paragraph — no icon. It is used for a single `isEmpty` condition: `filteredItems.length === 0`, which collapses two distinct scenarios into one indistinguishable state.

`PanelEmptyState` (in `libs/sidebar`) was recently created and renders a centered icon + label. `libs/conversation-panel` already imports from `@epam/ai-dial-sidebar` (`SearchInput`, `SidebarPanel`, `SidebarSide`), so importing `PanelEmptyState` from there adds no new dependency.

## Goals / Non-Goals

**Goals:**
- Distinguish "no conversations at all" (list is empty) from "no search results" (list filtered to zero by query or tab).
- Render both states via `PanelEmptyState` with an appropriate icon and translated label.
- Delete the now-redundant internal `EmptyState` component.
- Add a `noResultsLabel` prop to `ConversationPanelProps` so the app supplies the translated string.

**Non-Goals:**
- Changing tab or search filter logic.
- Making icon or icon size customizable via props (they are semantic choices owned by the lib).
- Animating state transitions.

## Decisions

### 1. Two-state split logic

**Decision:** `isNoConversations = conversations.length === 0` (check the raw unfiltered array). `isNoResults = conversations.length > 0 && filteredItems.length === 0`.

**Rationale:** This cleanly separates the two cases. If the user has conversations but none match the current query/tab, the search/filter is the cause — show "no results". If the raw list is empty, the user simply has no conversations — show the generic empty state.

**Alternatives considered:**
- Check `filteredItems.length === 0` only — can't tell which cause applies.

### 2. Icons are hardcoded in the lib

**Decision:** `IconMessageCircle` (size 48) for no-conversations; `IconSearchOff` (size 45) for no-results. Both from `@tabler/icons-react` (already a transitive dep).

**Rationale:** These icons are part of the component's visual design contract, not app-level customisation. Accepting icons as props would unnecessarily widen the API for no clear consumer benefit.

### 3. `noResultsLabel` as a required prop on `ConversationPanelProps`

**Decision:** Add `noResultsLabel: string` as a required prop (not optional with a default).

**Rationale:** The lib must not embed i18n. Making it required ensures all consumers provide a translated string and prevents invisible "no results" text. The existing `emptyLabel` prop follows the same pattern and is also required.

### 4. Delete `EmptyState`, do not deprecate

**Decision:** Delete `libs/conversation-panel/src/components/EmptyState/EmptyState.tsx` outright.

**Rationale:** `EmptyState` is not exported from the lib's `index.ts` and has no external consumers. Removing it immediately avoids dead code.

## Risks / Trade-offs

- **All `ConversationPanel` call sites need `noResultsLabel`** — a required prop addition is a breaking change for consumers. The only consumer is `apps/chat`; update it in the same PR.
- **Icon choice is opinionated** — `IconMessageCircle` may not match every future theme. Acceptable; can be made a prop later if needed.
