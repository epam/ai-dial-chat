# Spec: attachment-card-click

## Purpose

Specifies how `AttachmentCard` gains an optional click handler, how `resolveDialFileDownloadUrl` is exported from `icon-path.ts`, and how the `useAttachmentAction` hook resolves and triggers the correct action (download) when a card is activated.

---

## Requirements

### Requirement: `AttachmentCard` accepts an `onClick` callback and becomes interactive when provided

`libs/conversation-input/src/models/AttachmentCard.ts` SHALL add the following optional prop to `AttachmentCardProps`:

- `onClick?: (id: string) => void` — Called when the user clicks or keyboard-activates the card. Receives the attachment `id`.
- `clickLabel?: string` — Accessible label applied to the card root when it is interactive. Defaults to `'Open attachment'`.

When `onClick` is provided, `AttachmentCard` SHALL:
- Set `role="button"` on the card root element.
- Set `tabIndex={0}` on the card root element.
- Set `aria-label={clickLabel}` on the card root element.
- Add `cursor-pointer` to the card root class list.
- Call `onClick(id)` on left-click and on `Enter` or `Space` key press.
- Ensure that clicks on inner action buttons (`onRemove`, `onRetry`) do NOT propagate to the card-level `onClick`.

When `onClick` is not provided, the card SHALL remain inert (no `role`, no `tabIndex`, no keyboard handler added for card activation).

The `onClick` prop SHALL be independent of `onExpand`. When both are supplied, `onExpand` takes precedence for pasted-text cards (existing behaviour unchanged); `onClick` applies only when `onExpand` is not active.

#### Scenario: Card is inert without `onClick`

- **WHEN** `AttachmentCard` is rendered without an `onClick` prop
- **THEN** the card root has no `role="button"`, no `tabIndex`, and no `cursor-pointer` class

#### Scenario: Card is interactive with `onClick`

- **WHEN** `AttachmentCard` is rendered with an `onClick` prop
- **THEN** the card root has `role="button"`, `tabIndex={0}`, and `cursor-pointer`
- **AND** the `aria-label` on the card root equals the `clickLabel` prop value (or `'Open attachment'` if omitted)

#### Scenario: Mouse click invokes `onClick`

- **WHEN** a user clicks the card body (not an action button) and `onClick` is provided
- **THEN** `onClick` is called once with the attachment's `id`

#### Scenario: Keyboard activation invokes `onClick`

- **WHEN** the card has focus and the user presses `Enter` or `Space` and `onClick` is provided
- **THEN** `onClick` is called once with the attachment's `id`

#### Scenario: Action button click does not propagate to `onClick`

- **WHEN** the user clicks the remove button and both `onRemove` and `onClick` are provided
- **THEN** `onRemove` is called and `onClick` is NOT called

#### Scenario: `onExpand` takes precedence over `onClick` for pasted cards

- **WHEN** `AttachmentCard` receives both `onExpand` and `onClick` and the card type is `AttachmentType.Pasted`
- **THEN** clicking the card invokes `onExpand`, not `onClick`

---

### Requirement: `resolveDialFileDownloadUrl` is exported from `icon-path.ts`

`apps/chat/src/utils/icon-path.ts` SHALL export the `resolveDialFileDownloadUrl(fileId: string): string | undefined` function. The function SHALL convert a DIAL file identifier (`files/{bucket}/{path}`) to the BFF download query string URL (`/api/v1/files/download?bucket=…&path=…`). If the file ID does not start with `files/` or contains no path segment after the bucket, the function SHALL return `undefined`.

The path segment SHALL be decoded with `decodeURIComponent` before being set as the `path` query parameter; if decoding throws, the raw segment SHALL be used.

#### Scenario: Valid DIAL file ID resolves to BFF URL

- **WHEN** `resolveDialFileDownloadUrl('files/my-bucket/reports/q1.pdf')` is called
- **THEN** the returned URL is `/api/v1/files/download?bucket=my-bucket&path=reports%2Fq1.pdf` (or equivalent `URLSearchParams` encoding)

#### Scenario: Percent-encoded path segment is decoded before passing as query param

- **WHEN** `resolveDialFileDownloadUrl('files/my-bucket/folder%2Fname.pdf')` is called
- **THEN** the `path` query parameter value is `folder/name.pdf` (decoded)

#### Scenario: Non-DIAL-file URL returns undefined

- **WHEN** `resolveDialFileDownloadUrl('https://external.com/file.pdf')` is called
- **THEN** the function returns `undefined`

#### Scenario: File ID with no path segment returns undefined

- **WHEN** `resolveDialFileDownloadUrl('files/only-bucket')` is called
- **THEN** the function returns `undefined`

---

### Requirement: `useAttachmentAction` hook resolves and triggers the correct action per attachment

`apps/chat/src/hooks/attachment/useAttachmentAction.ts` SHALL export `useAttachmentAction()` returning a stable callback `handleAttachmentClick: (attachment: DisplayAttachment) => void`.

For this slice, the hook SHALL implement a single action: **download**. When `handleAttachmentClick` is called with an attachment:

1. If `attachment.url` is a DIAL file ID (starts with `files/`), resolve the BFF download URL via `resolveDialFileDownloadUrl`. If resolution fails (returns `undefined`), do nothing.
2. Otherwise, do nothing (no download for attachments without a DIAL file URL).
3. Trigger a browser download by programmatically clicking a temporary `<a>` element with `href` set to the resolved URL and the `download` attribute set to `attachment.name`.

The hook SHALL be extensible: future handlers for different MIME types, attachment types, or metadata SHALL be addable by extending the routing logic inside `useAttachmentAction` without modifying callers.

The returned callback SHALL be stable across re-renders (wrapped in `useCallback` with an empty dependency array, or equivalent).

#### Scenario: DIAL file attachment triggers a download

- **WHEN** `handleAttachmentClick` is called with an attachment whose `url` is `'files/my-bucket/folder/file.pdf'`
- **THEN** a temporary anchor with `href` equal to the resolved BFF URL and `download` set to `attachment.name` is clicked programmatically

#### Scenario: Attachment without a DIAL file URL is a no-op

- **WHEN** `handleAttachmentClick` is called with an attachment whose `url` is `undefined` or an absolute external URL
- **THEN** no anchor is created and no navigation occurs

#### Scenario: Callback reference is stable

- **WHEN** `useAttachmentAction` is rendered twice without state changes
- **THEN** the returned `handleAttachmentClick` reference is the same object both times
