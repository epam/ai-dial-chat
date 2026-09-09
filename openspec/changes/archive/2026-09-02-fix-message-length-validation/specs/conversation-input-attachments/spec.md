## MODIFIED Requirements

### Requirement: Message length validation

The `Input` component SHALL refuse to send a message whose text length is ≥
`maxMessageLength` (default `50000`), regardless of whether attachments are supported, and
SHALL call `onMessageTooLong(length, maxMessageLength)` instead. The textarea retains its
content so the user can shorten it. `maxMessageLength` is the cap on message text and is a
separate rule from `pasteTextThreshold`, which only decides when pasted text becomes an
attachment.

When `isAttachmentsEnabled` is `false` and the user pastes plain text whose length is ≥
`maxMessageLength`, the `Input` component SHALL additionally call
`onMessageTooLong(length, maxMessageLength)` at paste time. The pasted text is still
inserted inline — the component does NOT call `preventDefault`. The host app is responsible
for surfacing the error to the user (e.g. via a notification).

The paste-time warning is deliberately limited to `isAttachmentsEnabled === false`. When
attachments are enabled, an over-threshold paste becomes an attachment and leaves the inline
text untouched, and an under-threshold paste is at most `pasteTextThreshold` characters and
so cannot reach the cap on its own. Text already in the textarea plus a below-threshold
paste can exceed the cap; that case is caught by the send-time gate, not at paste time.

This applies to every surface that embeds `Input`:

- `ConversationInput` (used in `ConversationView` and `NewConversationComposer`)
- `EditMessageInput` (used in `ConversationMessageItem`)

#### Scenario: Send blocked when message reaches the cap and attachments are disabled

- **GIVEN** `isAttachmentsEnabled` is `false` and the textarea contains text of length ≥ `maxMessageLength`
- **WHEN** the user clicks the send button or presses the send key
- **THEN** `onMessageTooLong(length, maxMessageLength)` is called and the message is NOT sent
- **AND** the textarea retains its current content

#### Scenario: Send blocked when message reaches the cap and attachments are enabled

- **GIVEN** `isAttachmentsEnabled` is `true` and the user has typed text of length ≥ `maxMessageLength`
- **WHEN** the user clicks the send button or presses the send key
- **THEN** `onMessageTooLong(length, maxMessageLength)` is called and the message is NOT sent
- **AND** the textarea retains its current content

#### Scenario: Send allowed below the cap

- **GIVEN** the textarea contains text of length < `maxMessageLength`
- **WHEN** the user clicks the send button or presses the send key
- **THEN** `onMessageTooLong` is NOT called and the message is sent, whatever the value of `isAttachmentsEnabled`
- **AND** a length at or above `pasteTextThreshold` but below `maxMessageLength` does NOT block the send

#### Scenario: EditMessageInput Save & Submit blocked when message reaches the cap

- **GIVEN** the edit textarea contains text of length ≥ `maxMessageLength`
- **WHEN** the user clicks Save & Submit
- **THEN** `onMessageTooLong(length, maxMessageLength)` is called and the edit is NOT submitted, whatever the value of `isAttachmentsEnabled`

#### Scenario: Paste reaches the cap while attachments are disabled

- **GIVEN** `isAttachmentsEnabled` is `false`
- **WHEN** the user pastes text of length ≥ `maxMessageLength`
- **THEN** `onMessageTooLong(length, maxMessageLength)` is called and the text is inserted inline

#### Scenario: Paste below the cap while attachments are disabled

- **GIVEN** `isAttachmentsEnabled` is `false`
- **WHEN** the user pastes text of length < `maxMessageLength`
- **THEN** `onMessageTooLong` is NOT called at paste time and the text is inserted inline normally
- **AND** this holds even when the pasted length is at or above `pasteTextThreshold`

#### Scenario: Paste over the attachment threshold while attachments are enabled

- **GIVEN** `isAttachmentsEnabled` is `true`
- **WHEN** the user pastes text longer than `pasteTextThreshold`
- **THEN** the pasted text is converted to an attachment as usual and `onMessageTooLong` is NOT called at paste time

## RENAMED Requirements

- FROM: `Message length validation when attachments are disabled`
- TO: `Message length validation`
