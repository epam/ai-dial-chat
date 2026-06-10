## Context

`ConversationSourcesPanel` is a zero-prop React component that reads attachment data through two hooks: `useSourcesSidebar()` (provides `messages`) and `useConversationSources(messages)` (derives `uploaded: DisplayAttachment[]` and `generated: DisplayAttachment[]`). It renders the two arrays via `FilesSection`, with an empty state when both are empty. The panel already has a header area with disabled icon buttons; one of those buttons is a search icon placeholder.

`SearchInput` (`libs/sidebar/src/components/SearchInput/SearchInput.tsx`) accepts `{ placeholder, value, onChange }` and is already used in other sidebar panels (e.g. the conversation history panel). No changes to the lib are needed.

## Goals / Non-Goals

**Goals:**
- Render a `SearchInput` in the `ConversationSourcesPanel` header that filters both `uploaded` and `generated` arrays simultaneously.
- Match against the attachment's display name (case-insensitive substring).
- Show a "No results found" empty state when the query is non-empty but both filtered arrays are empty.
- Keep all search state local to `ConversationSourcesPanel` — no context, store, or URL changes.

**Non-Goals:**
- Searching attachment content (only name/title matching).
- Persisting the search query across panel open/close.
- Debouncing (attachment arrays are small; synchronous filtering is fine).
- Any change to `SearchInput`, `FilesSection`, or `useConversationSources`.

## Decisions

### 1. Local state, not context/store

**Decision:** Manage `searchQuery` with `useState` inside `ConversationSourcesPanel`.

**Rationale:** The query is purely ephemeral UI state. Lifting it to a context would add complexity with no benefit. Resetting on close is implicit — the panel unmounts or the parent clears `messages`, so the state resets naturally. If the panel stays mounted while closed, the query should be cleared on close; this can be done with a `useEffect` watching `isOpen`.

**Alternatives considered:**
- Storing in `SourcesSidebarContext` — rejected; context already owns open/messages, adding search couples unrelated concerns.

### 2. Filter on `title` / `name` field of `DisplayAttachment`

**Decision:** Filter by `attachment.title` (falling back to `attachment.name` if `title` is absent), case-insensitive substring match via `toLowerCase().includes()`.

**Rationale:** `title` is the human-readable label shown in `AttachmentCard`; it is the field the user sees and would type to find a file. Using `includes` is appropriate for short lists and matches user mental model (type a fragment, see matches).

**Alternatives considered:**
- `startsWith` — too restrictive; users commonly type middle-of-name fragments.
- Fuzzy matching — overkill for attachment lists that rarely exceed dozens of items.

### 3. Single "No results found" state for both sections empty

**Decision:** When `filteredUploaded.length === 0 && filteredGenerated.length === 0` and `searchQuery` is non-empty, render a centered "No results found" message instead of the two `FilesSection` components (which already hide themselves when their array is empty).

**Rationale:** `FilesSection` already renders `null` for empty arrays, so the panel body would be blank. An explicit empty-search state is more informative. Reusing the same visual slot as the existing "No data" state keeps the layout consistent.

### 4. SearchInput placement — replace the disabled icon button

**Decision:** Replace the disabled search icon button in the header with an active `SearchInput` component.

**Rationale:** The button was a visual placeholder; activating it with the real component requires no layout changes. The `SearchInput` sits in the `SidebarPanel` `actions` slot or directly in the header via the panel's existing header API.

## Risks / Trade-offs

- **Query not cleared on panel re-open** — If the component stays mounted between opens (it depends on the host app), the stale query persists. Mitigation: add a `useEffect(() => { setSearchQuery(''); }, [isOpen])` that resets on `isOpen` becoming `false`.
- **No debounce** — Synchronous filtering on every keystroke. Acceptable for lists of tens of items; if lists grow to hundreds, a `useDeferredValue` can be added without spec changes.
