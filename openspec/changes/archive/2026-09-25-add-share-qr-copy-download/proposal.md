## Why

The share popover's QR view (`libs/share/src/components/SharePopover/SharePopover.tsx:273`) renders a scannable code but offers no way to take it anywhere: a user who wants to drop the QR into a slide, a chat message, or a printed handout has to screenshot the popover. The design adds two actions under the code — **Copy** and **Download** — so the QR can leave the popover as a proper image.

## What Changes

- The QR view of `SharePopover` gains an action row directly under the QR frame (and above the expiry note) with two text+icon buttons:
  - **Copy** — writes the QR code as a PNG image to the clipboard. Shows a transient "Copied" confirmation (icon swaps to a check, label changes) and announces it through an `aria-live` region, mirroring the link view's copy feedback (`libs/share/src/components/LinkView/LinkView.tsx`). When the browser cannot put an image on the clipboard (no `ClipboardItem`/`clipboard.write`, or the write is rejected), it falls back to copying the share URL as text — the confirmation still shows because the user got something useful.
  - **Download** — saves the QR code as a PNG file (default name `share-qr-code.png`, host-overridable).
- The PNG is rasterized client-side from the already-rendered `react-qr-code` SVG: fixed dark-on-white colours and a quiet-zone margin so the exported image scans regardless of the active theme (the on-screen QR follows the theme's `--qr-color`, which may be light in dark themes).
- `QrCode` stays a pure renderer. The action row is a new internal `QrActions` component inside `libs/share`, rendered by `SharePopover` only in the QR view.
- New optional `SharePopoverLabels` fields with English defaults: `qrCopyButtonLabel` ("Copy"), `qrCopiedButtonLabel` ("Copied"), `qrDownloadButtonLabel` ("Download"), `qrDownloadFileName` ("share-qr-code.png").
- No new colour tokens: the buttons are the kit's `GhostButton`, the same control the header's QR/Link toggle uses (`libs/share/src/components/SharePopover/SharePopoverHeader.tsx:45`), so they inherit its accent treatment and theming.
- Apps: `SharePopoverContainer` and `ShareConversationPopoverContainer` pass translated labels (`buttons.copy`, `share.copiedButtonLabel`, `buttons.download` already exist; only a filename key is new, if localised at all — see design).
- Non-breaking: every new prop is optional; hosts that pass nothing get the design out of the box.

### Non-goals

- No change to the link view, access control, loading/error states, or the QR↔Link toggle.
- No SVG export, no "share via…" (Web Share API), no configurable image size.
- No backend/API change — the share URL is already resolved by the host.
- `QrCode` used standalone (exported from the package) does **not** gain the actions; only the popover's QR view does.

### Alternatives considered

- *Copy = copy the link text* (conservative baseline) — trivially reliable, but duplicates the link view's copy button and doesn't match the intent of a "copy" action that sits under an image. Kept only as the fallback path.
- *Put actions inside `QrCode`* — would force the image/clipboard behaviour on every standalone `QrCode` consumer and blur its "pure renderer" contract. Rejected.
- *New dependency (e.g. `html-to-image`, `qrcode` for canvas output)* — unnecessary: serialising the existing SVG into a canvas is ~30 lines and adds no bundle weight. Rejected.

## Capabilities

### New Capabilities

- `share-popover-qr-actions`: Copy-as-image and download-as-PNG actions in the share popover's QR view, their fallback, feedback, accessibility, and host overrides.

### Modified Capabilities

<!-- None. `conversation-share` only references `SharePopover`'s existing labels; its requirements do not change. -->

## Impact

- **`libs/share`** (shared lib — scope note: touches a publishable package's public prop types):
  - new `components/QrActions/QrActions.tsx` (+ tests), a small `utils/qr-image.ts` (SVG → PNG blob) with tests;
  - `SharePopover.tsx`, `models/share-popover-props.ts`, `README.md`.
  - Library isolation: the lib only needs the already-passed `url`, the rendered SVG node, and label strings. It constructs no URL, reads no app state, and decides no filename policy beyond an overridable default. Clipboard/download use browser primitives through `@epam/ai-dial-chat-shared` (`copyToClipboard` at `libs/chat-shared/src/utils/copy-to-clipboard.ts`, `triggerBlobDownload` at `libs/chat-shared/src/utils/file-download.ts:114`), which `libs/share` already peers on.
  - No new dependencies (`@tabler/icons-react` already provides `IconCopy`, `IconDownload`, `IconCheck`).
- **`apps/chat`**: the two share popover containers pass the new labels via `t()`; i18n reuses `buttons.copy`, `buttons.download`, `share.copiedButtonLabel` and may add `share.qrDownloadFileName`.
- **i18n**: at most one new key in `apps/chat/src/i18n/locales/en.json` (`share.qrDownloadFileName`).
- **Docs**: `libs/share/README.md` (new labels), run `npm run validate:docs`.

### Acceptance criteria

- In the QR view, Copy and Download buttons render under the QR code, matching the design (accent text+icon buttons, centred row, above the expiry note).
- Copy puts a PNG of the QR on the clipboard in Chromium, Firefox ≥ 127 and Safari; the pasted image scans to the share URL. Where image clipboard is unavailable, the URL text is copied instead.
- After Copy, the button shows "Copied" with a check icon for the standard reset delay and a screen reader hears "Copied".
- Download saves `share-qr-code.png` (or the host-supplied name); the file scans to the share URL in light and dark themes.
- Both buttons are keyboard reachable inside the popover's Tab trap; Escape still returns to the link view.
- All new strings are overridable via `labels`; the chat app passes translations.
- `libs/share` and `apps/chat` tests, lint and `npm run validate:docs` pass.

### Rollback

Purely additive UI inside one lib plus label wiring in two app containers. Revert the commit; no data, API, or persisted state is involved.
