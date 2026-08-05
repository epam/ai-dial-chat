## 1. FileDndOverlay component (lib)

- [x] 1.1 Create `libs/conversation-input/src/components/FileDndOverlay/FileDndOverlay.tsx` with `fixed inset-0 z-[9999]` layout, backdrop blur, and centered icon + title + subtitle; render nothing when `isVisible={false}`
- [x] 1.2 Add `FileDndOverlayProps` interface to `libs/conversation-input/src/models/` with `isVisible`, `title`, `subtitle`, `iconClassName` (default `'text-accent'`), `titleClassName`, `subtitleClassName` props (all optional except `isVisible`); icon is `IconFileDescription` from `@epam/ai-dial-ui-kit`
- [x] 1.3 Export `FileDndOverlay` and `FileDndOverlayProps` from `libs/conversation-input/src/index.ts`

## 2. ConversationInput refactor (lib)

- [x] 2.1 Remove `useDropzone`, `pendingFiles` state, and the inline `{isDragActive && ...}` overlay block from `ConversationInput.tsx`
- [x] 2.2 Add `pendingDropFiles?: File[]` and `onDropFilesConsumed?: () => void` props to `ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts`; forward both to `<Input>`
- [x] 2.3 Remove `dropLabel` and `dropOverlayClassName` from `ConversationInputProps` and their usage in `ConversationInput.tsx`
- [x] 2.4 Remove `.dropOverlay` styles from `ConversationInput.module.scss`
- [x] 2.5 Remove the `react-dropzone` import from `ConversationInput.tsx` (verify it's no longer used elsewhere in the file)

## 3. EditMessageInput update (lib)

- [x] 3.1 Add `pendingDropFiles?: File[]` and `onDropFilesConsumed?: () => void` to `EditMessageInputProps` in `libs/conversation-input/src/models/ConversationInput.ts`
- [x] 3.2 In `EditMessageInput.tsx`, add a `useEffect` that fires when the `pendingDropFiles` prop changes to a non-empty array: merge with internal `pendingDropFiles` state and call `onDropFilesConsumed`

## 4. usePageFileDrag hook (app)

- [x] 4.1 Create `apps/chat/src/hooks/usePageFileDrag.ts` — attach `dragenter`, `dragleave`, `dragover`, `drop` listeners to `document`; use a ref-counted `enterCount` for `isDragging`; only activate for drags containing the `'Files'` MIME kind; return `{ isDragging, pendingFiles, onFilesConsumed }`
- [x] 4.2 Call `event.preventDefault()` on `dragover` and `drop` events to block browser file-open behavior

## 5. ConversationView wiring (app)

- [x] 5.1 Call `usePageFileDrag` in `ConversationView`; render `<FileDndOverlay isVisible={isDragging} />` adjacent to the conversation content
- [x] 5.2 Pass `pendingDropFiles` and `onFilesConsumed` to `<ConversationInput>` when no edit is active (`editingMessageIndexes.size === 0`)
- [x] 5.3 Add `pendingDropFiles?: File[]` and `onDropFilesConsumed?: () => void` props to `ConversationMessageItem`; forward to `<EditMessageInput>` only when `isEditing` is true
- [x] 5.4 When an edit is active in `ConversationView`, pass `pendingFiles` and `onFilesConsumed` to the matching `ConversationMessageItem` instead of `ConversationInput`

## 6. ConversationRoute wiring (app)

- [x] 6.1 Call `usePageFileDrag` in the component that renders `<ConversationInput>` in the new-chat route (check `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`)
- [x] 6.2 Render `<FileDndOverlay isVisible={isDragging} />` and pass `pendingDropFiles`/`onFilesConsumed` to `<ConversationInput>`

## 7. Tests

- [x] 7.1 Update `ConversationInput.spec.tsx` — remove tests for internal drag overlay; add tests that `pendingDropFiles` prop is forwarded to `Input`
- [x] 7.2 Add unit tests for `usePageFileDrag` — verify `isDragging` toggling, file-only filtering, counter behavior, `pendingFiles` on drop, and `onFilesConsumed` clearing
- [x] 7.3 Add unit tests for `FileDndOverlay` — verify hidden when `isVisible={false}`, visible with default and custom text when `isVisible={true}`
- [x] 7.4 Add unit tests for `EditMessageInput` — verify external `pendingDropFiles` prop triggers attachment addition and `onDropFilesConsumed` is called
