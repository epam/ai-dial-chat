Slicing: a single vertical slice. The whole change lives in one component and has to compile in one step, so 1.x is done as one edit and verified by section 2.

## 1. Adopt the hook in ConversationView

- [x] 1.1 In `apps/chat/src/components/ConversationView/ConversationView.tsx`, import `useDialFileManagerState` from `../../hooks/files/useDialFileManagerState` and replace the `isDialFileManagerOpen` / `pendingDialAttachments` `useState` pair (right after `const bucket = user?.bucket ?? ''`) with a destructured call that keeps the existing local names: `isOpen: isDialFileManagerOpen`, `openModal: handleOpenDialFileManager`, `closeModal: closeDialFileManager`, `pendingAttachments: pendingDialAttachments`, `clearPendingAttachments: clearPendingDialAttachments`, `handleAttach: handleAttachDialFiles` (mirror `NewConversationComposer.tsx`)
- [x] 1.2 Delete the now-duplicate local `handleOpenDialFileManager`, `handleAttachDialFiles` and `clearPendingDialAttachments` `useCallback`s
- [x] 1.3 Replace the inline `() => setPendingDialAttachments([])` passed to the input with `clearPendingDialAttachments`, and the modal's `onClose={() => setIsDialFileManagerOpen(false)}` with `onClose={closeDialFileManager}`
- [x] 1.4 Remove imports left unused by 1.1–1.3 (`dialFilesToAttachments`, `dialFolderPathToAttachment`, and `AttachResult` / `Attachment` only if no other usage remains); keep `resolveCatalogIconUrl`, which is still used for deployment icons

## 2. Verify

- [x] 2.1 `grep` `ConversationView.tsx` for `setIsDialFileManagerOpen` and `setPendingDialAttachments` — both return nothing
- [x] 2.2 Run the existing specs unchanged: `npm run test:file -- apps/chat/src/components/ConversationView/tests` and `npm run test:file -- apps/chat/src/components/NewConversationComposer/tests/NewConversationComposer.spec.tsx`
- [x] 2.3 `npm exec nx run chat:typecheck` and `npm exec nx lint chat` pass
- [ ] 2.4 Manual check in an existing conversation: open "DIAL file system", attach a file and a folder, confirm both appear in the input; open and close without attaching, confirm the draft is unchanged; send, confirm the pending attachments clear
- [x] 2.5 `npm run validate:specs` passes with the two delta specs

## 3. Follow-up (out of scope)

- [x] 3.1 Mark Phase 1.6 done in the local `refactoring-frontend.md` / `refactoring.md` scorecards (git-excluded, no commit)
