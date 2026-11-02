## MODIFIED Requirements

### Requirement: The canvas panel opens beside the conversation and closes on navigation

Activating an attachment SHALL open `AttachmentCanvas` at the right edge of the conversation layout, keyed by the `attachmentId` the caller supplies. Choosing Preview on the file manager page (`/files`) SHALL open it the same way, at the right edge of that page, beside the file grid. Activating a context file card on the New project, edit and view pages (`/projects/new`, `/projects/edit/...`, `/projects/view/...`) SHALL open it on the inline-end side of that page too, beside the form or the project content, at the conversation route's default and resizable width; the container is mounted on those routes without depending on the attachments-manager overlay feature (see the `project-context-file-preview` capability). The panel SHALL close whenever the URL `pathname` changes, and SHALL be mutually exclusive with both `ConversationSourcesPanel` and the conversation history panel — opening any one of the three closes the other two, synchronously, before any content is fetched. For the canvas this runs through the host's `onBeforeOpen` option of `useOpenAttachmentCanvas`, which is called for image, file, pasted and prompt attachments but not for audio; the pathname auto-close, the `togglePanel` canvas close and the `isCanvasOpen` safety net live in `useConversationPanelRouteState`.

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

#### Scenario: A project page opens the panel at the conversation width

- **WHEN** the user activates a context file card on `/projects/view/{bucket}/{path}` on desktop
- **THEN** the panel opens on the inline-end side at the width a conversation route opens it, the page content shrinks beside it, and the user can resize it within the same bounds

#### Scenario: Leaving a project page closes the panel

- **GIVEN** a context file is open on a project page
- **WHEN** the `pathname` changes
- **THEN** `closeCanvas()` runs and the panel is closed

#### Scenario: A project page's mobile header has no sources toggle

- **WHEN** the panel is open on a project page on a mobile viewport
- **THEN** it fills the viewport and its header offers no sources-panel toggle
