## ADDED Requirements

### Requirement: The panel overflow menu also renders in the sidebar's conversation block header

In the navigation-sidebar layout, `ConversationPanelView` SHALL pass the same `ConversationPanelMenu` element it passes as `ConversationPanel`'s `headerActions` to `ConversationListHeader`'s `actions` slot. The trigger, its accessible name (`conversationPanel.panelActionsLabel`) and its items SHALL be the ones the panel header renders today: Export all (omitted under `hide-conversation-export`), Import and Delete all. Delete all keeps its confirmation popup, loading state, partial- and total-failure handling and navigation to root.

#### Scenario: Delete all from the sidebar

- **WHEN** the sidebar layout is active and the user chooses Delete all from the conversation block's overflow menu and confirms
- **THEN** the same confirmation flow runs as from the panel header, and on success the list is cleared and the app navigates to `/` if a conversation was open

#### Scenario: Export all hidden in the sidebar

- **WHEN** the sidebar layout is active and `isEnabled('hide-conversation-export')` is `true`
- **THEN** the overflow menu offers Import and Delete all but no Export all
