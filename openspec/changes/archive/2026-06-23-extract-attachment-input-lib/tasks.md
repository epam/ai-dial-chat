## 1. Scaffold libs/attachment-input

- [x] 1.1 Create `libs/attachment-input/package.json` mirroring `libs/conversation-input/package.json` — name `@epam/ai-dial-attachment-input`, same peer deps (react, @epam/ai-dial-chat-shared, @epam/ai-dial-ui-kit, @tabler/icons-react), no runtime deps beyond peer deps
- [x] 1.2 Create `libs/attachment-input/tsconfig.json` extending `../../tsconfig.base.json` with references to `tsconfig.lib.json` and `tsconfig.spec.json`
- [x] 1.3 Create `libs/attachment-input/tsconfig.lib.json` (lib build config, `include: ["src/**/*.ts", "src/**/*.tsx"]`)
- [x] 1.4 Create `libs/attachment-input/tsconfig.spec.json` (test config, include spec files)
- [x] 1.5 Create `libs/attachment-input/vite.config.mts` in lib mode (copy from `libs/conversation-input/vite.config.mts`, update entry to `libs/attachment-input/src/index.ts`)
- [x] 1.6 Create `libs/attachment-input/postcss.config.js` and `libs/attachment-input/tailwind.config.js` (copy from `libs/conversation-input/`)
- [x] 1.7 Create `libs/attachment-input/eslint.config.mjs` (copy and update from `libs/conversation-input/eslint.config.mjs`)
- [x] 1.8 Create `libs/attachment-input/src/test-setup.ts` and `libs/attachment-input/src/vite-env.d.ts` (copy from `libs/conversation-input/src/`)

## 2. Register path alias

- [x] 2.1 Add `"@epam/ai-dial-attachment-input/*": ["./libs/attachment-input/*"]` to `compilerOptions.paths` in `tsconfig.base.json`
- [x] 2.2 Add the alias to `resolve.alias` in `apps/chat/vite.config.mts` (same pattern as the existing `@epam/ai-dial-conversation-input` alias)

## 3. Move source files from libs/conversation-input

- [x] 3.1 Copy `libs/conversation-input/src/components/AttachmentCard/` → `libs/attachment-input/src/components/AttachmentCard/` (component + scss module + tests)
- [x] 3.2 Copy `libs/conversation-input/src/components/AttachmentTray/` → `libs/attachment-input/src/components/AttachmentTray/` (component + tests)
- [x] 3.3 Copy `libs/conversation-input/src/components/FileDndOverlay/` → `libs/attachment-input/src/components/FileDndOverlay/` (component + tests)
- [x] 3.4 Copy `libs/conversation-input/src/hooks/useClipboardPaste.ts` and `hooks/tests/useClipboardPaste.spec.ts` → `libs/attachment-input/src/hooks/`
- [x] 3.5 Copy `libs/conversation-input/src/hooks/useLazyImageLoad.ts` and `hooks/tests/useLazyImageLoad.spec.tsx` → `libs/attachment-input/src/hooks/` (dependency of AttachmentCard)
- [x] 3.6 Copy `libs/conversation-input/src/models/AttachmentCard.ts` → `libs/attachment-input/src/models/AttachmentCard.ts`
- [x] 3.7 Copy `libs/conversation-input/src/models/AttachmentTray.ts` → `libs/attachment-input/src/models/AttachmentTray.ts`
- [x] 3.8 Copy `libs/conversation-input/src/models/FileDndOverlay.ts` → `libs/attachment-input/src/models/FileDndOverlay.ts`
- [x] 3.9 Copy `libs/conversation-input/src/utils/generateAttachmentId.ts` → `libs/attachment-input/src/utils/generateAttachmentId.ts`
- [x] 3.10 Copy `libs/conversation-input/src/utils/getAttachmentCardState.ts` → `libs/attachment-input/src/utils/getAttachmentCardState.ts`
- [x] 3.11 Copy `libs/conversation-input/src/utils/getAttachmentIcon.ts` → `libs/attachment-input/src/utils/getAttachmentIcon.ts`
- [x] 3.12 Copy `libs/conversation-input/src/constants/upload.ts` → `libs/attachment-input/src/constants/upload.ts`
- [x] 3.13 Copy `libs/conversation-input/src/utils/getNameWithoutExtension.ts` → `libs/attachment-input/src/utils/getNameWithoutExtension.ts` (dependency of AttachmentCard)

## 4. Move attachment-mime.ts from apps/chat

