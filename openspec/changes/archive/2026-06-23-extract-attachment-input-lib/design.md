## Context

Attachment UI components currently live inside `libs/conversation-input`, a library named and scoped for the conversational text-input surface. The components moved here grew organically alongside the input but are conceptually independent — they represent attached files, not the act of typing. The monorepo already has `libs/attachment-canvas` (the preview/viewer side) and `libs/chat-shared` (shared types). A dedicated `libs/attachment-input` library completes the attachment domain picture and allows future surfaces (edit-message, panel widgets) to reuse attachment UI without taking a dependency on the full conversation input.

The lib-isolation rule (AGENTS.md §Library isolation) requires that libs stay host-agnostic. All extracted code already satisfies this: components receive data and callbacks via props, none of them read app context, server-api, routes, or env config. The one app-side util migrated (`attachment-mime.ts`) also has zero app imports; it is pure logic over strings/arrays.

## Goals / Non-Goals

**Goals:**
- Create `libs/attachment-input` as an isolated, host-agnostic library with its own `package.json`, `tsconfig`, Vite config, and Nx-compatible structure.
- Move `AttachmentCard`, `AttachmentTray`, `AddAttachmentButton`, `FileDndOverlay`, `useClipboardPaste` and all their supporting models, utils, and constants from `libs/conversation-input` into the new lib.
- Move `attachment-mime.ts` from `apps/chat/src/utils/` into the new lib (pure logic, no app deps).
- Register `@epam/ai-dial-attachment-input/*` → `libs/attachment-input/*` as a path alias in `tsconfig.base.json` and in the Vite config for `apps/chat`.
- Update `libs/conversation-input` to import the moved symbols via the new alias; keep all existing exports of `libs/conversation-input` intact so no app import paths break.
- Update `apps/chat` import sites for `attachment-mime.ts` to use the new alias.
- All existing tests pass after the move; no new test coverage is required (no logic changes).

**Non-Goals:**
- Moving app-level hooks (`useAttachmentAction`, `useAttachmentValidation`, `useOpenAttachmentCanvas`) — they reference app context, deployment config, and routing.
- Moving DTO-mapping utils (`attachment-dto-to-display.ts`, `attachment-to-dto.ts`, `attachment-canvas.ts`, `dial-file-to-attachment.ts`) — they depend on the generated API client and/or app types.
- Moving `DialFileManagerModal` or the server-api upload code.
- Merging `libs/attachment-canvas` into the new lib.
- Publishing the lib externally.

## Decisions

### D1 — New lib, not a merge into attachment-canvas

`libs/attachment-canvas` handles preview rendering; `libs/attachment-input` handles input-side UX (picking, displaying, removing attachments). These are independently reusable and will likely have different consumers. Merging would couple the canvas renderer with the input tray for no benefit.

*Alternative considered*: rename `attachment-canvas` → `attachment` and add input code as a subfolder. Rejected because it violates single-responsibility and complicates the canvas lib's existing export surface.

### D2 — Lib uses the same scaffold as conversation-input

Mirror `libs/conversation-input`'s structure: `package.json` with `@epam/source` condition, `tsconfig.json` with `tsconfig.lib.json` + `tsconfig.spec.json` references, Vite `lib` mode, `postcss.config.js` + `tailwind.config.js` (the lib contains Tailwind-styled components). Peer deps: `react`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`, `@tabler/icons-react`.

### D3 — conversation-input re-exports moved symbols

`libs/conversation-input/src/index.ts` currently exports some attachment symbols (e.g., `AttachmentCardProps`, `AttachmentTrayProps`). After the move these must be re-exported via `export { ... } from '@epam/ai-dial-attachment-input/src/index'` so that any consumer using the `@epam/ai-dial-conversation-input` alias doesn't break. New direct consumers should import from `@epam/ai-dial-attachment-input` instead.

### D4 — attachment-mime.ts moves as-is

`mimeTypesToExtensionLabels` and `isMimeTypeAllowed` have no app-specific imports (they operate on strings and arrays). Moving them into the lib makes MIME validation reusable from any lib that works with attachments. The app imports are updated to use `@epam/ai-dial-attachment-input/src/utils/attachment-mime`.

### D5 — Nx module boundary tags

The new lib gets `tag: "type:ui"` (same as `libs/conversation-input`) in its Nx project config. `@nx/enforce-module-boundaries` already allows `type:ui` libs to import from `chat-shared`; no ESLint config changes are needed beyond adding the new lib name.

## Risks / Trade-offs

- **[Risk] Missed import site** — If any file in `apps/chat` imports attachment components directly via a relative path (unlikely given lib isolation but possible), it won't be caught until typecheck. → Mitigation: run `nx affected --target=typecheck` across the whole monorepo as the final verification step.
- **[Risk] Circular dependency** — `libs/conversation-input` importing from `libs/attachment-input`. No existing `libs/attachment-input → libs/conversation-input` path exists (the new lib is extracted from, not dependent on, the old one). Nx dep graph will confirm the direction. → Mitigation: run `npm run graph` after the move.
- **[Trade-off] conversation-input index re-exports** — Re-exporting keeps backwards compatibility but means two import paths exist for the same symbol for a time. Acceptable for a refactor; a follow-up cleanup PR can remove the re-exports once all direct imports are migrated.

## Migration Plan

1. Scaffold `libs/attachment-input` (package.json, tsconfig files, vite config, postcss/tailwind config, empty index.ts).
2. Register path alias in `tsconfig.base.json`.
3. Register path alias in `apps/chat/vite.config.mts` (resolve.alias).
4. Copy source files from `libs/conversation-input/src/` → `libs/attachment-input/src/` (components, hooks, models, utils, constants).
5. Copy `apps/chat/src/utils/attachment-mime.ts` → `libs/attachment-input/src/utils/attachment-mime.ts`.
6. Write `libs/attachment-input/src/index.ts` exporting all public symbols.
7. Delete the original files from `libs/conversation-input/src/` and `apps/chat/src/utils/attachment-mime.ts`.
8. Update `libs/conversation-input` internal imports to use the new alias.
9. Update `libs/conversation-input/src/index.ts` to re-export moved symbols from the new lib.
10. Update all `apps/chat` import sites for `attachment-mime.ts`.
11. Run `npm exec nx affected --target=typecheck`, then `lint`, then `test`.

Rollback: the entire change is on a feature branch; reverting is a single `git revert`.

## Open Questions

- None. The scope is fully defined; all moved files are already isolated.
