# Tasks

Slicing strategy: vertical; the whole change is one thin slice, implemented.

## 1. Click to preview

- [x] 1.1 Add the optional `onTableFileClick` prop to `DialFileManagerShell` in `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx` and forward it to `DialFileManager`. Verification: `npm run test:file -- apps/chat/src/components/DialFileManagerShell/tests/DialFileManagerShell.spec.tsx`.
- [x] 1.2 Extend `useDialFilePreview` in `apps/chat/src/hooks/files/useDialFilePreview.ts` with a search-results lookup and an `onFileClick`. Verification: `npm run test:file -- apps/chat/src/hooks/files/tests/useDialFilePreview.spec.ts`.
- [x] 1.3 Pass the click handler and `controller.searchResults` from `DialFileManagerPage` and update its spec mock. Verification: `npm run test:file -- apps/chat/src/pages/DialFileManagerPage/tests/DialFileManagerPage.spec.tsx`.
- [x] 1.4 Guard overlapping previews with a generation and `shouldCommit`, stop a preview that outlives the page, and keep the callbacks stable through refs. Verification: `npm run test:file -- apps/chat/src/hooks/files/tests/useDialFilePreview.spec.ts`.
- [x] 1.5 Cover the page wiring (`onFileClick` and search results reach the hook) in the page spec. Verification: `npm run test:file -- apps/chat/src/pages/DialFileManagerPage/tests/DialFileManagerPage.spec.tsx`.

## 2. Specs

- [ ] 2.1 Run `npm run validate:specs` and `npm run validate:docs`, then `/opsx:archive` to sync the delta specs. Verification: both commands pass and the main `file-manager-preview`, `file-manager-shell` and `file-manager-standalone-page` specs show the new requirements.
