# Spec: conversation-messages-attachments

## Requirements

---

### Requirement: MessageAttachmentTray renders ApiAttachment[]

`libs/conversation-messages` SHALL export a `MessageAttachmentTray` component that renders a read-only horizontal list of `ApiAttachment` items. The tray SHALL accept three props: `attachments: ApiAttachment[]`, `side: 'user' | 'assistant'`, and `className?: string`. Image attachments (MIME type starting with `image/`) with a non-empty `url` SHALL render as a 100×100 clickable `<a>` wrapping an `<img>` that opens the original file in a new tab. Non-image attachments SHALL render as a file card showing `getFileNameWithoutExtension(title)` on top and `getFileNameExtension(title) || type` on the bottom.

#### Scenario: Image attachment renders as thumbnail

- **WHEN** an attachment has `type` starting with `image/` and a non-empty `url`
- **THEN** the tray renders an `<a href={url} target="_blank">` wrapping an `<img src={url}>` sized 100×100, with `aria-label={title}`

#### Scenario: Non-image attachment renders as file card

- **WHEN** an attachment has a non-image `type`
- **THEN** the tray renders a 100×100 card showing the title (without extension) and the extension or MIME type underneath

#### Scenario: Empty list renders nothing

- **WHEN** the `attachments` prop is an empty array
- **THEN** the component returns `null`

#### Scenario: User-side alignment

- **WHEN** `side="user"`
- **THEN** the tray's flex container has `justify-end` (right-aligned)

#### Scenario: Assistant-side alignment

- **WHEN** `side="assistant"`
- **THEN** the tray's flex container has `justify-start` (left-aligned)

---

### Requirement: UserMessageBubble renders attachments and hides empty text

`UserMessageBubble` SHALL accept an optional `attachments?: ApiAttachment[]` prop. When non-empty, the bubble SHALL render `<MessageAttachmentTray side="user" attachments={attachments} />` above the text bubble. The text bubble (`<div>` with `userBubble` style + `<p>{text}</p>`) SHALL only render when `text` is truthy (non-empty string).

#### Scenario: Attachments-only message hides text bubble

- **WHEN** the message has at least one attachment and `text` is empty
- **THEN** only the attachment tray renders; no empty styled bubble appears below it

#### Scenario: Text-only message hides tray

- **WHEN** the message has text and no attachments
- **THEN** only the text bubble renders

#### Scenario: Text-and-attachments message renders both

- **WHEN** the message has both text and attachments
- **THEN** the attachment tray renders above the text bubble; both are right-aligned

#### Scenario: Round-trip rendering after reload

- **WHEN** a conversation containing a message with attachments is loaded from the backend
- **THEN** the `UserMessageBubble` for that message renders the same attachments it was sent with (via `custom_content` persistence)

---

### Requirement: AssistantMessageBubble renders attachments

`AssistantMessageBubble` SHALL accept an optional `attachments?: ApiAttachment[]` prop and render `<MessageAttachmentTray side="assistant" attachments={attachments} />` alongside the assistant's text content.

#### Scenario: Assistant attachment renders left-aligned

- **WHEN** an assistant message has an image attachment
- **THEN** the thumbnail renders left-aligned within the assistant message layout

---

### Requirement: Filename utilities are shared

`getFileNameWithoutExtension(title: string): string` and `getFileNameExtension(title: string): string` SHALL be exported from `libs/chat-shared/src/utils/file-name.ts` and re-exported from the package barrel. They SHALL be used by both `libs/conversation-input` (input card) and `libs/conversation-messages` (message card) so filename parsing is consistent across the codebase.

#### Scenario: getFileNameWithoutExtension strips the last dot-segment

- **WHEN** called with `"report.final.pdf"`
- **THEN** returns `"report.final"`

#### Scenario: getFileNameExtension returns the last dot-segment

- **WHEN** called with `"report.final.pdf"`
- **THEN** returns `"pdf"`

#### Scenario: No extension returns empty string

- **WHEN** called with `"README"`
- **THEN** `getFileNameExtension` returns `""` and `getFileNameWithoutExtension` returns `"README"`
