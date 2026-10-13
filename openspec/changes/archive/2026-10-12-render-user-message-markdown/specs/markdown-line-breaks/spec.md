## MODIFIED Requirements

### Requirement: Single newline renders as a visible line break

`MarkdownRenderer` SHALL render a single `\n` between two lines of text within the same paragraph (no blank line separating them) as a visible line break, not as collapsed whitespace. This applies to all consumers of `MarkdownRenderer`/`MDMessageViewer`: assistant message bubbles, user message bubbles, `StageMarkdownContent`, and citation-marker-augmented markdown.

#### Scenario: Poem with single-newline-separated lines

- **GIVEN** message content `"Line one\nLine two\nLine three"`
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** the rendered output contains three visually separated lines (a line-break element between each pair of consecutive lines)
- **AND** no line is concatenated with the next via a plain space

#### Scenario: Address-style content with single newlines

- **GIVEN** message content `"123 Main St\nSpringfield\nUSA"`
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** each of the three lines is rendered on its own visual line

#### Scenario: Multi-line user prompt

- **GIVEN** a user message whose content is `"First line\nSecond line"`
- **WHEN** the user bubble renders it
- **THEN** the two lines render on separate visual lines, as they did before user messages rendered Markdown
