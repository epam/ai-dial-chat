## ADDED Requirements

### Requirement: Tablet canvas overlays without changing conversation or page width

At 768px inclusive through less than 1280px, `AttachmentCanvasContainer` in `libs/attachment-canvas/src/components/AttachmentCanvasContainer/AttachmentCanvasContainer.tsx` SHALL support the bounded tablet-overlay contract, adopted by `apps/chat/src/app/app.tsx` for every canvas mount. Within this range this requirement supersedes the earlier Layout subsection's full-viewport mobile sizing, layout-space reservation and physical-right anchoring: the panel SHALL use logical inline-end anchoring and leave at least 32px of underlying content visible. Outside this range existing canvas behavior SHALL remain unchanged.

`AttachmentCanvasContext` SHALL continue to own canvas state. Existing content resolution, source/canvas exclusion, route close behavior, availability gates, error/loading states, download labels and host integration callbacks SHALL remain unchanged. Tablet bounds SHALL cap the existing 600px canvas and 400px file-manager minima when necessary without overwriting desktop size preference. No new state provider, flag, cache, telemetry or i18n keys are required.

#### Scenario: Canvas mounts share tablet behavior
- **WHEN** a conversation attachment, project preview, file-manager preview or MCP content opens a canvas at 768, 1024 or 1279px
- **THEN** the canvas overlays the content, uses bounded panel-specific width and leaves the close button accessible

#### Scenario: Sources and canvas exclusion survives
- **WHEN** the user switches between sources and a canvas preview on tablet
- **THEN** the existing mutual-exclusion behavior is retained without changing navigation or conversation-panel state

#### Scenario: Desktop restoration
- **WHEN** an open canvas returns from tablet to 1280px
- **THEN** existing desktop sizing and layout behavior resume within desktop bounds

