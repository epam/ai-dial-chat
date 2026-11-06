## Why

Refactoring item F7. How an attachment is handled depends on its content type, and that decision is spread across repeated switches.

**In `libs/attachment-canvas`:**

- `utils/download.ts` has three switches on `content.type`:
  - `isDownloadable`;
  - `getContentUrlAndMimeType`;
  - `downloadAttachmentContent`.

  They have drifted: `GroupedVisualizer` is non-downloadable in the first but missing from the third, which ends with no `default`.
- `components/AttachmentCanvasBody/AttachmentCanvasBody.tsx` maps each content type to a body container class with a switch.
- `hooks/useOpenAttachmentCanvas/useOpenAttachmentCanvas.ts` routes an attachment to a resolver with two more switches: one on the MIME type, then one on the file extension.

**MIME strings are written as literals** in places that should use the shared `MIMEType` enum from `@epam/ai-dial-chat-shared`:

- `libs/attachment-input/src/utils/attachment.ts`: the `getAttachmentIcon` switch, about 30 cases;
- `libs/attachment-canvas/src/utils/download.ts`: the OOXML MIME map.

Adding a content type means finding and updating every switch, and nothing fails when one is missed.

## What Changes

- **One download strategy per content type.** `download.ts` gets a `DOWNLOAD_STRATEGIES` table keyed by `AttachmentContentType`, typed as a mapped type over the content union.
  - Each entry declares `isDownloadable`, `urlAndMimeType` and `download` for its own content shape.
  - A missing content type is a compile error.
  - `isDownloadable` and `downloadAttachmentContent` keep their exported signatures and behavior, and dispatch through the table.
- **Body container classes.** `bodyContainerClassName` becomes a `Record<AttachmentContentType, string>` lookup.
- **Open routing.** The MIME and extension switches in `useOpenAttachmentCanvas` become two lookups from `MIMEType`/`FileExtension` to the resolver to call. Each branch keeps its own fallback: the MIME branch falls back to Unsupported content, and the extension branch returns `false`.
- **Shared MIME constants.** `MIMEType` gains the members `attachment-input` and the canvas spell as literals: Word, Excel, PowerPoint (legacy and OOXML), RAR, 7z, TAR, SQL, JSX, TSX, PHP, Rust and Vue. This is additive to the public enum.
  - `getAttachmentIcon` reads a `MIMEType` → icon lookup, plus an image sub-lookup.
  - The canvas OOXML map uses the new members.

### Non-goals

- **The renderer switch in `AttachmentCanvasBody`.** Its branches read about 25 component-local values (labels, typography, PDF retry and reload state). A renderer registry would need them all passed as one context object, which hides what each renderer depends on (design D3).
- **Behavior.** No change to downloads, routing, icons or rendering.

## Capabilities

### New Capabilities

- `attachment-content-type-dispatch`: content-type-dependent download and open routing go through exhaustive lookups, and MIME strings come from `MIMEType`.

### Modified Capabilities

None.

## Impact

- **Libs:**
  - `attachment-canvas`: `utils/download.ts`, `AttachmentCanvasBody.tsx`, `useOpenAttachmentCanvas.ts`;
  - `attachment-input`: `utils/attachment.ts`;
  - `chat-shared`: `types/mime-type.ts` and its README if it lists the members.
- **Unaffected:**
  - public signatures, apart from the additive `MIMEType` members;
  - `apps/chat`.
