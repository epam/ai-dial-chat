# Tasks

Slicing strategy: vertical. The first group is a working end-to-end path on `/files`, already implemented on `feat/file-manager-preview`; the remaining groups close the gaps (route tests, spec and docs sync, verification).

## 1. Shell props (done)

- [x] 1.1 Add optional `previewLabel`, `onPreview`, `previewExtensions` to `DialFileManagerShell` in `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`: forward the callback and extensions to `DialFileManager`, add Preview to the grid action labels only when the label is set, and keep Info working beside it. Verification: `npm run test:file -- apps/chat/src/components/DialFileManagerShell/tests/DialFileManagerShell.spec.tsx` (Preview describe block).

## 2. Host hook and page wiring (done)

- [x] 2.1 Create `apps/chat/src/hooks/files/useDialFilePreview.ts`: find the file by path in the loaded tree, convert with `dialFileToAttachment`, open through `useOpenAttachmentCanvas` with `useAttachmentCanvasResolvers`, export the fixed extension list. Verification: `npm run test:file -- apps/chat/src/hooks/files/tests/useDialFilePreview.spec.ts`.
- [x] 2.2 Wire the hook and the `basic.preview` label into `DialFileManagerPage` and mock the hook in the page spec. Verification: `npm run test:file -- apps/chat/src/pages/DialFileManagerPage/tests/DialFileManagerPage.spec.tsx`.

## 3. Canvas on the file manager route

- [x] 3.1 Forward an optional `minWidth` from `AttachmentCanvasContainer` to `AttachmentCanvas` in `libs/attachment-canvas`, document it in the README, and correct the `minWidth` JSDoc default in `libs/attachment-canvas/src/models/attachment-canvas.ts`. Verification: `npm run test:file -- libs/attachment-canvas/src/components/AttachmentCanvasContainer/tests/AttachmentCanvasContainer.spec.tsx`.
- [x] 3.2 Mount the container on `/files` and give that route its own `minWidth` and default width in `apps/chat/src/app/app.tsx`, with the constants in `apps/chat/src/constants/layout.ts`. Verification: covered by 3.3 and 3.4.
- [x] 3.3 Cover the route behavior in `apps/chat/src/app/tests/app.spec.tsx`: the container is rendered on `/files` with `AttachmentsManager` disabled, is not rendered on conversation routes when the feature is disabled, and receives `minWidth` 400 only on `/files`. Verification: `npm run test:file -- apps/chat/src/app/tests/app.spec.tsx`.
- [x] 3.4 Extract the width calculation from `app.tsx` into the pure helper `resolveCanvasWidth` in `apps/chat/src/utils/canvas-width.ts` and unit-test its bounds (narrow, typical and wide viewports, and the `usePanelMaxWidth` cap). Verification: `npm run test:file -- apps/chat/src/utils/tests/canvas-width.spec.ts`.

## 4. Specs and docs

- [x] 4.1 Update the prose sections of `openspec/specs/canvas/spec.md` that archive does not sync: Open behavior step 5 (`AttachmentCanvasContainer` is also rendered on `/files`), the Layout width bullets (the `/files` bounds and `minWidth` prop) and the "Feature flag" paragraph. Verification: `npm run validate:specs`.
- [x] 4.2 Run `npm run validate:docs` and `npm run validate:specs`; confirm no other doc (`docs/architecture.md`, `libs/attachment-canvas/README.md`) still states that the canvas is conversation-only. Verification: both commands pass.

## 5. Integration

- [x] 5.1 Run `npm run verify:changed` once; check `/files` with the preview panel at a narrow window and on the phone breakpoint, and note any gap as a follow-up (the phone behavior is deliberately out of scope). Verification: the command passes.
- [x] 5.2 Close the change with one `npm run verify:full`, then `/opsx:archive` to sync the delta specs into `openspec/specs/`.
