## ADDED Requirements

### Requirement: The Pinned section renders host-supplied project trees

`ConversationList` and `ConversationListSection` SHALL accept an optional `pinnedProjects?: PinnedProjects` prop. `ConversationListSection` forwards it. `@epam/ai-dial-conversation-panel` SHALL export these types (`libs/conversation-panel/src/models/pinned-projects.ts`):

```ts
/** A pinned project and the chats the host chose to list under it. */
interface PinnedProjectGroup {
  /** Stable unique id. */
  id: string;
  /** Display name. */
  name: string;
  /** Browser-navigable URL of the project; when set, middle-click opens it in a new tab. */
  href?: string;
  /** Origin tab the project belongs to, for the Origin filter. Defaults to `FilterTab.MyChats`. */
  source?: FilterTab;
  /** The chats listed under the project, in display order. */
  conversations: ConversationItem[];
  /** Renders a See all row after `conversations`. */
  hasMore: boolean;
}

/** The project trees of the Pinned section and their callbacks. */
interface PinnedProjects {
  /** Projects in display order, rendered before the pinned conversations. */
  projects: PinnedProjectGroup[];
  /** Called when a project row is activated. */
  onSelectProject: (projectId: string) => void;
  /** Called when a nested chat row is activated. */
  onSelectConversation: (conversationId: string, projectId: string) => void;
  /** Called when a See all row is activated. */
  onSeeAll: (projectId: string) => void;
  /** Builds the ⋮ actions of a project row and of its See all row; no trigger renders when absent or empty. */
  getActions?: (project: PinnedProjectGroup) => DropdownItem[];
  /** Called when the ⋮ menu of a project row or of its See all row opens; receives the trigger button. */
  onActionMenuOpen?: (
    project: PinnedProjectGroup,
    trigger: HTMLButtonElement,
  ) => void;
  /** Id of the project the host currently shows; its row gets `aria-current="page"`. */
  activeProjectId?: string;
}
```

**Rendering.** The lib SHALL NOT trim, sort or fetch: it renders exactly what the host passes. With `pinnedProjects` present, the Pinned group SHALL render each visible project, in order, before the pinned conversations, as these rows:

1. **Project row.** It has the project icon (default Tabler `IconBriefcase`, 16px glyph in the 24px slot, `aria-hidden`, `DIAL_KIT_ICON_STROKE`), the name truncated through `Highlight`, and the ⋮ trigger when `getActions` returns items.
2. **One nested row per conversation.** It is an `Indicator` row (status point, title, `aria-current` when it matches `activeConversationId`) without a ⋮ trigger.
3. **A See all row, when `hasMore` is set.** Its visible text is `labels.seeAllLabel` (default `'See all'`) in the `textSecondary` color, and its accessible name is `labels.seeAllAriaLabel(name)` (default `` `See all chats in ${name}` ``). It shows the project's ⋮ trigger when `getActions` returns items.

The Pinned header SHALL render when the section has at least one visible project or pinned conversation. Collapsing it hides the project rows too.

**Layout**, per the Figma frame "Chat - Project - See all" (`ao2NXcmfF23QrZigbiHC8M`, node `17:14375`):

- Every row is 32px high with a 2px gap: `INDICATOR_ITEM_ROW_HEIGHT` (34).
- The project row has the same 8px inline padding and 2px icon gap as an `Indicator` row.
- Nested and See all rows are offset 28px from the list's inline start (`padding-inline-start`). The See all row has no icon slot, so its text starts at the 8px row padding.
- A 1px vertical guide line is drawn at `inset-inline-start: 20px`, the centre of the project icon. Each nested and See all row draws its segment, so the line is continuous across the virtualized rows. The first segment starts 5px below its row's top, and the last segment (See all, or the last chat when there is none) ends 5px above its row's bottom.
- Its color is the new `ConversationListColors.projectGuideLine` (`--cp-project-guide-line`, fallback `var(--stroke-secondary, #d1dbea)`), set with `buildCssVars` and read in the row's `.module.scss`.
- Titles use `itemTitleClassName` / `unreadItemTitleClassName`, so no new typography prop is added.
- The rows are new members of `VirtualRowKind`: `Project = 'project'`, `ProjectConversation = 'project-conversation'` and `ProjectSeeAll = 'project-see-all'`.

**Search and filters**

- **Search.** While `searchQuery` is non-empty, a project whose name matches SHALL render with all its conversations and its See all row. Otherwise it renders when at least one conversation title matches, with only the matching conversations and no See all row. A project with no match is hidden. Matches in names and titles are highlighted with `Highlight`.
- **Origin filter.** A project renders under `FilterTab.All` and under the tab equal to its `source`.
- **Type filter.** `ConversationTypeFilter.Task` hides every project.
- **`hiddenSources`.** A project whose `source` is listed there is excluded.
- **Empty state.** A list whose only rows are projects is not empty.

**Drag and drop.** Project, nested and See all rows SHALL NOT be draggable and SHALL NOT be drop targets. Dragging a pinned conversation over them reports no target, and the Pinned header stays the only Pinned drop zone. Pinned conversations still reorder among themselves.

