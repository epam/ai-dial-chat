## ADDED Requirements

### Requirement: QR view shows Copy and Download actions

When `SharePopover` is in the QR view with a resolved share URL (not loading, no error), it SHALL render a centred action row directly below the QR code and above the expiry note, containing a **Copy** button and a **Download** button, in that order. Each button SHALL be the UI kit's `GhostButton` with a visible text label and a leading Tabler icon (`IconCopy`, `IconDownload`) rendered with `stroke={DIAL_KIT_ICON_STROKE}` and `aria-hidden`. The action row SHALL NOT render in the link view, while loading, or when an error is shown. State is local to the lib's internal `QrActions` component; no host context or hook owns it. The feature is not gated behind `ENABLED_FEATURES`.

#### Scenario: Actions appear in the QR view

- **WHEN** the user switches the popover to the QR view with a resolved URL
- **THEN** a "Copy" button and a "Download" button are rendered below the QR code image
- **AND** the expiry note, when supplied, renders below the action row

#### Scenario: Actions absent outside the QR view

- **WHEN** the popover is in the link view, or `isLoading` is true, or `error` is set
- **THEN** neither the QR "Copy" nor the "Download" button is rendered

### Requirement: Copy puts the QR image on the clipboard

Activating **Copy** SHALL write a PNG image of the QR code (`image/png`) to the system clipboard using `navigator.clipboard.write` with a `ClipboardItem`. The clipboard write SHALL be initiated synchronously within the click handler (the image blob passed as a promise) so browsers that require a user gesture accept it. The PNG SHALL encode the same value as the on-screen QR, drawn dark (`#000000`) on a white (`#ffffff`) background with a quiet-zone margin, independent of the active theme.

#### Scenario: Image copied in a supporting browser

- **WHEN** the browser supports `ClipboardItem` and `clipboard.write`, and the user activates Copy
- **THEN** `clipboard.write` is called once with a `ClipboardItem` whose `image/png` entry resolves to a PNG blob
- **AND** the button enters the copied state

#### Scenario: Exported image ignores dark theme colours

- **WHEN** the active theme renders the on-screen QR with a light fill colour and the user copies or downloads it
- **THEN** the produced PNG uses dark modules on a white background

### Requirement: Copy falls back to the share URL text

If the image cannot be copied — `ClipboardItem` or `clipboard.write` is unavailable, the QR SVG is not available, rasterization fails, or the clipboard write rejects — Copy SHALL copy the share URL as plain text via `copyToClipboard` from `@epam/ai-dial-chat-shared`. If the text copy succeeds, the button SHALL enter the copied state; if it also fails, the button SHALL stay in its default state and no error SHALL be thrown.

#### Scenario: Browser without image clipboard support

- **WHEN** `ClipboardItem` is undefined and the user activates Copy
- **THEN** `copyToClipboard` is called with the share URL
- **AND** the button enters the copied state

#### Scenario: Image write rejected

- **WHEN** `clipboard.write` rejects and the user activated Copy
- **THEN** `copyToClipboard` is called with the share URL

#### Scenario: Every copy path fails

- **WHEN** both the image write and the text fallback fail
- **THEN** the button keeps its default label and icon and no uncaught error is raised

### Requirement: Copy confirmation feedback

In the copied state the Copy button SHALL show the copied label (default "Copied") and a check icon (`IconCheck`) in place of the copy icon, and a visually hidden `role="status"` `aria-live="polite"` region SHALL contain the copied label. The copied state SHALL reset to the default label and icon after the same delay `useCodeCopy` uses (`DEFAULT_RESET_DELAY_MS`), and any pending reset timer SHALL be cleared on unmount. The button element SHALL NOT be remounted by the state change, so keyboard focus stays on it.

#### Scenario: Confirmation shown and announced

- **WHEN** a copy succeeds
- **THEN** the Copy button's label reads "Copied" and shows a check icon
- **AND** the status region contains "Copied"
- **AND** focus remains on the same button

#### Scenario: Confirmation resets

