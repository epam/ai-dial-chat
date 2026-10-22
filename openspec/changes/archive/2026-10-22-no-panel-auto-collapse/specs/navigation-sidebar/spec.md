# Delta: navigation-sidebar

## MODIFIED Requirements

### Requirement: Sidebar state is owned by ConversationPanelContext and ignores the route

On desktop, `ConversationPanelContext`'s `isPanelOpen` SHALL mean "expanded"; on mobile it is reset and ignored, because the drawer's open state is `isNavOpen` in `app.tsx`. No other state owns the sidebar's width.

`useConversationPanelRouteState` SHALL receive `isSidebarLayout` and, when it is `true`:
- SHALL NOT change the state on any route change, inside or outside the conversation section;
- SHALL start from `showConversationsSectionByDefault` and keep the user's own choice for the rest of the page session.

The state SHALL NOT be persisted across reloads. After the initial state, only the user's own toggle SHALL collapse or expand the sidebar: opening the attachment canvas or an MCP app canvas, from any call site, SHALL leave it as it is, and expanding the sidebar SHALL leave the attachment canvas open. The canvas's width is bounded by the room the sidebar leaves (see the `canvas` capability), so both fit side by side.

When `isEnabled('conversations-panel-toggle')` is `false`, no toggle SHALL render and the sidebar SHALL stay in its initial state.

#### Scenario: Navigating to another page keeps the sidebar expanded

- **WHEN** the sidebar is expanded and the user navigates from `/conversations/<id>` to `/catalog`
- **THEN** the sidebar stays expanded and the conversation list is visible on the catalog page

#### Scenario: The user's collapse survives navigation

- **WHEN** the user collapses the sidebar and then navigates to `/files` and back to `/`
- **THEN** the sidebar is still collapsed

#### Scenario: Initial state follows showConversationsSectionByDefault

- **WHEN** the page loads with `showConversationsSectionByDefault` disabled
- **THEN** the sidebar starts collapsed

#### Scenario: Reload starts from the default again

- **WHEN** the user collapses the sidebar and reloads the page with `showConversationsSectionByDefault` enabled
- **THEN** the sidebar starts expanded

#### Scenario: Opening the canvas keeps the sidebar expanded

- **WHEN** the sidebar is expanded and an attachment opens in the canvas
- **THEN** the sidebar stays expanded at 336px and the canvas opens beside it

#### Scenario: Expanding the sidebar keeps the canvas open

- **WHEN** the canvas is open, the sidebar is collapsed and the user expands it
- **THEN** the sidebar expands and the canvas stays open