- [x] 4.1 Copy `apps/chat/src/utils/attachment-mime.ts` → `libs/attachment-input/src/utils/attachment-mime.ts`
- [x] 4.2 Copy `apps/chat/src/utils/attachment-mime.spec.ts` → `libs/attachment-input/src/utils/tests/attachment-mime.spec.ts` and update its import path

## 5. Write libs/attachment-input/src/index.ts

- [x] 5.1 Export all components: `AttachmentCard`, `AttachmentTray`, `FileDndOverlay`
- [x] 5.2 Export all types: `AttachmentCardProps`, `AttachmentCardColors`, `AttachmentCardTypography`, `AttachmentTrayProps`, `FileDndOverlayProps`
- [x] 5.3 Export hooks: `useClipboardPaste`, `useLazyImageLoad`, `LazyImageLoadStatus`
- [x] 5.4 Export utils: `generateAttachmentId`, `getAttachmentCardState`, `getAttachmentIcon`, `getNameWithoutExtension`, `mimeTypesToExtensionLabels`, `isMimeTypeAllowed`
- [x] 5.5 Export constants from `upload.ts`

## 6. Delete original files from libs/conversation-input

- [x] 6.1 Delete `libs/conversation-input/src/components/AttachmentCard/` (component + scss module + tests)
- [x] 6.2 Delete `libs/conversation-input/src/components/AttachmentTray/` (component + tests)
- [x] 6.3 Delete `libs/conversation-input/src/components/FileDndOverlay/` (component + tests)
- [x] 6.4 Delete `libs/conversation-input/src/hooks/useClipboardPaste.ts` and its spec
- [x] 6.5 Delete `libs/conversation-input/src/hooks/useLazyImageLoad.ts` and its spec
- [x] 6.6 Delete `libs/conversation-input/src/models/AttachmentCard.ts`
- [x] 6.7 Delete `libs/conversation-input/src/models/AttachmentTray.ts`
- [x] 6.8 Delete `libs/conversation-input/src/models/FileDndOverlay.ts`
- [x] 6.9 Delete `libs/conversation-input/src/utils/generateAttachmentId.ts`
- [x] 6.10 Delete `libs/conversation-input/src/utils/getAttachmentCardState.ts`
- [x] 6.11 Delete `libs/conversation-input/src/utils/getAttachmentIcon.ts`
- [x] 6.12 Delete `libs/conversation-input/src/utils/getNameWithoutExtension.ts`
- [x] 6.13 Delete `libs/conversation-input/src/constants/upload.ts`
- [x] 6.14 Delete `apps/chat/src/utils/attachment-mime.ts` and `apps/chat/src/utils/attachment-mime.spec.ts`

## 7. Fix imports in libs/conversation-input after deletions

- [x] 7.1 Update `Input.tsx` imports: `AttachmentTray` → from attachment-input; `useClipboardPaste`, `generateAttachmentId`, `MAX_UPLOADS_PER_MINUTE` → from attachment-input
- [x] 7.2 Update `AddAttachmentButton.tsx` — no changes needed (it stays in conversation-input and has no deleted deps)
- [x] 7.3 Update `libs/conversation-input/src/index.ts` to re-export moved symbols from `@epam/ai-dial-attachment-input/src/index`:
  - `AttachmentCard`, `AttachmentTray`, `FileDndOverlay`
  - Types: `AttachmentCardProps`, `AttachmentCardColors`, `AttachmentCardTypography`, `AttachmentTrayProps`, `FileDndOverlayProps`
  - `getAttachmentIcon`
- [x] 7.4 Add `@epam/ai-dial-attachment-input` as a peer dependency in `libs/conversation-input/package.json`

## 8. Update apps/chat import sites

- [x] 8.1 Find all files in `apps/chat/src/` that import from `attachment-mime` and update them to import from `@epam/ai-dial-attachment-input/src/utils/attachment-mime`

## 9. Verify

- [x] 9.1 Run `npm exec nx typecheck attachment-input` — must pass with zero errors
- [x] 9.2 Run `npm exec nx lint attachment-input` — must pass with zero errors
- [x] 9.3 Run `npm exec nx test attachment-input` — all tests pass
- [x] 9.4 Run `npm exec nx typecheck conversation-input` — must pass with zero errors
- [x] 9.5 Run `npm exec nx test conversation-input` — all tests still pass
- [x] 9.6 Run `npm exec nx typecheck chat` — must pass with zero errors
- [x] 9.7 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — no lint regressions
- [x] 9.8 Run `npm run graph` and confirm no `attachment-input → conversation-input` edge
