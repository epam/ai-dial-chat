## MODIFIED Requirements

### Requirement: Context files are added from the device or the file manager

The Context section SHALL render:

- **A drop zone**: the kit `FileDropzone`. Its label is `labels.dropZoneLabel(links)` ("Drag&drop context, upload from device or file manager"), where `links` (`ProjectDropZoneLinks`) holds two empty elements the host fills with their text: `fromDevice`, an underlined span (the whole zone opens the device picker), and `fileManager`, a button that calls `onPickFromFileManager()` without opening the device picker, present only when that prop is supplied. The app renders the sentence with `Trans` and the keys `projects.create.context.dropZone` / `projects.create.context.dropZoneDeviceOnly`. The file input's accessible name is `labels.dropZoneAriaLabel` ("Upload context from device"). Its hint is the host-resolved `labels.dropZoneHint` ("File formats .csv, .pdf, .xlsx (max 1 MB)"), which names the same limits the host passes as props. The kit renders the area as a label over a visually hidden file input, so it is keyboard-operable and announced as a file input. The `accept` attribute is built from `allowedExtensions`. While idle the zone's background is `var(--pcf-dropzone-bg, var(--bg-layer-raised, #d1dbea))` (`styles.colors.dropZoneBackground`), on every screen size; a disabled zone and one being dragged over keep the kit's own backgrounds.
- **A drag overlay**: `FileDndOverlay` from `@epam/ai-dial-attachment-input`, shown while a file-bearing drag is over the form.

The Context header carries only the `labels.contextLabel` heading: there is no Add menu and no capacity meter.

Files from every source go through `checkContextFiles(incoming, contextFiles, { allowedExtensions, maxFiles, maxFileBytes, maxTotalBytes })`. The helper returns `{ accepted: Attachment[]; rejected: { name: string; reason: ContextFileRejection }[] }`. The members of `ContextFileRejection` are `TooManyFiles = 'too-many-files'`, `UnsupportedType = 'unsupported-type'`, `TooLarge = 'too-large'`, `CapacityExceeded = 'capacity-exceeded'`, `Duplicate = 'duplicate'` and `InvalidName = 'invalid-name'`. The helper rejects:

- an extension that is not in `allowedExtensions`;
- a file over `maxFileBytes`;
- a file that would push the running total over `maxTotalBytes`;
- a file that would exceed the optional `maxFiles` count from client config, including retained files and accepted additions;
- a name already present in `contextFiles` or earlier in the same batch;
- a name that fails `validateProjectName`.

Accepted files are appended through `onContextFilesChange`. Each rejection, `labels.fileRejections[reason](name)`, is shown as the kit `FileDropzone` `errorText`, one rejection per line, followed by a non-empty `errors.context`. The kit draws it in the error color under the area, gives the area an error border, and links it to the file input with `aria-describedby` and `aria-invalid`. Rejections are replaced by the next add and cleared by a remove; there is no toast.

`useProjectFileManagerPicker` (`apps/chat/src/hooks/projects/useProjectFileManagerPicker.ts`) is the app-level adapter over the shared `useSkillFileSystemPicker<File>` from `@epam/ai-dial-chat-hooks/skill-editor`:

- It opens `DialFileManagerModal` with `canAttachFolders={false}`, `allowedTypes` derived from the allowed extensions, and `maxSelectableFileSize={maxFileBytes}`.
- The picker checks the configured count including retained and staged files, and compares known selection sizes with the remaining byte budget before downloading. An over-budget selection stays open so the user can adjust it. Parallel downloads enforce the per-file and remaining total limits on actual bytes, including files with missing or stale metadata.
- It downloads each picked file, which copies it into the project; the download receives the picker's abort signal, so a cancelled pick aborts its requests.
- It resolves the files as `File[]`, in selection order, folders ignored. A download failure shows `projects.create.toast.fileManagerError` and resolves `undefined`; closing the modal or leaving the page while a pick is pending resolves it as cancelled.

#### Scenario: Add from device

- **WHEN** the user picks `tickets.csv` (200 KB) from the device
- **THEN** a card for `tickets.csv` appears, and `onContextFilesChange` receives one `Attachment` whose `file` is the picked `File`

#### Scenario: Add from the file manager

- **WHEN** the user activates the drop zone's "file manager" link, picks `survey.xlsx` and attaches it
- **THEN** the app downloads it, and a `survey.xlsx` card appears exactly as for a device upload

#### Scenario: Unsupported and oversized files are rejected on the client

- **WHEN** the user drops `notes.docx` and a 2 MB `big.pdf` with the default limits
- **THEN** neither is added, and both rejection messages are shown as the drop zone error and announced

#### Scenario: Capacity overflow is rejected on the client

- **WHEN** files totalling 9.5 MB are added and the user adds a further 0.8 MB file with a 10 MB total limit
- **THEN** that file is rejected with the capacity message, and the existing files stay

#### Scenario: Keyboard upload

- **WHEN** a keyboard user tabs to the drop zone's file input and activates it
- **THEN** the native file picker opens, and the input's accessible name is `labels.dropZoneAriaLabel`; the "file manager" link is the next tab stop
