## ADDED Requirements

---

### Requirement: Message attachment tray

`libs/conversation-messages` SHALL expose a `MessageAttachmentTray` component that renders `ApiAttachment[]` read-only, with image attachments shown as 100×100 thumbnails (linking to the original `url`) and non-image attachments as file cards displaying the filename without extension on top and the file extension/MIME type on the bottom.

#### Scenario: Image renders as thumbnail

- **WHEN** an attachment has a `type` starting with `image/` and a non-empty `url`
- **THEN** it renders as a clickable `<a>` wrapping an `<img src={url}>`, opening the file in a new tab

#### Scenario: File renders as card

- **WHEN** an attachment has a non-image MIME type
- **THEN** it renders as a card showing `getFileNameWithoutExtension(title)` and `getFileNameExtension(title) || type`

#### Scenario: Empty list renders nothing

- **WHEN** the `attachments` prop is an empty array
- **THEN** the tray returns `null`

#### Scenario: Side alignment

- **WHEN** `side="user"`
- **THEN** the tray is right-aligned (`justify-end`)
- **WHEN** `side="assistant"`
- **THEN** the tray is left-aligned (`justify-start`)

---

### Requirement: UserMessageBubble renders attachments and hides empty text bubble

`UserMessageBubble` SHALL accept an `attachments?: ApiAttachment[]` prop and render `MessageAttachmentTray` above the text bubble. The text bubble SHALL only render when `text` is truthy.

#### Scenario: Attachments-only message

- **WHEN** the message has attachments and empty `text`
- **THEN** only the attachment tray renders (no empty bubble below it)

#### Scenario: Text-only message

- **WHEN** the message has text and no attachments
- **THEN** only the text bubble renders (the tray is absent)

#### Scenario: Text-and-attachments message

- **WHEN** the message has both
- **THEN** the attachment tray renders above the text bubble, both right-aligned

---

### Requirement: AssistantMessageBubble renders attachments

`AssistantMessageBubble` SHALL accept `attachments?: ApiAttachment[]` and render `MessageAttachmentTray` with `side="assistant"` alongside the assistant's text content.

#### Scenario: Assistant response with image

- **WHEN** the assistant message has an image attachment
- **THEN** the thumbnail renders left-aligned alongside (or below, per layout) the response text