**Accessibility**

- The list keeps `role="list"`. Every row stays a `listitem` and a single tab stop: its link, followed by its ⋮ trigger when shown.
- Project rows SHALL carry `aria-level="1"`.
- Nested and See all rows SHALL carry `aria-level="2"`, `aria-setsize` (conversations plus See all) and `aria-posinset`, so assistive technology hears the nesting and position without a roving-focus tree widget.
- A project row matching `activeProjectId`, and a nested row matching `activeConversationId`, get `aria-current="page"`.
- The visually hidden `unreadIndicatorLabel` is announced for an unread nested row.
- Focus-visible styling matches hover on every new row.

**RTL.** Indent, padding and guide line use logical properties only (`padding-inline-start`, `inset-inline-start`, `ps-*`). The briefcase icon is symmetric and is not mirrored.

**Boundary.** The lib SHALL NOT know about DIAL projects, routes, pins or feature keys. Ids, names, `href` values, origin and `hasMore` come from the host, and behaviour goes through the callbacks.

#### Scenario: A project with more chats than listed

- **WHEN** `pinnedProjects.projects` holds P with 10 conversations and `hasMore: true`
- **THEN** the Pinned section renders P's row, 10 nested rows at `aria-level="2"` with `aria-setsize="11"`, and a See all row at `aria-posinset="11"`

#### Scenario: No See all without more chats

- **WHEN** P has `hasMore: false`
- **THEN** no See all row renders

#### Scenario: Activating rows

- **WHEN** the user activates P's row, a nested chat C and P's See all row in turn
- **THEN** `onSelectProject(P)`, `onSelectConversation(C, P)` and `onSeeAll(P)` are called in that order, and `onSelectConversation` of the list is not called

#### Scenario: Searching nested chats

- **GIVEN** P is named "Support" and has chats "Weekly summary" and "Billing reply"
- **WHEN** the query is "billing"
- **THEN** P's row and only "Billing reply" render, with "Billing" highlighted, and no See all row renders

#### Scenario: Searching by project name

- **WHEN** the query is "supp"
- **THEN** P's row renders highlighted with all its listed chats and its See all row

#### Scenario: Task filter

- **WHEN** the Type filter is `Task`
- **THEN** no project row renders

#### Scenario: Nested rows are not draggable

- **WHEN** the user starts dragging a nested chat row
- **THEN** no drag starts, and `onMoveConversation` is never called for it

#### Scenario: RTL guide line

- **WHEN** the list renders under `dir="rtl"`
- **THEN** the nested rows are indented from the right edge, and the guide line sits 20px from the right edge

#### Scenario: No pinned projects

- **WHEN** `pinnedProjects` is absent
- **THEN** the list renders the same rows as before this change, with no project, nested or See all row

## MODIFIED Requirements

### Requirement: Rows offer an indicator variant

`ConversationRowVariant` SHALL have the members `Avatar = 'avatar'` (the default, today's rows) and `Indicator = 'indicator'`. `ConversationList` SHALL accept `rowVariant`. `ConversationPanel` SHALL always render `Avatar` rows.

An `Indicator` row SHALL render:
- a leading dot, hollow when read; when unread, a filled dot in the `unreadDot` color and the title in `dial-small-semi-text`;
- no deployment avatar and no `leadingIcon`;
- no trailing unread dot.

It SHALL still announce the visually hidden `unreadIndicatorLabel` when unread. Row and group-header heights SHALL follow the variant.

Per the Figma frame "Chat - Project - See all" (`ao2NXcmfF23QrZigbiHC8M`, node `17:14375`), an `Indicator` row SHALL have 8px inline padding on both sides (`ps-2`, and `pe-2` when it has no actions). The 24px dot slot therefore sits under the 8px-padded group label, and the title starts 34px from the row's inline start. While the actions trigger is shown, the end padding stays the `pe-9` that makes room for the trigger. `Avatar` rows keep `ps-3` and their current end padding. The other spacing of the sidebar already matches the design and SHALL stay as it is:

- the 16px list gutter;
- the 8px gap under the header;
- the 8px section padding (`INDICATOR_FIRST_GROUP_HEADER_ROW_HEIGHT` 32, `INDICATOR_GROUP_HEADER_ROW_HEIGHT` 40);
- the 24px group header with `px-2`;
- the 32px row with a 2px gap (`INDICATOR_ITEM_ROW_HEIGHT` 34).

#### Scenario: Unread indicator row

- **WHEN** an `isUnread` conversation with an `iconUrl` and a `leadingIcon` renders as an `Indicator` row
- **THEN** it shows a filled leading dot and a semi-bold title, renders neither the avatar nor the leading icon, and announces the unread label

#### Scenario: Default rows are unchanged

- **WHEN** `ConversationList` renders without `rowVariant`
- **THEN** rows render with the deployment avatar or `leadingIcon`, exactly as `ConversationPanel` rows do

#### Scenario: Indicator row padding

- **WHEN** an `Indicator` row without actions renders
- **THEN** its button has `ps-2` and `pe-2`, so the dot slot starts 8px from the row's inline start
