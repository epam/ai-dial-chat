## ADDED Requirements

### Requirement: Attachment symbols are imported from their owning package
Every consumer SHALL import `AttachmentCard`, `AttachmentTray`, `AttachmentGroup`,
`FileDndOverlay`, `getAttachmentIcon`, and `AttachmentGroupProps` from
`@epam/ai-dial-attachment-input`, the package that owns them.
`libs/conversation-input/src/index.ts` SHALL NOT re-export them.

A library that renders any of those components SHALL declare
`@epam/ai-dial-attachment-input` in its own `peerDependencies` and mark it external in its bundler
config, rather than reaching it transitively through `@epam/ai-dial-conversation-input`. A library
that no longer imports anything from `@epam/ai-dial-conversation-input` SHALL drop that peer
dependency.

#### Scenario: Attachment components resolve from the owning package
- **WHEN** `conversation-messages`, `source-panel`, or `apps/chat` renders an attachment component
- **THEN** it imports the component from `@epam/ai-dial-attachment-input`, and the import from
  `@epam/ai-dial-conversation-input` does not resolve that name

#### Scenario: The dependency the re-export hid is declared
- **WHEN** `@epam/ai-dial-conversation-messages` or `@epam/ai-dial-source-panel` is built
- **THEN** each declares `@epam/ai-dial-attachment-input` as a peer dependency and marks it
  external, its TypeScript project references include `attachment-input`, and neither declares
  `@epam/ai-dial-conversation-input`, which it no longer imports

## REMOVED Requirements

### Requirement: libs/conversation-input re-exports moved symbols

**Reason**: The re-export was added for backwards compatibility when the attachment components were
extracted out of `libs/conversation-input` into `libs/attachment-input`. It has outlived that
purpose: it makes `conversation-input` read as the owner of symbols it does not own, and it hid a
real dependency — `conversation-messages` and `source-panel` render attachment-input's components
while declaring only `conversation-input` as a peer, so the true edge was invisible in both
`package.json` and the Nx project graph. All six consumers now import from the owning package.

**Migration**: Import `AttachmentCard`, `AttachmentTray`, `AttachmentGroup`, `FileDndOverlay`,
`getAttachmentIcon`, and `AttachmentGroupProps` from `@epam/ai-dial-attachment-input` instead of
`@epam/ai-dial-conversation-input`, and add `@epam/ai-dial-attachment-input` to the consuming
package's `peerDependencies` and bundler externals. A `vi.mock('@epam/ai-dial-conversation-input')`
that stubs any of these components must be retargeted to `@epam/ai-dial-attachment-input` — the
module path is a string, so the compiler cannot flag it.
