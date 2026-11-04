## Context

`ConversationPanel` composes `SidebarPanel`, `NewChatButton`, a `Search` field, `FilterTabs` and `ConversationList`. It owns the search text and the active filter tab and hands them to the list as controlled props (`searchQuery`, `activeFilter`). `ConversationList` already accepts `pinnedProjects` and the See all labels, and `ConversationListSection` already forwards `pinnedProjects`. The panel does not: its props type has no such field, and it builds the list's labels from a fixed set of destructured fields, which leaves out `seeAllLabel` and `seeAllAriaLabel` although `ConversationPanelLabels` extends `ConversationListLabels`.

The panel's chrome parts are not exported from the package and its `exports` map blocks deep imports, so a host cannot recompose the panel around a list that has `pinnedProjects`.

## Goals / Non-Goals

**Goals:**

- A host using `ConversationPanel` can show pinned project trees with the panel's own search and filter chips.
- The See all labels set on `ConversationPanel` reach the list.
- No change in output when the new prop is omitted.

**Non-Goals:**

- Changing how rows render, filter, drag or announce; `ConversationList` owns that.
- Exporting `FilterTabs` or `NewChatButton`, or adding props to `ConversationListSection`.
- Host-side wiring, data fetching or any knowledge of what a "project" is.

## Decisions

**1. Forward the prop untouched.** `ConversationPanel` passes `pinnedProjects` straight to `ConversationList`, as `ConversationListSection` does. The panel holds no state for it and does not copy the object, so the host's referential stability carries through to the list's `memo`. *Alternative:* wrap or normalise the trees in the panel. Rejected: it would duplicate the list's contract and make two places decide what a project row is.

**2. Type the prop with the existing `PinnedProjects`.** `ConversationPanelProps` imports the type from `models/pinned-projects`, the same one `ConversationListProps` uses, with the same JSDoc sentence. No new export is needed, because the type is already public. *Alternative:* `Pick<ConversationListProps, 'pinnedProjects'>`. Rejected: it hides the type name from the panel's own generated docs for no benefit.

**3. Forward the See all labels through the memoized `listLabels`.** Destructure `seeAllLabel` and `seeAllAriaLabel` with the other labels and add them to the object and to its `useMemo` dependency list. The object stays stable as long as the values do, so `memo(ConversationList)` keeps working. *Alternative:* spread `labels` into the list. Rejected: it would hand panel-only fields (`title`, `newChatLabel`, `filterLabels`, …) to the list and change its identity on any label change.

**4. Leave search and filtering to the list.** The panel already passes `searchQuery`, `activeFilter` and `hiddenSources`; the list applies them to project trees. No panel code is added for it.

**5. Library boundary.** Ids, names, `href`, `source`, `hasMore` and every callback come from the host through `PinnedProjects`. The lib gets no routes, project requests or feature keys. A host adapter builds the object and owns its refresh and stability.

## Risks / Trade-offs

- **Host passes a fresh `pinnedProjects` object every render** → the panel re-renders each time, as for any unstable prop; the README states that the object, and `seeAllAriaLabel`, should be stable.
- **Two components now carry the prop** → a future list-level option needs forwarding in both. Mitigation: the panel spec checks the forwarding, and the README lists the prop under both.
- **Label fields are forwarded one by one** → a new list label can be forgotten in the panel again. Mitigation: the new test pins the See all pair; the dependency list is next to the fields it copies.

## Migration Plan

Additive and optional. Hosts upgrade `@epam/ai-dial-conversation-panel` and pass `pinnedProjects`. Rollback is removing the prop, its forwarding, the two label fields in `listLabels` and the README text.

## Open Questions

None.
