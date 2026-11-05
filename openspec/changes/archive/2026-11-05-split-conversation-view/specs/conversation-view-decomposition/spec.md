## ADDED Requirements

### Requirement: Conversation view concerns live in focused hooks and sections

`ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`) and `ConversationMessageItem` (`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`) SHALL delegate these concerns:

| Module | Owns |
| --- | --- |
| `apps/chat/src/hooks/conversation/useConversationDeploymentState.ts` | the fixed or selected deployment, the hidden-model and usage ids, the selector items and visibility, quick-app starters, `isInputDisabled`, the model-selector labels |
| `apps/chat/src/hooks/conversation/useComposerDraftWiring.ts` | the composer seed, the draft store and restore, the mount skip-restore state and its render-phase reset, `handleDraftChange`, the draft-skills and mount-content effects, both `useComposerSeedSource` calls |
| `apps/chat/src/hooks/conversation/useAnchoredMessageActions.ts` | `handleSendWithAnchor`, `latestRef` and its layout effect, anchored regenerate, start, cancel and edit |
| `apps/chat/src/hooks/conversation/useConversationMcpApps.ts` | the MCP response cache, the fullscreen host adapter, canvas labels, `openMcpAppCanvas`, `mcpAppTools` (with `mcpAppsApiClient`) |
| `apps/chat/src/hooks/conversation/useMessageListLabels.ts` | `deploymentLookup`, message-action `tooltips` and `ariaLabels`, `formatStatusModelChangedBody`, `stepsLabel` |
| `apps/chat/src/components/ConversationView/ConversationFileManagerModal.tsx` | the lazy `DialFileManagerModal` block and its labels |
| `apps/chat/src/components/ConversationView/ConversationReadOnlyFooter.tsx` | the read-only notice and the duplicate button |
| `apps/chat/src/hooks/conversation/useMessageCitations.tsx` | annotations and citation groups (with the fallback pool), `handleCitationPreview`, `handleCitationOpenInBrowser`, `citationCallbacks`, markdown components, `renderStageCitation`, `displayStages`, `copyContent` |
| `apps/chat/src/hooks/conversation/useMessageAttachments.ts` | attachment-click plumbing, reference groups, display-attachment lists, `selectedAttachmentId` |
| `apps/chat/src/hooks/conversation/useGroupedVisualizer.ts` | `groupedVisualizer`, `bubbleAttachments`, `handleExpandGroupedVisualizer` |
| `apps/chat/src/components/ConversationView/message/MessageEditMode.tsx` | the edit-mode branch (`EditMessageInput` and its suspense fallback) |
| `apps/chat/src/components/ConversationView/message/MessageReferenceChips.tsx` | the reference-chip `CitationDropdown`s |
| `apps/chat/src/components/ConversationView/message/MessageVisualizerSlot.tsx` | the visualizer live region, placeholder and `InlineGroupedVisualizer` |
| `apps/chat/src/components/ConversationView/message/MessageMcpAppPreview.tsx` | `McpAppInlinePreview` |
| `apps/chat/src/components/ConversationView/message/MessageStreamError.tsx` | the stream-error banner and retry button |

`ConversationView.tsx` SHALL keep:

- the skill and prompt overlays;
- canvas, validation and drag-and-drop wiring, including `isPageDropAllowed`, `handleInputAttachmentClick` and `handleMessageAttachmentClick`;
- reply-to-selection, scroll, `messageHistory` and chat settings;
- the message map and the composer JSX.

`ConversationMessageItem.tsx` SHALL keep its props, the environment, stages, the MCP match, the derived values and the `MessageBubble` render.

Both files SHALL keep their default `memo` exports.

A spec that names a member of either file refers to that member in the module this table assigns it to.

The split SHALL NOT change any prop, DOM node, i18n key, notification, effect timing or memo behavior. It introduces no endpoint, cache, feature gate or telemetry.

#### Scenario: Existing view and item specs pass unchanged

- **WHEN** the five `ConversationView.*.spec.tsx` files, `ConversationMessageItem.spec.tsx`, and the `pages/Conversation` and `AppPreviewChat` specs run without edits against the split files
- **THEN** every case passes, with the same number of `it` cases as before

### Requirement: Ordering constraints survive the split

The extraction SHALL preserve these orderings:

- In `useComposerDraftWiring`, the `hasInputContentAtMount` state SHALL precede the skip-restore state, and its render-phase reset SHALL precede `useConversationComposerDraft`. The draft-skills effect and the mount-content effect SHALL come after the draft hook. The overlay-content `useComposerSeedSource` call SHALL come before the skill-message one, so the skill message still wins when both fire in one commit.
- In `useAnchoredMessageActions`, the `useLayoutEffect` that syncs `latestRef` SHALL keep the anchored handlers' dependencies free of `messages` and `isAssistantTyping`. As a result, `memo(ConversationMessageItem)` still re-renders only the streaming row.
- `ConversationMessageItem` SHALL call every hook, including the new ones, before the edit-mode early return. `MessageEditMode` renders inside that branch as a component with its own hooks.

#### Scenario: Streaming re-renders only the streaming row

- **WHEN** an assistant message streams in a conversation with several messages
- **THEN** the existing `ConversationView.message-memo.spec.tsx` cases still observe re-renders of only the streaming item

#### Scenario: Draft restore and seeding behave as before

- **WHEN** the `ConversationView.draft.spec.tsx` cases run (mount with overlay content, conversation switch, skill-message seed)
- **THEN** they pass without edits
