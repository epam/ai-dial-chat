## Purpose

Attach selected visible text from a completed chat message as an ordinary UTF-8 text file through the existing composer upload flow, with accessible selection-completion, citation, keyboard, touch and RTL behavior.

## ADDED Requirements

### Requirement: Eligible message selection exposes Reply

The active editable conversation SHALL expose a localized Reply button for one non-collapsed native selection containing non-whitespace text wholly inside a single completed user or assistant message body. The selection SHALL capture visible text rather than Markdown source or HTML. Code and table body text SHALL be eligible, but selections containing only controls, citation buttons or hidden content, and selections in attachments, tool/stage output, embedded apps, viewers and the composer SHALL NOT be eligible. The selection SHALL NOT span message bodies or consist only of excluded controls. Inline citations/annotations, links and decorative nodes SHALL NOT invalidate a selection containing message text outside those controls. Native selected text, including any selected marker labels, SHALL be preserved.

Reply SHALL be unavailable without a selected deployment that accepts `text/plain`, an upload callback and enabled attachment/text input; it SHALL also be unavailable in read-only views, edit mode and while the conversation is streaming. No new feature-flag key or role gate SHALL be introduced; existing attachment permissions SHALL govern availability. Eligibility SHALL be checked again on activation.

#### Scenario: Select a passage from a completed answer

- **WHEN** the user selects text in one completed assistant message and the current composer accepts text attachments
- **THEN** one Reply button appears beside that selection
- **AND** selecting text in a completed user message offers the same action

#### Scenario: Reject invalid or excluded selections

- **WHEN** the selection is collapsed, whitespace-only, spans two messages, starts outside the body, or contains only excluded controls or an excluded surface
- **THEN** Reply is absent and no file is created

#### Scenario: Model or mode no longer permits Reply

- **WHEN** the user selects text with an image-only deployment, a disabled composer, a read-only conversation, edit mode or streaming active
- **THEN** Reply is absent
- **AND** if any of these conditions arises after Reply appeared, it closes and a stale activation cannot add a file

### Requirement: Selection action survives activation and dismisses predictably

The app SHALL position Reply near a visible selection rectangle, prefer placement above it, flip below when necessary and clamp it within the visible viewport. It SHALL update or dismiss on scrolling, resize and mobile visual-viewport changes, and SHALL dismiss when the selection scrolls completely out of view. The action SHALL preserve native copy and selection-handle behavior.

The captured selection SHALL survive moving focus onto Reply by keyboard or pointer. Escape, an outside pointer interaction, a new invalid selection, source-body mutation/removal, navigation or loss of eligibility SHALL dismiss it without creating a file. Activation SHALL consume the captured selection once and clear the browser selection.

#### Scenario: Clicking the action does not lose the selected text

- **WHEN** the user clicks Reply and browser focus would otherwise collapse the selection
- **THEN** the captured text is used for one attachment
- **AND** repeat pointer/selection events from that same activation do not enqueue another attachment

#### Scenario: Dismiss without side effects

- **WHEN** the user presses Escape, interacts elsewhere or navigates away before activating Reply
- **THEN** the action disappears and no upload starts

#### Scenario: Source or viewport changes

- **WHEN** the selected body is edited, removed, collapsed so the selection is hidden, or scrolled entirely out of view
- **THEN** the stale action is dismissed
- **AND** scrolling or resizing while the selection remains visible keeps the action within the viewport

### Requirement: Reply creates an ordinary text attachment

Activating Reply SHALL create one UTF-8 `File` with MIME type `text/plain` and a unique filename of the form `reply-<uuid>.txt`. Its decoded contents SHALL equal the selected visible text, preserving whitespace, line breaks and Unicode; no BOM, source metadata, Markdown formatting, HTML or automatic newline SHALL be added. Whitespace trimming SHALL be used only for eligibility. Selected text SHALL NOT be included in the filename or logs.

The file SHALL enter the existing pending raw-file attachment path, use the ordinary file tile and initiate the existing upload callback. Reply SHALL preserve the typed message and existing attachments, request composer focus without replacing its text/caret, and SHALL NOT send automatically. Re-selecting the same text later SHALL create a separate file.

#### Scenario: Preserve multilingual text and the current draft

- **WHEN** a user with a typed draft and existing attachments activates Reply for a multiline selection containing Arabic, emoji and leading/trailing spaces
- **THEN** exactly one additional `.txt` attachment contains those characters unchanged
- **AND** the draft and previous attachments remain intact, the composer receives focus and no completion request is sent

#### Scenario: Reply and drag-and-drop arrive together

- **WHEN** Reply-generated files and dropped files await insertion concurrently
- **THEN** each file is consumed once through the common validation/upload path
- **AND** acknowledgement cannot discard files queued after the consumed batch or clear the separate DIAL file-picker queue

#### Scenario: Repeated render effects do not duplicate attachments

- **WHEN** React replays effects or rerenders before the pending batch acknowledgement settles
- **THEN** one Reply activation still produces one attachment and at most one initial upload

### Requirement: Reuse attachment limits and lifecycle

Reply files SHALL use the existing MIME, byte-size and count validation, rate limiting, immediate upload, conflict-safe stored filename, progress, error, retry, removal and preview behaviors. There SHALL be no separate Reply limits. A count-limit rejection SHALL use the existing count feedback; a validation/upload failure SHALL use the existing attachment error handling. No new endpoint, DTO, generated-client operation or persisted message field SHALL be introduced.

