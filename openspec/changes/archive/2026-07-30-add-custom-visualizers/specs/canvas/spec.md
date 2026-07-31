## ADDED Requirements

### Requirement: `AttachmentContentType.Visualizer` variant

`libs/attachment-canvas/src/types/attachment-canvas.ts` SHALL add a new enum member `AttachmentContentType.Visualizer`.

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL add a new member to the `AttachmentCanvasContent` discriminated union:

```ts
interface VisualizerCanvasContent {
  type: AttachmentContentType.Visualizer;
  url: string;                              // iframe src, from the registry entry's `url`
  mimeType: string;                         // the attachment's own MIME (NOT the entry's raw
                                            // `contentType`, which may be a comma-separated list)
  data: unknown;                            // opaque attachment payload consumed by the visualizer
  layout: CustomVisualizerDataLayout;       // themeId, width, height, mobileHeight
  visualizerName: string;                   // postMessage type prefix — MUST be the registry
                                            // entry's `title`; the iframe app is constructed
                                            // with the identical string or nothing is received
  requestTimeout?: number;                  // from the registry entry; bounds send(), default
                                            // 10000ms. Does NOT bound the handshake.
}
```

`isDownloadable(content)` SHALL return `false` for a `VisualizerCanvasContent` value.

**RTL impact:** none directly; canvas panel chrome already handles direction.

**i18n impact:** none; visualizer chrome carries no lib-side user-visible strings.

#### Scenario: Visualizer content is not downloadable

- **WHEN** the canvas is opened with a `VisualizerCanvasContent` and `onDownload` is provided
- **THEN** the download button in the canvas header is not rendered

#### Scenario: Panel opens with visualizer content

- **WHEN** `openCanvas` is called with a `VisualizerCanvasContent` and `fileName`
- **THEN** `AttachmentCanvasContext.content` equals the passed content
- **AND** `AttachmentCanvasContainer` re-renders with the panel open and the visualizer renderer inside

---

### Requirement: `VisualizerCanvasRenderer` component

`libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx` SHALL render an iframe host and drive the visualizer handshake and data delivery via the published npm package `@epam/ai-dial-visualizer-connector` (and `@epam/ai-dial-shared` for the request enum). Behaviour:

- On mount, create a `VisualizerConnector` bound to the container element, passing `domain: content.url`, `hostDomain: window.location.origin` (required by the published options type; unused at runtime in the current package), `visualizerName: content.visualizerName`, and `requestTimeout: content.requestTimeout`.
- Await `.ready()` and then call `.send(VisualizerConnectorRequests.sendVisualizeData, { mimeType: content.mimeType, visualizerData: { layout: content.layout, ...content.data } })`, where `VisualizerConnectorRequests` is imported from `@epam/ai-dial-shared` (camelCase member; wire value `SEND_VISUALIZE_DATA`).
- On unmount, call `connector.destroy()` exactly once for that instance.
- Display a loading state while `.ready()` is pending. Because `.ready()` never times out (see the `custom-visualizers` capability), a visualizer that never completes the handshake leaves the body in this loading state indefinitely — this is intended. Display an error state if the `SEND_VISUALIZE_DATA` `send()` rejects (its own timeout) or if `.ready()` rejects due to `destroy()`.
- The component SHALL keep the connector instance stable across parent re-renders that do not change `url` / `visualizerName` / `requestTimeout`, so those re-renders do not tear down the iframe.

The component MUST NOT read from any app-level context (auth, theme, i18n, feature flags) — all data required for the visualizer is passed in through `VisualizerCanvasContent`.

#### Scenario: connector is destroyed on unmount

- **WHEN** the `VisualizerCanvasRenderer` unmounts
- **THEN** `VisualizerConnector.destroy()` is called
- **AND** the iframe element is removed from the DOM

#### Scenario: SEND_VISUALIZE_DATA is dispatched after READY_TO_INTERACT

- **WHEN** the iframe posts `${visualizerName}/READY_TO_INTERACT`
- **THEN** the renderer calls `connector.send` with the published enum member whose wire value is `SEND_VISUALIZE_DATA` exactly once
- **AND** the payload's `layout` equals `content.layout`

#### Scenario: send failure surfaces error state

