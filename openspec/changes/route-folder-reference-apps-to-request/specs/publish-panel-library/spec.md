## MODIFIED Requirements

### Requirement: PublishPanel renders a direct destination
`PublishPanel` SHALL also accept an optional host-supplied `directUnavailableNote?: string` (default none), a finished sentence for when the direct path is unavailable for a reason the host names; the library decides nothing about it. While the admin-approval callout is shown, the sentence SHALL be rendered inside that same callout as a continuation of its text, so the panel shows one callout. When a callout of another kind is shown instead of the admin-approval callout, the sentence SHALL be rendered as an information callout of its own while submit is still possible (a failed submit that can be retried, or a replace that is allowed), and SHALL NOT be rendered while submit is blocked. It SHALL NOT be rendered when `isDirectWrite` is `true`. `PublishPanel` SHALL accept optional `isDirectWrite?: boolean` (default `false`) and, for `true`, SHALL NOT render the author field or the credentials checkbox, SHALL render `labels.directWriteNote` (optional, default none: rendered only when the host supplies it) in the credentials section's place. The panel takes no decision of its own: the host passes the flow's `isDirectWrite`.

#### Scenario: Direct destination
- **WHEN** `isDirectWrite` is `true`
- **THEN** none of the three publication-only sections is rendered and the note is shown when `labels.directWriteNote` is supplied

#### Scenario: Direct path unavailable because of dependencies
- **WHEN** the host supplies `directUnavailableNote`, `isDirectWrite` is `false` and the admin-approval callout is shown
- **THEN** the sentence is the continuation of that callout's text in the same block, no second callout is rendered, and submit files a request as usual

#### Scenario: Another callout, submit still possible
- **WHEN** the host supplies `directUnavailableNote`, `isDirectWrite` is `false` and a callout of another kind is shown instead of the approval callout while submit is enabled (the replace warning with replace allowed, or a failed submit)
- **THEN** the sentence is rendered as an information callout of its own

#### Scenario: Another callout, submit blocked
- **WHEN** the host supplies `directUnavailableNote`, `isDirectWrite` is `false` and a callout of another kind is shown while submit is disabled (the replace warning with replace not allowed)
- **THEN** the sentence is not rendered

#### Scenario: Direct write ignores the note
- **WHEN** the host supplies `directUnavailableNote` and `isDirectWrite` is `true`
- **THEN** the sentence is not rendered

#### Scenario: Default
- **WHEN** `isDirectWrite` is omitted
- **THEN** the panel renders exactly as before
