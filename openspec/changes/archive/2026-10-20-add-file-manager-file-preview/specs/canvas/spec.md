# Spec Delta

## MODIFIED Requirements

### Requirement: The canvas panel opens beside the conversation and closes on navigation

Activating an attachment SHALL open `AttachmentCanvas` at the right edge of the conversation layout, keyed by the `attachmentId` the caller supplies. Choosing Preview on the file manager page (`/files`) SHALL open it the same way, at the right edge of that page, beside the file grid. The panel SHALL close whenever the URL `pathname` changes, and SHALL be mutually exclusive with both `ConversationSourcesPanel` and the conversation history panel — opening any one of the three closes the other two, synchronously, before any content is fetched. For the canvas this runs through the host's `onBeforeOpen` option of `useOpenAttachmentCanvas`, which is called for image, file, pasted and prompt attachments but not for audio; the pathname auto-close, the `togglePanel` canvas close and the `isCanvasOpen` safety net live in `useConversationPanelRouteState`.

#### Scenario: Activating an attachment opens the panel

- **WHEN** the user activates an attachment card from a message bubble, an input tray, or the sources panel
- **THEN** `openCanvas` is called with the resolved content, file name, and attachment key, and the panel renders open at the right edge

#### Scenario: Only the tile that opened the canvas reads as selected

- **GIVEN** two messages hold attachments with the same content-derived `id`
- **WHEN** one of them opens the canvas
- **THEN** only that message's tile renders selected, because the key carries the message index and each message strips its own prefix

#### Scenario: Navigating away closes the panel

- **WHEN** the `pathname` changes for a conversation switch, catalog navigation, or new chat
- **THEN** `closeCanvas()` runs and the panel is closed

#### Scenario: The panels never overlap

- **WHEN** the user opens the canvas while the sources panel or the history panel is open
- **THEN** the other panel closes immediately on click, before content resolution completes
- **AND** opening either of those panels afterwards closes the canvas

#### Scenario: The chat area keeps a minimum width

- **WHEN** the user drags the canvas resize handle on desktop on a conversation route
- **THEN** the width is clamped between 600 px and `usePanelMaxWidth()`, leaving at least 400 px of chat area
- **AND** on mobile the panel fills the viewport and is not resizable

#### Scenario: The panel on the file manager page opens at a third of the viewport

- **WHEN** the user chooses Preview on `/files` on desktop
- **THEN** the panel opens at about 33% of the viewport width, never narrower than 400 px and never wider than 640 px or `usePanelMaxWidth()`
- **AND** the user can resize it, down to 400 px

#### Scenario: Preview from the file manager opens the panel

- **WHEN** the user chooses Preview on a file row on `/files`
- **THEN** `openCanvas` is called with the resolved content and file name, and the panel renders open at the right edge beside the grid

### Requirement: The canvas is an accessible panel

`SidebarPanel` SHALL render with `role="complementary"` and the `ariaLabel` prop as its accessible name, SHALL be `inert` while closed, and SHALL expose every header control by keyboard with an `aria-label` supplied as a prop. App-level strings SHALL come from i18n — canvas-specific ones from `AttachmentCanvasI18nKeys`, copy/retry/reload labels from `ButtonsI18nKeys` — with the lib carrying English defaults. The capability SHALL NOT be gated behind `ENABLED_FEATURES`; the app renders the canvas on conversation routes only when the `OverlayFeature.AttachmentsManager` UI feature is enabled, and on the file manager route (`/files`) regardless of that feature.

#### Scenario: The panel is a named landmark

- **WHEN** the canvas is open
- **THEN** it exposes `role="complementary"` named by `ariaLabel`, and its close, download, and copy buttons are reachable by Tab with their own labels

#### Scenario: A closed panel is hidden from assistive tech

- **WHEN** the canvas is closed
- **THEN** the panel's `role="complementary"` element carries `inert`, so neither it nor its controls are focusable or exposed to assistive tech

#### Scenario: The canvas follows the AttachmentsManager UI feature

- **WHEN** `OverlayFeature.AttachmentsManager` is disabled and the current route is a conversation route
- **THEN** `AttachmentCanvasContainer` is not rendered

#### Scenario: The canvas is not rendered on other routes

- **WHEN** the current route is neither a conversation route nor `/files`
- **THEN** `AttachmentCanvasContainer` is not rendered

#### Scenario: The file manager route renders the canvas without the AttachmentsManager feature

- **WHEN** the current route is `/files` and `OverlayFeature.AttachmentsManager` is disabled
- **THEN** `AttachmentCanvasContainer` is rendered, so Preview from the file manager can open the panel
