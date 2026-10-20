## REMOVED Requirements

### Requirement: Footer message renders in both desktop and mobile layouts

**Reason**: The mobile navigation sheet that carried a second `FooterMessage` is no longer mounted by the app.

**Migration**: Replaced by "Footer message renders below the chat input at every breakpoint".

## ADDED Requirements

### Requirement: Footer message renders below the chat input at every breakpoint

`FooterMessage` SHALL render below the chat input area of `ConversationView` and
`NewConversationComposer` at every breakpoint. Each placement mounts its own `FooterMessage`
instance; no screen-size render guard selects between them. The navigation drawer carries no
footer message.

The footer region SHALL be a positioning context (`relative`) whose direct children are the
sanitized-message element and the version label, rather than a single element hosting the
sanitized HTML. When both render, the message element keeps `text-center` across the region's
full width so its centring is unaffected by the label's presence or length, and the label is
absolutely positioned out of flow to achieve that. When the message does not render, the label
stays in normal flow, because a section with no in-flow child collapses to its own padding and
an out-of-flow label would paint outside it.

- **RTL impact**: the footer container uses logical inline padding (`ps-*`/`pe-*` or symmetric
  `px-*`) and `text-center` (direction-agnostic); the version label uses the logical `end-*`
  inset on an element that inherits page direction, so it pins to the correct corner in both
  directions — a `dir` attribute on that element would make the logical inset resolve against
  its own direction and defeat the flip

#### Scenario: Placement

- **WHEN** a conversation or the new-conversation composer is shown at any breakpoint
- **THEN** `FooterMessage` is visible below the chat input area

#### Scenario: Screen reader identifies footer region

- **WHEN** `FooterMessage` renders with a non-empty message or a version label
- **THEN** the root element is a `<section>` labelled by `footerMessage.regionAriaLabel`, and the
  version is announced through a screen-reader-only `footerMessage.versionAriaLabel` text while
  the visible `formatAppVersion` label is `aria-hidden`

#### Scenario: Message stays centred with a version label present

- **WHEN** both the sanitized footer message and the version label render
- **THEN** the message element remains centred against the region's full width and is not offset
  by the label
