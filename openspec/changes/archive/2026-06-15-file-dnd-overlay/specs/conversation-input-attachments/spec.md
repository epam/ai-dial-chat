## ADDED Requirements

### Requirement: ConversationInput accepts externally-supplied pending drop files

`ConversationInput` SHALL accept two new optional props:
- `pendingDropFiles?: File[]` — files dropped by the page-level drop zone
- `onDropFilesConsumed?: () => void` — callback to signal the parent that files have been consumed

`ConversationInput` SHALL forward these directly to the inner `Input` component.

`ConversationInput` SHALL NOT own a `useDropzone` instance. Drag detection and drop routing are the responsibility of the consuming app (see `usePageFileDrag`).

The `dropLabel` and `dropOverlayClassName` props are removed. The inline drag overlay within `ConversationInput` is removed.

#### Scenario: Externally-provided files are forwarded to Input

- **WHEN** `ConversationInput` receives `pendingDropFiles` with one file
- **THEN** the inner `Input` component receives that file as a pending attachment

#### Scenario: onDropFilesConsumed is called after Input processes the files

- **WHEN** `Input` emits `onDropFilesConsumed` after processing the pending files
- **THEN** `ConversationInput` calls the `onDropFilesConsumed` prop to signal the parent

---

## ADDED Requirements

### Requirement: EditMessageInput accepts externally-supplied pending drop files

`EditMessageInput` SHALL accept two new optional props:
- `pendingDropFiles?: File[]` — files supplied from outside (e.g., page-level drag-and-drop)
- `onDropFilesConsumed?: () => void` — signals that the files have been consumed by the input

When `pendingDropFiles` changes to a non-empty array, `EditMessageInput` SHALL merge those files with its internal `pendingDropFiles` state (or set it directly when the internal queue is empty) and call `onDropFilesConsumed`.

#### Scenario: External pending files appear in edit input

- **WHEN** `EditMessageInput` receives a non-empty `pendingDropFiles` prop
- **THEN** those files are added to the attachment tray in the edit input

#### Scenario: onDropFilesConsumed is called after consuming external files

- **WHEN** `EditMessageInput` processes the externally-supplied files
- **THEN** it calls the `onDropFilesConsumed` callback to allow the parent to clear its state
