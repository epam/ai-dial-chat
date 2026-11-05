## Context

**`ConversationView.tsx` (1508 lines)** splits into these concerns:

| Concern | Lines |
| --- | --- |
| A. Deployment | 287–329, 660–730, 831–835 |
| B. Composer and edit skill overlays | 331–418, 534–540, 898–901 |
| C. Seed and draft | 420–528 |
| D. Anchored handlers | 860–986 |
| E. File-manager state and JSX | 564–573; JSX 1439–1484 |
| F. MCP | 582–601, 625–630 |
| G. Canvas, validation and drag-and-drop | |
| H. List labels and scroll | 767–858 |
| I. Reply | |
| J. Reload | |

The JSX runs from line 1060 to 1505.

**`ConversationMessageItem.tsx` (1177 lines)** has these sections:

| Section | Lines |
| --- | --- |
| Environment | 417–442 |
| Attachment plumbing | 443–468 |
| Citations | 503–631 |
| Attachment lists | 632–653 |
| Visualizer | 662–726 |
| MCP | 761–769 |
| `selectedAttachmentId` | 771–776 |
| Edit branch (early return) | 778–856 |
| Derived values | 858–917 |
| Main render | 919–1174 |

The render's `afterContent` sub-renderers:

| Sub-renderer | Lines |
| --- | --- |
| Reference chips | 985–1045 |
| Stages | 1046–1055 |
| Visualizer slot | 1059–1091 |
| MCP preview | 1092–1112 |
| Stream error | 1113–1137 |

The tests mock by module specifier:

- the contexts, `useUiFeature`, `useAttachmentCanvasResolvers`, `useMcpAppHostAdapter`, `server-api/mcp-apps`;
- `chat-hooks/mcp-apps` and `chat-hooks/scroll-anchoring`;
- the three selector-overlay hooks;
- `../ConversationMessageItem`.

## Goals / Non-Goals

**Goals:**

- One concern per module, with explicit parameters and returns.
- Keep the call sites that take about 60 props in place, and move the logic around them.
- The same behavior, effect timing and memo behavior.

**Non-Goals:**

- Prop restructuring.
- Composer or message-map sections.
- Library changes.
- Unrelated spec drift.

## Decisions

### D1 — Five view hooks, three item hooks, seven sections

These are the modules in the proposal. App hooks go in `apps/chat/src/hooks/conversation/` per the app rule (one hook per file, JSDoc). Sections sit next to the component they come from. The message sections get their own `message/` folder to keep `ConversationView/` flat.

### D2 — Ordering: move blocks contiguously, call them at the old position

`useComposerDraftWiring` is block C (420–528) moved as one piece. It is called where that block stood, after the composer skill hook it reads (`seedComposerSkillMentions`, `onDraftChange`, `selectedSkills`) and after `useConversationDeploymentState`. Its effects therefore keep their order relative to `useConversationComposerDraft`'s internal effects.

`useAnchoredMessageActions` is called after `useConversationScroll`, because it needs `armAnchor`. Its `useLayoutEffect` order relative to other layout effects is unchanged, because none sit between the old positions.

In `ConversationMessageItem`, the three hooks are called before the edit branch's early return (spec requirement 2), in this order:

1. `useMessageAttachments`, at the old attachment-plumbing position, because the citation callbacks read its `handleAttachmentClick`;
2. `useMessageCitations`;
3. `useGroupedVisualizer`, which reads `nonReferenceDisplayAttachments`.

The attachment memos and `selectedAttachmentId` that used to sit below the citations are pure values with no effects, so calling them earlier has no observable effect.

### D3 — Deployment state moves earlier only by memos

Lines 660–730 (selector items, starters, `isInputDisabled`) are `useMemo` values with no effects. Grouping them with 287–329 into one hook called at line 287 changes only the order of pure memos, so it has no observable effect.

### D4 — Hooks read contexts and i18n themselves

As in F3, each hook calls `useTranslation`, `useDeployments`, `useNotification`, `useSourcesSidebar` and so on itself. The view passes the values it computes, for example `fixedModel`, `conversation`, the skill-hook outputs, `armAnchor` and `onSend`.

`useConversationMcpApps` imports `mcpAppsApiClient`, so the view no longer imports server-api.

### D5 — Sections are presentational

The sections take the exact values their JSX reads today, as props. `MessageEditMode` receives the edit props, the fallback bubble inputs and the `onCancelEdit`/`onEditMessage` wrappers. Its `Suspense` boundary and the lazy `EditMessageInput` move with it.

### D6 — Verification

Each slice runs these specs, plus ESLint from `apps/chat`:

- `ConversationView.*.spec.tsx`
- `ConversationMessageItem.spec.tsx`
- `pages/Conversation/tests/Conversation*.spec.tsx`
- `pages/ApplicationEditor/setup/tests/AppPreviewChat.spec.tsx`

Nx targets run with `NX_WORKSPACE_ROOT_PATH` pinned to the worktree. Types are checked with `tsc -p apps/chat/tsconfig.app.json --noEmit` directly, because the Nx `typecheck` target of `@epam/chat` is disabled.

## Risks / Trade-offs

- **[Draft-restore regressions from reordering]** → Block C moves as one unit and keeps its call position. `ConversationView.draft.spec.tsx` (14 cases) runs on every slice.
- **[Memo regressions in the message list]** → `latestRef` and its layout effect move together, and the handlers keep their dependency arrays. `message-memo.spec` runs on every slice.
- **[A hook added below the edit-branch return]** → All new item hooks are called above line 778's equivalent. The rules-of-hooks lint guards it.
- **[The view stays above 1000 lines]** → This is accepted: the composer (~120 lines) and message-map (~130 lines) call sites stay intentionally. The actual number is recorded.
- **[Spec references to moved members]** → The ownership table in `conversation-view-decomposition` maps them.