Sending SHALL use the ordinary uploaded attachment URL through `attachmentsToDtos`; no selected text SHALL be silently injected into the typed prompt or sent as inline `data`. Loading or failed attachments SHALL block send as usual. An uploaded Reply attachment alone SHALL be sendable. Successful send SHALL clear it; a rejected `onSend` SHALL retain it; subsequent stream failure SHALL follow existing conversation retry behavior. Removal SHALL NOT delete the uploaded file from storage.

#### Scenario: Send waits for upload and uses the stored URL

- **WHEN** a Reply attachment is uploading
- **THEN** send is blocked
- **AND** after upload succeeds, sending includes its stored filename, `text/plain` type and URL using the existing attachment DTO mapping
- **AND** no additional upload or special quote field is produced during send

#### Scenario: Validation and upload failures are recoverable

- **WHEN** the file exceeds the configured byte limit or its upload fails
- **THEN** existing validation/error feedback appears and the attachment cannot be sent
- **AND** retry/removal behaves like other file attachments, with successful upload retry making it sendable

#### Scenario: Attachment count limit is reached

- **WHEN** adding the Reply file would exceed the existing attachment count limit
- **THEN** the common count-limit feedback is shown and the rejected file is not uploaded
- **AND** the draft and existing attachments are unchanged

#### Scenario: Removal and send rejection preserve existing semantics

- **WHEN** the user removes an uploaded Reply attachment
- **THEN** only its draft tile is removed and no remote deletion occurs
- **AND** if the user instead sends and `onSend` rejects, the text draft and attachment remain available for retry

### Requirement: State ownership and optional library contracts

`@epam/ai-dial-chat-hooks/conversation` SHALL expose `useMessageSelectionReply`, which owns the transient selection snapshot and Reply pending-file queue scoped to the caller-supplied conversation identifier. Existing `useAttachments` SHALL remain the owner of accepted attachment state. Unmount/navigation SHALL discard selection and unconsumed Reply files; late work from the previous view SHALL NOT add files to another conversation. No global context, browser persistence, new cache or TTL SHALL be introduced. No new telemetry events SHALL be emitted; existing upload telemetry SHALL remain unchanged.

`conversation-messages` SHALL expose an optional `contentRef` pointing only to the user/assistant text root and a `MessageSelectionReply` action that receives localized labels as props. `conversation-input` SHALL accept an optional `focusRequestId` that requests textarea focus when it changes and does not change draft contents. Existing callers omitting these props SHALL behave unchanged. The app SHALL supply eligibility, localized labels, files and existing upload/validation callbacks. Libraries SHALL NOT acquire host API/client, auth, environment, routing, storage or i18n knowledge. Body-registration and consumption callbacks SHALL be stable; merged file batches SHALL be memoized.

`MessageSelectionReply` SHALL accept optional color, typography and root/button class overrides, plus a same-document portal container. Its default destination SHALL be `document.body`; a null destination SHALL defer rendering of both the action and live status region. A host using a modal SHALL be able to keep both inside that modal. The application SHALL scope the composer lifetime to conversation identity so accepted attachments and late uploads do not cross conversations.

#### Scenario: Navigate with a pending selection or upload

- **WHEN** the user switches conversations after selecting text or activating Reply
- **THEN** the old selection and unconsumed Reply queue cannot appear in the new view
- **AND** completion of an old upload cannot insert a tile into the new composer

#### Scenario: Existing library consumers remain unchanged

- **WHEN** an embedding host renders message bubbles and conversation input without the new optional props
- **THEN** rendering, selection, draft editing and attachment behavior match the existing contracts

### Requirement: Accessible mobile and RTL interaction

Reply SHALL be a keyboard-focusable button with a visible focus indicator and localized accessible name. After keyboard text selection, Tab SHALL reach Reply without discarding its snapshot; Enter/Space SHALL activate it, and Escape SHALL dismiss it without trapping focus. Touch selection SHALL offer the same action without hover; its mobile touch target SHALL be at least 44 by 44 CSS pixels. On desktop the button SHALL be compact (32px tall) and use an opaque background in both default and hover states. Layout SHALL fit 360, 900, 1280 and 1920 CSS-pixel viewports without horizontal overflow.

New app keys SHALL be `chat.reply`, `chat.replySelectionAvailable` and `chat.replyAttachmentAdded`, provided in English via `useTranslation`; adding other translations is outside this change. A polite status region SHALL announce action availability and accepted file insertion, not upload success or the selected text itself. Existing attachment error labels SHALL be reused. Directional spacing/alignment SHALL use logical properties; the Reply arrow SHALL mirror in RTL and be hidden from assistive technology. Text contrast SHALL meet 7:1. A dismissed action SHALL be unmounted, with no hidden focusable descendant.

#### Scenario: Keyboard selection and activation

- **WHEN** the user selects message text with the keyboard, tabs to Reply and presses Enter or Space
- **THEN** the selection is attached once and focus moves to the composer
- **AND** pressing Escape instead dismisses the action without attaching or trapping focus

#### Scenario: RTL touch interaction on a small viewport

- **WHEN** the host uses RTL direction and the user selects text by touch at 360px width
- **THEN** the localized action remains reachable within the viewport with mirrored directional icon and logical alignment
- **AND** activation adds the ordinary attachment, announces insertion politely and preserves the exact selected text

#### Scenario: Finish selection before offering Reply

- **WHEN** the user starts or extends a selection by pointer or keyboard, including repeated selections
- **THEN** Reply SHALL remain hidden throughout the gesture and appear only after pointer release or completion of keyboard selection
- **AND** cancelled pointer gestures and window blur SHALL dismiss without attaching and allow a later selection
