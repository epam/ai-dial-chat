## ADDED Requirements

### Requirement: Attached clients retain output when terminal persistence fails

When a terminal save rejects, the generation registry SHALL send attached subscribers an `error` terminal event with `errorType: 'conversation_save_failed'` and safe fallback text, including when the model was stopped by the user. The attached client SHALL retain its assembled snapshot and subsequent deltas, show its host-provided persistence warning, and settle its streaming controls without replacing the answer with a stored placeholder. The existing lease checks and finalization timeout remain applicable.

#### Scenario: Storage fails after an attached client sees progress

- **WHEN** an attached client receives an assistant snapshot and further stage/text deltas and the terminal save rejects
- **THEN** it receives a persistence-error terminal event and keeps the assembled answer with the warning

#### Scenario: Legacy backend reports done but storage still has a placeholder

- **WHEN** an attach stream ends and the terminal reload returns an unresolved placeholder after the client received generated content
- **THEN** the client preserves the generated content and shows a persistence warning

#### Scenario: A resumed generation is superseded

- **WHEN** a local generation replaces the buffer owned by an earlier resume while the earlier terminal reload is pending
- **THEN** that resume callback does not overwrite the new generation or clear its streaming state
