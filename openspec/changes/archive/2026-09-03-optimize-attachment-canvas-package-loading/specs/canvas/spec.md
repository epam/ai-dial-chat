## ADDED Requirements

### Requirement: PDF worker preparation is awaited, shared, and retryable

`PdfContent` SHALL NOT mount its underlying `DocumentPreview` viewer until the host-supplied `configurePdfWorker` callback's returned promise (when the prop is supplied) has resolved. Concurrent PDF opens that trigger preparation while it is already in flight SHALL share the same pending preparation rather than invoking `configurePdfWorker` again. A successful preparation SHALL be memoized so later PDF opens do not re-invoke `configurePdfWorker`. A rejected preparation SHALL clear its retryable state so a later attempt invokes `configurePdfWorker` again instead of the rejection being cached permanently. When `configurePdfWorker` is omitted, `DocumentPreview` mounts immediately, preserving the existing CDN-hosted worker fallback.

#### Scenario: Viewer waits for preparation to resolve

- **WHEN** a PDF attachment is opened and `configurePdfWorker` is supplied
- **THEN** `DocumentPreview` does not mount until the callback's returned promise resolves

#### Scenario: Concurrent opens share one in-flight preparation

- **WHEN** a second PDF attachment is opened while an earlier preparation triggered by `configurePdfWorker` is still pending
- **THEN** `configurePdfWorker` is not invoked a second time, and both opens proceed once the single pending preparation resolves

#### Scenario: A later PDF open reuses a successful preparation

- **WHEN** a PDF attachment is opened after `configurePdfWorker` has already resolved successfully in the same session
- **THEN** `configurePdfWorker` is not invoked again and the viewer mounts immediately

#### Scenario: A failed preparation can be retried

- **WHEN** `configurePdfWorker`'s returned promise rejects, and the user retries (or opens another PDF) afterward
- **THEN** `configurePdfWorker` is invoked again rather than the earlier rejection being reused

#### Scenario: Omitted adapter skips the preparation gate

- **WHEN** `configurePdfWorker` is not supplied
- **THEN** `DocumentPreview` mounts immediately using the existing CDN-hosted worker fallback, unchanged from current behavior

### Requirement: PDF and code content surfaces provide accessible loading, error, and retry states

The `PdfContent` and `CodeContent` dynamic-import and runtime-preparation paths SHALL each provide a local loading state exposed as `role="status"` with polite live-region behavior, and a local failure state exposed as `role="alert"` distinct from the unrelated `AttachmentContentType.Error` content-fetch failure state. A failure SHALL NOT strand a permanent loading indicator and SHALL NOT propagate to replace the entire canvas or application shell. The failure state SHALL offer a keyboard-accessible, labeled retry control with an approximately 44×44 CSS-pixel touch target on mobile that re-attempts the failed dynamic import or runtime preparation — including re-issuing the underlying module fetch rather than reusing an already-rejected import.

#### Scenario: PDF dynamic import failure shows a retryable error

- **WHEN** the dynamic import backing the PDF preview feature rejects
- **THEN** the canvas shows a `role="alert"` message with a labeled retry control instead of an indefinite spinner or an uncaught error reaching an ancestor error boundary

#### Scenario: Code syntax-highlighting failure shows a retryable error

- **WHEN** the dynamic import backing syntax highlighting rejects for a non-plaintext language
- **THEN** the code panel shows a `role="alert"` message with a labeled retry control, without discarding the already-available plain-text content

#### Scenario: Retry re-attempts the failed import

- **WHEN** the user activates the retry control after a dynamic-import or preparation failure
- **THEN** a new import/preparation attempt is issued, and a subsequent success renders the real PDF or syntax-highlighted content

#### Scenario: Loading state is announced without stealing focus

- **WHEN** the PDF or syntax-highlighting dynamic import is pending
- **THEN** an accessible polite status announcement reflects the pending state without moving keyboard focus
