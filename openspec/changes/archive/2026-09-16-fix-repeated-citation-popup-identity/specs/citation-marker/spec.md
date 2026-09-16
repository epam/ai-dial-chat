## ADDED Requirements

### Requirement: Every occurrence of a repeated citation id renders its own marker

When one message's content contains the same supported `<cit data-id="X"></cit>` element more than once and a matching `html_tag` group exists for `"X"`, a citation marker SHALL be rendered at **every** occurrence. No occurrence SHALL be suppressed, collapsed into a neighbour, or replaced with literal text on the grounds that an earlier occurrence already rendered a marker for that id.

Markers SHALL likewise remain distinct when two **different** citation ids resolve to annotations whose quoted text is identical, or whose `body.source.attachment.url` is identical. Grouping SHALL continue to key on `target.selector.id` for the `html_tag` family, so two distinct ids citing one document remain two groups and two markers, and identical quote text SHALL never be used as a grouping or deduplication key.

Each rendered marker SHALL be independently activatable by mouse and by keyboard, and activating one SHALL open exactly one card anchored to that marker while closing any card opened from another marker.

#### Scenario: A repeated cit id renders a marker at each occurrence

- **WHEN** the content is `Alice did X<cit data-id="e1"></cit> Bob did X<cit data-id="e1"></cit> Carol did X<cit data-id="e1"></cit>`, `isStreaming` is `false`, and one `html_tag` group matches `"e1"`
- **THEN** three citation markers are rendered and no literal `<cit>` markup is visible

#### Scenario: Repeated markers in separate paragraphs each render

- **WHEN** two paragraphs each end with `<cit data-id="e1"></cit>` and a matching group exists
- **THEN** each paragraph shows its own marker

#### Scenario: Distinct ids with identical quote text stay distinct

- **WHEN** two `html_tag` annotations carry different `target.selector.id` values, identical `body.quote` text, and the same `body.source.attachment.url`
- **THEN** `groupAnnotationsByCitId` produces two groups with distinct `groupKey`s, two markers render, and neither annotation is dropped or merged into the other

#### Scenario: Keyboard activation opens one card

- **WHEN** the user moves focus to a repeated occurrence's marker and activates it with the keyboard
- **THEN** exactly one card opens, anchored to that marker

#### Scenario: Activating another occurrence closes the first card

- **WHEN** one occurrence's card is open and the user activates a different occurrence's marker
- **THEN** the first card is no longer rendered and exactly one card — the second occurrence's — is open
