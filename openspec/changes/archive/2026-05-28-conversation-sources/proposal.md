## Why

Users can already attach files to user messages and receive files back from the assistant, but there is no consolidated view of every attachment and source produced inside a conversation. To browse, search, or download files later, users have to scroll through the entire message history.

This change adds a right-side panel that aggregates all conversation attachments and sources in one place, opened from a new toggle button in the chat header.

## What Changes

- Add a header toggle button (right-aligned in the existing top header) that opens and closes the right sidebar.
- Add a new lib `libs/sidebar` (package `@epam/ai-dial-sidebar`) housing the side-agnostic sidebar shell `SidebarPanel`. The shell takes a `side: 'left' | 'right'` prop and renders the panel chrome (width, header bar, action button slots, scrollable body, divider on the inner edge); it is content-agnostic, has no i18n imports (all labels via props), and exposes `colors` / `typography` props per the lib styling guide. Built to be reused by any panel on **either side** of the viewport (e.g. a left-side conversations list, a right-side settings panel) and consumable from external projects without this app's theme.
- Add a `ConversationSourcesPanel` that fills the shell with three sections:
  - **Uploaded Files** — attachments sourced from `MessageRole.User` messages.
  - **Generated Files** — attachments sourced from `MessageRole.Assistant` messages.
  - **Sources** — header only, with an empty placeholder (links are not yet produced by the backend).
- Header buttons: search, download-all, close. No business logic in this slice — search/download are wired to no-op handlers; close hides the sidebar. Buttons accept handlers via props so future slices can light them up without touching the shell.
- Reuse the existing `AttachmentCard` from `libs/conversation-input` for the file tiles. Files render in a 3-column grid (per Figma) instead of the horizontal tray used inside the input.
- Derive the file lists from `messages` already passed to `ConversationView` — no new context, no new API calls.
- New i18n keys for sidebar labels and button aria-labels.

## Capabilities

### New Capabilities

- `conversation-sources-sidebar`: The right sidebar panel that surfaces uploaded files, generated files, and sources for the active conversation; covers panel chrome, open/close from the header toggle, three sections, file derivation from messages, search/download/close header buttons (no-op for now), and accessibility.

### Modified Capabilities

- (none — no existing spec requirements change)

## Impact

- `apps/chat/src/components/Header/Header.tsx` — add a right-aligned sidebar toggle button.
- `libs/sidebar/` — new Nx lib (`@epam/ai-dial-sidebar`) containing the side-agnostic `SidebarPanel` shell, its prop interfaces, and the SCSS module with CSS-variable theming. Path alias `@epam/ai-dial-sidebar` added to `tsconfig.base.json`.
- `apps/chat/src/components/ConversationSourcesPanel/` — new content component composing `<SidebarPanel side="right">` (imported from `@epam/ai-dial-sidebar`) with the three sections.
- `apps/chat/src/components/ConversationSourcesPanel/sections/` — new section components (`UploadedFilesSection`, `GeneratedFilesSection`, `SourcesSection`).
- `apps/chat/src/context/sidebar/createSidebarContext.tsx` — new factory producing `{ Provider, useContext }` for an open/close sidebar context. `RightSidebarContext` is the first instance; a future `LeftSidebarContext` reuses the same factory.
- `apps/chat/src/context/sidebar/RightSidebarContext.tsx` — instance from the factory used by the toggle button and the right-side panel mount.
- `apps/chat/src/hooks/useConversationSources.ts` — new hook deriving Uploaded/Generated `DisplayAttachment[]` from `messages`.
- `apps/chat/src/app/app.tsx` — wraps the app in `RightSidebarProvider`; mounts the panel slot beside `<main>`.
- `apps/chat/src/i18n/locales/en.json` — new `sidebar.sources.*` keys.
- No backend (`apps/chat-api`) changes.
- No changes to `libs/chat-shared`, `libs/conversation-input`, or `libs/conversation-messages` — `AttachmentCard` is consumed as-is.
- No new npm dependencies. New peer deps for `libs/sidebar` mirror `libs/conversation-input`: `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared` (for `mergeClasses` / `buildCssVars`), `@tabler/icons-react`, `classnames`.
