## ADDED Requirements

### Requirement: AttachmentCard exposes an optional download callback

`AttachmentCardProps` (defined at `libs/conversation-input/src/models/AttachmentCard.ts`) SHALL accept two new optional props:

- `onDownload?: (id: string) => void` — called with the attachment's `id` when the user activates the download button. When `undefined`, the download button SHALL NOT be rendered.
- `downloadLabel?: string` — accessible label for the download button. Defaults to `'Download'`.

The download button SHALL be a `DialGhostIconButton` (icon: `IconDownload` from `@tabler/icons-react`) placed as the first button in the `absolute right-1 top-1` action container, before the retry and remove buttons. It SHALL receive the same `removeBtnClass` theming as the retry/remove buttons. It SHALL call `e.stopPropagation()` before invoking `onDownload` to prevent activating any parent click handler (e.g. the expand handler for pasted cards).

The button SHALL participate in the same visibility rules as the existing action buttons: hidden by default, revealed on `group-hover`, `group-focus-within`, and always visible on `mobile`.

#### Scenario: Download button absent when onDownload is undefined

- **WHEN** `AttachmentCard` is rendered without `onDownload`
- **THEN** no element with `aria-label` matching `downloadLabel` or `'Download'` is present in the rendered output

#### Scenario: Download button present when onDownload is provided

- **WHEN** `AttachmentCard` is rendered with `onDownload` defined
- **THEN** a button with `aria-label` equal to `downloadLabel` (or `'Download'` if omitted) is present in the rendered output

#### Scenario: Download callback fires with attachment id

- **WHEN** the user activates the download button
- **THEN** `onDownload` is called with the attachment's `id` value

#### Scenario: Download button does not propagate click to parent

- **WHEN** the user activates the download button on an expandable pasted card
- **THEN** `onDownload` is called and `onExpand` is NOT called

#### Scenario: Download button uses correct theming for image cards

- **WHEN** the attachment type is `AttachmentType.Image` with a `previewUrl`
- **THEN** the download button has the same class as the remove/retry buttons (dark background overlay matching `removeBtnImage` theming)

#### Scenario: Download button uses correct theming for file cards

- **WHEN** the attachment type is `AttachmentType.File`
- **THEN** the download button has the same class as the remove/retry buttons (card-background theming matching `actionBtn`)

#### Scenario: Download button order in action container

- **WHEN** `AttachmentCard` is rendered with both `onDownload` and `onRemove`
- **THEN** the download button appears before the remove button in DOM order
