## ADDED Requirements

### Requirement: The host keeps conversation panel props referentially stable

The host SHALL pass props to both memoized panel components that keep the same reference across renders unless their inputs change. The components are the app's `ConversationPanelView` (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, exported as `memo(ConversationPanelView)`) and the `ConversationPanel` from `libs/conversation-panel`, which is itself wrapped in `memo`. In particular:

- `App` (`apps/chat/src/app/app.tsx`) SHALL pass `onRequestedFilterChange` as a `useCallback`-stabilized function, not an inline arrow;
- `ConversationPanelView` SHALL pass `labels` as a `useMemo`-stabilized object, keyed on the translation function and the already-memoized label parts;
- `ConversationPanelView` SHALL pass `headerActions` as a `useMemo`-stabilized element, keyed on the inputs it closes over.

A re-render of `App` whose panel-relevant inputs are unchanged (for example, a sources-sidebar context update during an SSE stream) SHALL NOT re-render `ConversationPanelView`. A re-render of `ConversationPanelView` whose `ConversationPanel` inputs are unchanged SHALL NOT re-render `ConversationPanel`.

The lib's public API does not change. No lib code changes, and host knowledge stays in the app. This adds no user-visible string, RTL behavior, accessibility semantic, feature flag or telemetry.

#### Scenario: App re-render with unchanged panel inputs

- **GIVEN** `App` is rendered on a conversation route with the panel open
- **WHEN** `App` re-renders because an unrelated context value changes (for example, `SourcesSidebarContext.messages`)
- **THEN** `ConversationPanelView` does not re-render

#### Scenario: Panel view re-render with unchanged lib inputs

- **GIVEN** `ConversationPanelView` is rendered
- **WHEN** it re-renders without a change in `conversations`, `isLoading`, `isOpen`, the active conversation, translations, or any callback it forwards
- **THEN** the lib's `ConversationPanel` does not re-render

#### Scenario: Changing an input still propagates

- **WHEN** the active conversation id passed to `ConversationPanelView` changes
- **THEN** `ConversationPanelView` and `ConversationPanel` re-render and the new row is marked active