- **WHEN** the `SEND_VISUALIZE_DATA` `send()` promise rejects (no `/RESPONSE` within `requestTimeout`)
- **THEN** the renderer displays an error state
- **AND** the canvas remains closable via the header's close button

#### Scenario: incomplete handshake stays in the loading state

- **WHEN** the iframe mounts but never posts `READY_TO_INTERACT`
- **THEN** the renderer keeps showing the loading state and does not show an error
- **AND** the canvas remains closable via the header's close button

---

### Requirement: `AttachmentCanvas` switch handles Visualizer variant

`libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx` SHALL extend its switch over `AttachmentContentType` with a `case AttachmentContentType.Visualizer` branch that renders `<VisualizerCanvasRenderer content={content} />` inside the panel body.

The panel chrome (header, close button, resize handle, keyboard/ARIA behaviour) SHALL be identical to the chrome used for other content types.

**Feature flag:** none. The variant is reachable only when the app builds a `VisualizerCanvasContent` from a populated registry.

#### Scenario: rendering switch dispatches to the visualizer branch

- **WHEN** `AttachmentCanvas` is rendered with a `VisualizerCanvasContent`
- **THEN** the panel body contains a mounted `VisualizerCanvasRenderer`
- **AND** the panel header renders the `fileName` as usual

---

### Requirement: `useOpenAttachmentCanvas` dispatches to the visualizer branch before content-type handling

`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`'s internal `openFileCanvas` SHALL check the attachment's `contentType` against the `CustomVisualizer[]` registry (via `useCustomVisualizers()` and a case-insensitive `findVisualizerForMime` lookup) as the FIRST case in its `switch (contentType)` block — evaluated before the existing `MIMEType.PDF`, `MIMEType.Markdown`, and `MIMEType.JSON` cases.

When a match is found:

- The hook fetches the attachment payload using the same file-content helper already used for text/JSON attachments.
- On success, it builds a `VisualizerCanvasContent`: `url` from the registry entry, `mimeType` from the attachment's own `contentType`, `data` from the fetched payload, `layout` with `width`/`height`/`mobileHeight` from the registry entry plus `themeId` from theme context, `visualizerName` from the registry entry's `title`, and `requestTimeout` from the registry entry. It returns this for `openCanvas`.
- On payload-fetch failure, the hook falls through to the existing switch/extension/`Unsupported` handling (unchanged behaviour).

When the registry is empty or no entry matches, `openFileCanvas` behaves exactly as it did before this change.

`apps/chat/src/hooks/attachment/useAttachmentAction.ts` is NOT modified by this change. It only runs as a fallback when `openAttachmentCanvas` returns `false` (see this capability's "Open triggers" table), and a matched visualizer MIME always causes `openAttachmentCanvas` to return `true` — so `useAttachmentAction` would never observe a visualizer-eligible attachment.

**Feature flag:** none. The `CUSTOM_VISUALIZERS` env is the effective gate.

**RTL impact:** none. Canvas chrome already handles direction.

**i18n impact:** none new. Existing labels are reused.

#### Scenario: MIME matches a visualizer registry entry from a message bubble click

- **WHEN** `handleMessageAttachmentClick` (`ConversationView.tsx`) is invoked for an attachment whose `contentType` matches a `customVisualizers` entry
- **THEN** `openAttachmentCanvas` resolves a `VisualizerCanvasContent` and calls `openCanvas` with it
- **AND** the panel opens with the visualizer renderer, not the PDF/Markdown/JSON/Unsupported branch

#### Scenario: MIME matches but payload fetch fails — falls back to existing handling

- **WHEN** the registry contains a matching entry but fetching the attachment payload rejects
- **THEN** `openFileCanvas` falls through to the existing `contentType`/extension switch for that attachment

#### Scenario: Registry is empty — behaviour unchanged

- **WHEN** the `customVisualizers` registry is `[]`
- **THEN** `openFileCanvas` behaves exactly as it did before this change

#### Scenario: MIME does not match any registry entry

- **WHEN** the registry contains only `contentType: 'application/x-my-viz'` and the attachment's `contentType` is `'application/pdf'`
- **THEN** the visualizer branch does not fire; the existing `MIMEType.PDF` case handles the attachment