- **WHEN** the reset delay elapses after a successful copy
- **THEN** the button label returns to "Copy" with the copy icon and the status region is empty

### Requirement: Download saves the QR as a PNG file

Activating **Download** SHALL rasterize the QR code to a PNG (same colours and margin as Copy) and trigger a browser download via `triggerBlobDownload` from `@epam/ai-dial-chat-shared`, using the filename from `labels.qrDownloadFileName` (default `share-qr-code.png`). If rasterization fails, no download SHALL be triggered and no uncaught error SHALL be raised.

#### Scenario: Default filename

- **WHEN** the host supplies no `qrDownloadFileName` and the user activates Download
- **THEN** `triggerBlobDownload` is called with a `image/png` blob and the filename `share-qr-code.png`

#### Scenario: Host-supplied filename

- **WHEN** the host passes `labels.qrDownloadFileName = 'my-agent-qr.png'` and the user activates Download
- **THEN** the download uses the filename `my-agent-qr.png`

#### Scenario: Rasterization failure

- **WHEN** producing the PNG fails
- **THEN** `triggerBlobDownload` is not called and the popover stays open and usable

### Requirement: QR action labels are host-overridable with English defaults

`SharePopoverLabels` SHALL accept the optional fields `qrCopyButtonLabel` (default "Copy"), `qrCopiedButtonLabel` (default "Copied"), `qrDownloadButtonLabel` (default "Download"), and `qrDownloadFileName` (default "share-qr-code.png"). The lib SHALL NOT import i18n. The chat app's `SharePopoverContainer` and `ShareConversationPopoverContainer` SHALL pass `t(ButtonsI18nKeys.Copy)` (`buttons.copy`), `t(ShareI18nKeys.CopiedButtonLabel)` (`share.copiedButtonLabel`), `t(ButtonsI18nKeys.Download)` (`buttons.download`), and `t(ShareI18nKeys.QrDownloadFileName)` (new key `share.qrDownloadFileName`, English value `share-qr-code.png`).

#### Scenario: Custom labels rendered

- **WHEN** the host passes `qrCopyButtonLabel: 'Kopieren'` and `qrDownloadButtonLabel: 'Herunterladen'`
- **THEN** the QR action buttons display "Kopieren" and "Herunterladen"

#### Scenario: Defaults without labels

- **WHEN** the host passes no QR action labels
- **THEN** the buttons display "Copy" and "Download" and the copied state displays "Copied"

### Requirement: QR actions are keyboard accessible and direction-agnostic

Both QR action buttons SHALL be reachable with Tab and Shift+Tab inside the popover's existing focus trap and operable with Enter and Space. Pressing Escape while either button is focused SHALL return the popover to the link view (existing behaviour). The action row SHALL be centred and use gap-based spacing only, so it renders identically in LTR and RTL; the copy, check and download icons SHALL NOT be mirrored in RTL.

#### Scenario: Tab cycles through the actions

- **WHEN** the popover is in the QR view and the user presses Tab repeatedly
- **THEN** focus visits the header Link button, the access control (when editable), Copy, and Download, then wraps within the popover

#### Scenario: Escape from an action returns to link view

- **WHEN** focus is on the Download button and the user presses Escape
- **THEN** the popover switches to the link view and does not close

### Requirement: QrCode exposes its SVG element

The exported `QrCode` component SHALL accept an optional `svgRef` prop that receives the rendered `<svg>` element, so `SharePopover` can rasterize the exact code shown. Omitting `svgRef` SHALL leave `QrCode`'s rendering and behaviour unchanged; `QrCode` itself SHALL NOT render any action buttons.

#### Scenario: Ref receives the SVG

- **WHEN** `QrCode` is rendered with `svgRef`
- **THEN** the ref's `current` is the rendered `SVGSVGElement`

#### Scenario: Standalone QrCode unchanged

- **WHEN** `QrCode` is rendered without `svgRef`
- **THEN** it renders only the framed QR image with no Copy or Download controls
