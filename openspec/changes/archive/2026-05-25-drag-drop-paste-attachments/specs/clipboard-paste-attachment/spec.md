## ADDED Requirements

---

### Requirement: Paste image from clipboard as attachment

The `Input` component SHALL intercept `paste` events that contain image data (e.g. a screenshot copied to the clipboard). Each image item in `ClipboardEvent.clipboardData.items` with a MIME type starting with `image/` SHALL be converted to an `AttachmentType.Image` attachment. The paste event SHALL be prevented from inserting content into the textarea.

#### Scenario: Pasting a screenshot creates an image attachment

- **WHEN** the user presses Ctrl+V (or Cmd+V) while the input has focus and the clipboard contains an image
- **THEN** an `Attachment` with `type: AttachmentType.Image`, a synthetic filename `"Screenshot.png"`, and a valid `previewUrl` is added to the tray

#### Scenario: Pasted image does not insert text into textarea

- **WHEN** the clipboard contains an image and the user pastes
- **THEN** the textarea content is unchanged

#### Scenario: `onAttachmentsChange` fired after image paste

- **WHEN** a clipboard image is pasted
- **THEN** `onAttachmentsChange` is called with the updated attachment list

#### Scenario: Multiple image items pasted at once

- **WHEN** the clipboard contains two image items
- **THEN** two image attachments are added to the tray

#### Scenario: Null clipboardData degrades silently

- **WHEN** `ClipboardEvent.clipboardData` is `null` (e.g. sandboxed iframe)
- **THEN** the paste event proceeds normally with no attachment created and no error thrown

---

### Requirement: Paste long text as a Pasted attachment

The `Input` component SHALL intercept `paste` events containing plain text whose length exceeds `pasteTextThreshold`. When the threshold is exceeded, the pasted text SHALL be wrapped in a synthetic `File` (`type: 'text/plain'`, name `"Pasted text"`) and added as an `AttachmentType.Pasted` attachment. The paste event SHALL be prevented from inserting the text into the textarea.

#### Scenario: Short text paste inserts inline

- **WHEN** the user pastes text whose length is less than or equal to `pasteTextThreshold`
- **THEN** the text is inserted into the textarea normally and no attachment is created

#### Scenario: Long text paste creates Pasted attachment

- **WHEN** the user pastes text whose length exceeds `pasteTextThreshold`
- **THEN** an `Attachment` with `type: AttachmentType.Pasted`, `name: "Pasted text"`, and `contentType: "text/plain"` is added to the tray

#### Scenario: Long text does not insert into textarea

- **WHEN** the pasted text exceeds the threshold
- **THEN** the textarea content is unchanged after the paste

#### Scenario: `onAttachmentsChange` fired after long text paste

- **WHEN** a long-text paste creates an attachment
- **THEN** `onAttachmentsChange` is called with the updated attachment list

#### Scenario: Default threshold is 2000 characters

- **WHEN** `pasteTextThreshold` is not provided and the pasted text is exactly 2001 characters
- **THEN** it is treated as an attachment, not inline text

#### Scenario: Default threshold — text at limit inserts inline

- **WHEN** `pasteTextThreshold` is not provided and the pasted text is exactly 2000 characters
- **THEN** the text is inserted into the textarea normally

#### Scenario: Custom threshold respected

- **WHEN** `pasteTextThreshold={500}` and the pasted text is 501 characters
- **THEN** it is treated as an attachment

#### Scenario: Threshold of Infinity disables feature

- **WHEN** `pasteTextThreshold={Infinity}` is passed
- **THEN** no text paste is ever converted to an attachment regardless of length

---

### Requirement: `pasteTextThreshold` prop on `ConversationInput` and `Input`

Both `ConversationInput` and `Input` SHALL accept an optional `pasteTextThreshold?: number` prop (default `2000`) that controls the character count above which a pasted plain-text string is converted into an `AttachmentType.Pasted` attachment rather than inserted into the textarea. `ConversationInput` SHALL forward this value to `Input`.

#### Scenario: Prop forwarded from ConversationInput to Input

- **WHEN** `pasteTextThreshold={1000}` is set on `ConversationInput`
- **THEN** `Input` uses 1000 as the threshold for paste handling
