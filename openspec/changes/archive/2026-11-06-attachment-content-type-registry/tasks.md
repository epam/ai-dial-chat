Branch: `refactor/attachment-content-type-registry`, from `development`, in the worktree `C:/projects/wt-f7`. Its `node_modules` overlays the main checkout's and points `@epam/*` at the worktree's own libs. Per-slice check: the touched lib's vitest suite, ESLint on the touched files, and `tsc` on the lib.

## 1. Shared MIME constants

- [x] 1.1 Add the `MIMEType` members listed in design D4 to `libs/chat-shared/src/types/mime-type.ts`, and update the `chat-shared` README if it lists the members.
- [x] 1.2 Rewrite `getAttachmentIcon` in `libs/attachment-input/src/utils/attachment.ts` as `MIMEType` → icon lookups, preserving every mapping. No spec covered it. `utils/tests/attachment-icon.spec.ts` now pins all 35 mappings: it was written against the old switch, then passed against the lookups. attachment-input: 179 of 179.

## 2. Download strategies

- [x] 2.1 Replace the three switches in `libs/attachment-canvas/src/utils/download.ts` with the `DOWNLOAD_STRATEGIES` table (design D1). The OOXML MIME map uses the new members. The download specs pass unedited (10 of 10). `constants/file.ts` `OOXML_MIME_TYPES` also uses the new members.

## 3. Lookups

- [x] 3.1 `bodyContainerClassName` in `AttachmentCanvasBody.tsx` becomes an exhaustive lookup (`constants/canvas-body.ts`). AttachmentCanvasBody specs: 40 of 40.
- [x] 3.2 Replace the MIME and extension switches in `useOpenAttachmentCanvas.ts` with lookups that keep each branch's fallback (design D2). The hook's specs pass unedited. The lookups are in `constants/open-routing.ts`, keyed to the `OpenResolverName` enum (`types/open-resolver.ts`), whose values are the resolver method names. attachment-canvas src: 457 of 457.

## 4. Close

- [x] 4.1 Run lint, test, build and typecheck for `chat-shared`, `attachment-input`, `attachment-canvas` and `apps/chat`.

  The first full run found two regressions, both now fixed:
  - **Package size.** `attachment-canvas`'s `package-artifact-size` budget was exceeded by 565 bytes (255,065 > 254,500). The strategy table was compacted with `textStrategy`/`urlStrategy` factories and a shared `NOT_DOWNLOADABLE` entry, and the size check now passes without raising the budget.
  - **Eager icons.** Two `apps/chat` `ConversationPanelView` specs mock `@tabler/icons-react` partially, and the icon tables read every glyph at module load. The tables are now built on first use, as the old switch was.

  Final result: `nx run-many -t lint test` on the four projects (with 38 dependency tasks) passes with 5550 tests. Typecheck and build pass.
- [x] 4.2 Run `validate:docs`, `validate:specs` and `openspec validate attachment-content-type-registry`.
