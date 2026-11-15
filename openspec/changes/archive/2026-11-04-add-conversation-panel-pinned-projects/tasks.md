Slicing strategy: vertical. The whole change is one path through `libs/conversation-panel` (type, forwarding, tests, docs), so the first slice already works end to end and the second only documents it.

## 1. Forward `pinnedProjects` and the See all labels

- [x] 1.1 In `libs/conversation-panel/src/models/panel-props.ts`, import the `PinnedProjects` type from `./pinned-projects` and add `pinnedProjects?: PinnedProjects` to `ConversationPanelProps`, with the same JSDoc sentence as on `ConversationListProps` in `src/models/conversation-list.ts`.
- [x] 1.2 In `libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx`, destructure `pinnedProjects` from props and pass it to `<ConversationList>` unchanged.
- [x] 1.3 In the same file, destructure `seeAllLabel` and `seeAllAriaLabel` from `labels`, add both to the `listLabels` object and to its `useMemo` dependency list.
- [x] 1.4 Architecture guard: confirm the diff adds no host-owned detail to the lib (no `/api` paths, server-api or generated-client imports, app contexts, auth or env access, feature flags, route knowledge, telemetry, or project-specific names beyond the existing `PinnedProjects` types).
- [x] 1.5 Add tests to `libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx`, using role, label and text queries and `userEvent` for clicks and typing:
  - a pinned project renders its row, nested chats and See all row inside the panel;
  - activating the project row, a nested chat and the See all row calls `onSelectProject`, `onSelectConversation(conversationId, projectId)` and `onSeeAll`, and not the panel's `onSelectConversation`;
  - typing in the panel's search field filters the project's chats by title and hides the See all row;
  - selecting a filter chip hides a project whose `source` does not match, and `hiddenSources` excludes it;
  - `labels.seeAllLabel` and `labels.seeAllAriaLabel` set the See all text and accessible name, and the defaults apply when omitted;
  - with `pinnedProjects` omitted, no project row renders;
  - the labels object handed to the list keeps its identity when only `conversations` changes (assert through `ConversationList` mocked at module level, or by checking that a memoized row does not re-render).

### Verification

- `npm run test:file -- libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx`
- `npm run test:file -- libs/conversation-panel/src/components/ConversationListSection/tests` (the list and section behaviour this change relies on)
- `npm run verify:changed` once after this slice.

## 2. Document the prop

- [x] 2.1 In `libs/conversation-panel/README.md`, extend the "Pinned projects" section so it names `ConversationPanel` next to `ConversationList` and `ConversationListSection`, and add a `ConversationPanel` snippet with `pinnedProjects` and `labels.seeAllLabel` / `labels.seeAllAriaLabel`.
- [x] 2.2 In the same section, state that a host should pass a referentially stable `pinnedProjects` object and `seeAllAriaLabel`, because the panel is memoized.
- [x] 2.3 Run `npm run validate:specs` and `openspec validate add-conversation-panel-pinned-projects --strict`, and fix any path or format error in the change's artifacts.

### Verification

- `npm run validate:specs`
- `openspec validate add-conversation-panel-pinned-projects --strict`

## 3. Close the change

- [x] 3.1 Run `npm run verify:full` once (typecheck, `lint:check`, tests); do not run `npm run lint`.

No i18n, RTL, feature-flag, `docs/` or endpoint tasks apply: the lib adds no strings, no direction-specific UI, no gating and no backend surface, and `docs/` does not describe the panel's props.
