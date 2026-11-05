## Why

`apps/chat/src/components/ConversationView/ConversationView.tsx` has 1508 lines and 53 commits in the last 60 days. Its row component `ConversationMessageItem.tsx` has 1177 lines and 46 commits. Together they are item F4 of the 2026-10-26 refactoring audit.

`ConversationView` mixes these concerns:

- deployment and model selection;
- the composer and edit skill overlays;
- composer seeding and draft persistence (ordering-sensitive);
- anchored send, regenerate and edit handlers;
- MCP-app wiring;
- file-manager modal markup;
- message labels.

It also holds about 450 lines of JSX. `ConversationMessageItem` mixes citations, attachments, the grouped visualizer, the MCP inline preview, the edit-mode branch, reference chips and the stream-error banner.

A fix in one of these areas means reading past all the others. The order constraints are held only by comments: the render-phase reset before the draft hook, the `latestRef` layout effect, and hooks before the edit-mode early return.

## What Changes

Hooks go in `apps/chat/src/hooks/conversation/`, one per file with JSDoc. Components go beside the files they come from. Code moves verbatim, with the same callbacks, dependency arrays and relative order.

**From `ConversationView.tsx`:**

- **`useConversationDeploymentState`**: `isModelFixed`, `activeDeploymentId`, `selectedDeployment`, `isSelectedModelHidden`, `usageDeploymentId`, the selector items (`deploymentItems`, `fixedDeploymentItems`, `agentSelectorItems`, `isAgentSelectorHidden`), `hasQuickAppStarters`, `isInputDisabled` and `modelSelectorLabels`.
- **`useComposerDraftWiring`**: the composer seed, the draft store, the mount skip-restore state and its render-phase reset, `restoreDraft`, `useConversationComposerDraft`, `handleDraftChange`, the draft-skills effect, the mount-content effect and both `useComposerSeedSource` calls. They move as one contiguous block, in the same order.
- **`useAnchoredMessageActions`**: `handleSendWithAnchor`, `latestRef` with its `useLayoutEffect`, `handleRegenerateMessageWithAnchor`, `handleStartEdit`, `handleCancelEdit` and `handleEditMessageWithAnchor`.
- **`useConversationMcpApps`**: `mcpAppCache`, the fullscreen host adapter, `closeSourcesPanel`, `mcpAppCanvasLabels`, `openMcpAppCanvas` and `mcpAppTools` (with `mcpAppsApiClient`).
- **`useMessageListLabels`**: `deploymentLookup`, `tooltips`, `ariaLabels`, `formatStatusModelChangedBody` and `stepsLabel`.
- **`ConversationFileManagerModal`**: the lazy `DialFileManagerModal` block with its labels.
- **`ConversationReadOnlyFooter`**: the read-only branch with the duplicate button.

**From `ConversationMessageItem.tsx`:**

- **`useMessageCitations`**: annotations, citation groups with the fallback pool, the citation card, `handleCitationPreview`, `handleCitationOpenInBrowser`, `citationCallbacks`, `processedContent`/`markdownComponents`, `renderStageCitation`, `displayStages` and `copyContent`.
- **`useMessageAttachments`**: the attachment-click plumbing, reference groups, the display-attachment lists and `selectedAttachmentId`.
- **`useGroupedVisualizer`**: `groupedVisualizer`, `bubbleAttachments` and `handleExpandGroupedVisualizer`.
- Sections in `components/ConversationView/message/`:
  - `MessageEditMode` (the edit branch);
  - `MessageReferenceChips`;
  - `MessageVisualizerSlot` (the live region plus the placeholder or the inline visualizer);
  - `MessageMcpAppPreview`;
  - `MessageStreamError`.

What stays:

- `ConversationView.tsx` keeps the skill and prompt overlays, the canvas, validation and drag-and-drop wiring, reply-to-selection, scroll, chat settings, the message map and the composer JSX. It drops to about 1050 lines.
- `ConversationMessageItem.tsx` keeps its props, environment, stages, MCP match, the derived values and the `MessageBubble` render. It drops to about 750 lines.

No behavior changes: the same props, default `memo` exports, DOM, i18n keys, notifications, effect timing and memo behavior.

### Non-goals

- Changing any prop of `ConversationView` or `ConversationMessageItem`, or grouping props into objects.
- Splitting the composer (`ConversationInput`) JSX or the message map into sections. Their roughly 60-prop call sites would only move.
- Changing the libs these files call.
- Spec drift that this change does not cause, such as `canStopStreaming` in `generation-resume-on-refresh`.

### Acceptance criteria

- `ConversationView.tsx` is under 1100 lines and `ConversationMessageItem.tsx` under 800. The actual numbers are recorded. Each new module has a JSDoc summary and is under 300 lines.
- These specs pass without edits, with the same `it` counts:
  - the five `ConversationView.*.spec.tsx` files;
  - `ConversationMessageItem.spec.tsx`;
  - the `pages/Conversation` and `AppPreviewChat` specs that mock the view.
- `nx run-many -t test lint build typecheck -p @epam/chat`, `validate:docs` and `validate:specs` pass.

### Alternatives considered

1. **Only the plan's three sections** (file manager, MCP, input orchestration). This leaves `ConversationView` at about 1300 lines and does not touch the ordering-sensitive draft block.
2. **Concern hooks and leaf sections, keeping the big call sites in place** (chosen). This removes about 450 lines from the view and about 430 from the item without passing 60-prop bags through new layers.
3. **A `useConversationViewController` that returns everything.** Rejected: it hides the coupling instead of naming it.

### Rollback

The change is internal to `apps/chat`. Reverting the commit restores the files, with no data, API or host change.

## Capabilities

### New Capabilities

- `conversation-view-decomposition`: which hook or section owns each concern of `ConversationView` and `ConversationMessageItem`, the order constraints, and how other specs' references to members of either file map to the new owners.

### Modified Capabilities

None. Specs that name members such as `handleSendWithAnchor`, `restoreDraft`, `isPageDropAllowed`, `handleCitationPreview`, `groupedVisualizer` or `selectedAttachmentId` are covered by the ownership table. `isPageDropAllowed`, `handleMessageAttachmentClick`, `handleInputAttachmentClick` and `messageHistory` stay where those specs cite them.

## Impact

- **Code:** `apps/chat/src/`.
  - New hooks in `hooks/conversation/`: `useConversationDeploymentState.ts`, `useComposerDraftWiring.ts`, `useAnchoredMessageActions.ts`, `useConversationMcpApps.ts`, `useMessageListLabels.ts`, `useMessageCitations.tsx`, `useMessageAttachments.ts`, `useGroupedVisualizer.ts`.
  - New components: `components/ConversationView/ConversationFileManagerModal.tsx`, `ConversationReadOnlyFooter.tsx` and `message/{MessageEditMode,MessageReferenceChips,MessageVisualizerSlot,MessageMcpAppPreview,MessageStreamError}.tsx`.
  - Edited: `ConversationView.tsx` and `ConversationMessageItem.tsx`.
- **Tests:** none edited. The mocks of `../ConversationMessageItem`, `server-api/mcp-apps`, `useMcpAppHostAdapter` and the contexts keep applying, because the specifiers do not change.
- **Docs:** `docs/mcp-apps.md` ("ConversationView discovers tools and owns the cache and canvas") stays true at the component level. `docs/reusable-chat-workflows.md` cites the draft hooks by name, and those names do not change.
- **Unaffected:**
  - libs and the backend;
  - i18n (keys move with their code);
  - RTL and a11y (DOM unchanged);
  - feature gating and telemetry.
