## ADDED Requirements

### Requirement: Attachments claimed by an application visualizer are excluded from the plain attachment tray

`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` SHALL exclude
every `DisplayAttachment` claimed by a matched `ApplicationVisualizer` (see the
`application-visualizers` capability) from the array passed to
`AssistantMessageBubble`'s `attachments` prop, so a claimed attachment never renders as
a tray tile alongside the inline visualizer that already displays it.

The exclusion applies **after** the existing reference-only exclusion and uses the same
`nonReferenceDisplayAttachments` value as its input, so both filters compose rather than
competing.

Attachments the visualizer does not claim SHALL continue to be included in the tray
unchanged, in their original order.

When no registry entry matches the message's effective deployment id, the array passed
to the bubble SHALL be byte-for-byte what it is today.

#### Scenario: Claimed attachment does not render a tray tile

- **WHEN** an assistant message's effective deployment id matches a registry entry that claims one of its attachments
- **THEN** the `DisplayAttachment[]` passed to `AttachmentGroup` does not include an entry for it
- **AND** the inline grouped visualizer renders it instead

#### Scenario: Unclaimed attachments keep their tiles and order

- **WHEN** the matched entry declares `contentType` and the message also carries attachments of other types
- **THEN** those attachments appear in the tray in their original relative order

#### Scenario: No matched entry leaves the tray untouched

- **WHEN** the message's effective deployment id is absent from the registry
- **THEN** the `DisplayAttachment[]` passed to `AttachmentGroup` is unchanged from current behavior

#### Scenario: Reference-only exclusion still applies

- **WHEN** a message carries a reference-only attachment and its deployment matches an entry that omits `contentType`
- **THEN** the reference-only attachment is excluded from the tray as it is today
- **AND** it is not claimed by the visualizer, because it has no resolvable `url`
