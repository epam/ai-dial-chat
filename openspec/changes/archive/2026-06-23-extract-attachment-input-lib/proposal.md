## Why

Attachment UI components (AttachmentCard, AttachmentTray, AddAttachmentButton, FileDndOverlay) and their supporting utilities are currently embedded inside `libs/conversation-input`, a library whose name and responsibility is the conversational text input. This co-location makes it impossible for other surfaces (e.g., a future panel or edit flow) to reuse attachment UI without pulling in the entire input lib. Extracting them into a dedicated `libs/attachment-input` library gives attachment components a clear home, enforces the single-responsibility principle at the library level, and enables future reuse without coupling.

## What Changes

- **New library `libs/attachment-input`** is created under `libs/attachment-input/` with its own `project.json`, `tsconfig`, and `index.ts`.
- The following are **moved** from `libs/conversation-input` to `libs/attachment-input`:
  - Components: `AttachmentCard`, `AttachmentTray`, `AddAttachmentButton`, `FileDndOverlay`
  - Hook: `useClipboardPaste`
  - Models: `AttachmentCard.ts`, `AttachmentTray.ts`, `FileDndOverlay.ts`
  - Utils: `generateAttachmentId.ts`, `getAttachmentCardState.ts`, `getAttachmentIcon.ts`
  - Constants: `upload.ts` (lib-level upload constraints)
- The following is **moved** from `apps/chat/src/utils/` to `libs/attachment-input` (pure logic, no app dependencies):
  - `attachment-mime.ts` (`mimeTypesToExtensionLabels`, `isMimeTypeAllowed`)
- `libs/conversation-input` is updated to **import** the moved symbols from `@epam/ai-dial-attachment-input/*` instead of owning them.
- `apps/chat` import paths for any symbols now in the new lib are updated.
- A new path alias `@epam/ai-dial-attachment-input/*` → `libs/attachment-input/*` is registered in `tsconfig.base.json` and Vite config.

## Capabilities

### New Capabilities

- `attachment-input-lib`: The `@epam/ai-dial-attachment-input` library — its public API (exports, prop contracts) and internal isolation boundary (what it may and may not import).

### Modified Capabilities

<!-- No spec-level behavior changes. This is a structural refactor; all existing attachment behavior is preserved. -->

## Impact

- **libs/conversation-input**: Loses ownership of attachment components/utils; gains a dependency on `@epam/ai-dial-attachment-input`.
- **apps/chat**: `attachment-mime.ts` moves out of `src/utils/`; import paths in the app update accordingly.
- **No behavior change**: All existing features (file attach, drag-and-drop, clipboard paste, MIME validation) are unchanged.
- **No API changes**.
- **Breaking change for external consumers**: None expected — `libs/conversation-input` will re-export the moved symbols from its own `index.ts` to preserve any existing `@epam/ai-dial-conversation-input/*` import paths.
