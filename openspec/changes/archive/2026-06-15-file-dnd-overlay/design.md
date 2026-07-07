## Context

`ConversationInput` currently owns the entire drag-and-drop lifecycle: it wraps a `useDropzone` instance whose drop zone is the component's own DOM element, and it renders a small inline overlay only when `isDragActive` is true within that element. `EditMessageInput` has no drag support at all—only a hidden `<input type="file">` driven by a button. Because the drop zone is scoped to the input element, users who drag files anywhere else on the page see no visual feedback and the drop silently fails.

There are three distinct surfaces where a user can add attachments:
- **New chat** (`ConversationRoute` → `ConversationInput`)
- **Active conversation** (`ConversationView` → `ConversationInput`)
- **Edit message** (`ConversationMessageItem` → `EditMessageInput`)

Only one surface is active at a time: edit mode and the main input are mutually exclusive.

## Goals / Non-Goals

**Goals:**
- Show a full-screen blurry overlay whenever files are dragged anywhere on the page
- Overlay displays a centered upload icon, "Attach files" heading, and "Drop files here to attach them to message" subtitle
- Files dropped on the overlay are routed to whichever input surface is currently active (main input or edit input)
- All three surfaces (new chat, conversation, edit) are covered
- Removes the old small in-box overlay from `ConversationInput`

**Non-Goals:**
- Supporting simultaneous drops on both main input and edit input
- Changing how attachments are processed after they reach the `Input` component
- Mobile-specific drag behaviour (drag-and-drop is primarily a desktop gesture)
- Animating the overlay entrance/exit beyond what CSS opacity/transition provides

## Decisions

### Decision 1: Lift the drop zone to the page level

**Chosen:** Remove `useDropzone` from `ConversationInput`. The app-level pages (`ConversationView` wrapper div, `ConversationRoute` wrapper div) own the drop zone. They hold `pendingFiles` state and pass it down via props.

**Alternative rejected:** Keep `useDropzone` inside `ConversationInput` but attach it to `document`. Rejected because it creates hidden global listeners inside a lib that cannot be easily reasoned about, and two sibling `useDropzone`-on-document instances (one for main input, one for edit) would both fire on the same drop.

**Alternative rejected:** Use a React context/Redux action to broadcast dropped files. Adds unnecessary indirection for what is a straightforward data flow.

`ConversationInput` gains two new props—`pendingDropFiles?: File[]` and `onDropFilesConsumed?: () => void`—that already exist on the inner `Input` component. The internal `pendingFiles` state and `useDropzone` are removed.

### Decision 2: New `usePageFileDrag` hook lives in `apps/chat`

The hook attaches `dragenter`, `dragleave`, `dragover`, and `drop` event listeners to `document`. It uses a ref-counted counter (`enterCount`) to handle the known browser quirk where `dragleave` fires on every child element transition. It only activates for drags containing the `Files` MIME kind. It returns `{ isDragging: boolean, pendingFiles: File[], onFilesConsumed: () => void }`.

This is placed in `apps/chat/src/hooks/usePageFileDrag.ts` because it reads `document` directly—a platform/host concern that belongs in the app, not the lib.

### Decision 3: `FileDndOverlay` component lives in `libs/conversation-input`

The overlay is pure UI: `fixed inset-0 z-[9999]`, backdrop blur, centered content. It has no knowledge of routing, auth, or app context. It accepts:
- `isVisible: boolean`
- `iconClassName?: string` (default `'text-secondary'`)
- `titleClassName?: string` (default `'dial-subheader2-bold-text'`)
- `subtitleClassName?: string` (default `'dial-body-text'`)
- `title?: string` (default `'Attach files'`)
- `subtitle?: string` (default `'Drop files here to attach them to message'`)

The overlay is `pointer-events-none` — the underlying drop zone element (the page wrapper with `getRootProps`) receives the actual drop event. The overlay is purely visual.

### Decision 4: Route drops to the active surface

When `ConversationView` has no active edits (`editingMessageIndexes.size === 0`), `pendingFiles` flows to `ConversationInput`. When an edit is active, `pendingFiles` flows to `EditMessageInput` via a new `pendingDropFiles` prop on `ConversationMessageItem` (for the message currently being edited).

This requires `ConversationMessageItem` to accept `pendingDropFiles?: File[]` and `onDropFilesConsumed?: () => void` props and forward them to `EditMessageInput` only when `isEditing` is true. This is a small additive prop change with no behavioural regression for the non-editing case.

### Decision 5: Remove `dropLabel` and `dropOverlayClassName` from `ConversationInput`

These props existed only to customize the now-removed inline overlay. They are removed. The new `FileDndOverlay` text is customizable at the call site by passing `title`/`subtitle` props directly to `<FileDndOverlay>` in the app.

## Risks / Trade-offs

- **`enterCount` flicker** — Child `dragleave`/`dragenter` pairs fire synchronously; ref-counting handles this. A `setTimeout(0)` debounce is a fallback if any browser diverges. → Mitigation: use a well-tested counter pattern (increment on `dragenter`, decrement on `dragleave`, hide at 0).
- **`ConversationInput` API is a breaking change** — Removes `dropLabel`, `dropOverlayClassName`; adds `pendingDropFiles`, `onDropFilesConsumed`. Any downstream consumer using the embedded DnD will need updating. → Mitigation: document in `tasks.md`; this is the intended clean-up.
- **Edit mode prop threading** — `ConversationView` must pass `pendingDropFiles` through `ConversationMessageItem` to `EditMessageInput`. This adds props to two existing components. → Mitigation: the prop is optional and defaults to undefined, so all existing usage continues to work.
- **`pointer-events-none` overlay** — If the page wrapper with `getRootProps` doesn't cover the full viewport (e.g., scroll offset), drops at the bottom of a long page could miss the zone. → Mitigation: page wrapper divs in `ConversationView` and `ConversationRoute` should already use `min-h-full` or flex-grow layout.

## Migration Plan

1. Add `FileDndOverlay` component to `libs/conversation-input` — no breaking change.
2. Add `usePageFileDrag` hook to `apps/chat` — no breaking change.
3. Update `ConversationInput`: add `pendingDropFiles`/`onDropFilesConsumed` props, remove `useDropzone` and inline overlay, remove `dropLabel`/`dropOverlayClassName` — **breaking**.
4. Update `ConversationView` and `ConversationRoute` to use `usePageFileDrag` + `FileDndOverlay` + pass `pendingDropFiles` to `ConversationInput`.
5. Update `ConversationMessageItem` to accept and forward `pendingDropFiles`.
6. Update `EditMessageInput` to accept `pendingDropFiles`/`onDropFilesConsumed` as external props (it already holds this state internally from the file input; extend it to also accept external pending files).
7. Update tests for changed components.

Rollback: All changes are in one feature branch. No database migration or config change needed.

## Open Questions

- **Blur intensity?** `backdrop-blur-sm`, `backdrop-blur-md`? Confirm with design.
- **Background opacity?** Use `--bg-blackout` CSS variable (same as current inline overlay) or a lighter value for the full-screen version?

## Resolved

- **Icon**: `IconFileDescription` from `@epam/ai-dial-ui-kit` in accent color (`text-accent-primary` or equivalent token).
