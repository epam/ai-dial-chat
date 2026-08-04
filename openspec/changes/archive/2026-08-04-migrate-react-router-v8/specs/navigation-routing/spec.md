## MODIFIED Requirements

### Requirement: Client-side routing resolves three top-level routes

The application SHALL declare three routes using React Router `<Routes>` in `apps/chat/src/app/app.tsx`. The `/` route MUST render `<ConversationRoute>` (the welcome screen — no longer holds message state). The `/catalog` route MUST render a lazy-loaded `<CatalogView>` stub. The `/conversations/:conversationId` route MUST render a lazy-loaded `<ConversationPage>`. Any unregistered path MUST NOT match these routes without an explicit fallback route.

#### Scenario: Root path renders the welcome screen

- **WHEN** the browser navigates to `/`
- **THEN** `<ConversationRoute>` is mounted and the welcome screen is visible with no message history

#### Scenario: Catalog path renders the catalog stub

- **WHEN** the browser navigates to `/catalog`
- **THEN** the lazy-loaded `<CatalogView>` is mounted and a "coming soon" placeholder is visible

#### Scenario: Conversation path renders the conversation page

- **WHEN** the browser navigates to `/conversations/<id>`
- **THEN** the lazy-loaded `<ConversationPage>` is mounted

#### Scenario: CatalogView is lazy-loaded

- **WHEN** the JS bundle is evaluated
- **THEN** `CatalogView` code is NOT included in the initial bundle; it is loaded on demand via `React.lazy`

#### Scenario: ConversationPage is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/conversations/:id`
- **THEN** `ConversationPage` code is NOT included in the initial bundle; it is loaded on demand via `React.lazy`
