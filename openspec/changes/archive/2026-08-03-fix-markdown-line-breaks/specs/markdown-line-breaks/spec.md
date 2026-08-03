## ADDED Requirements

### Requirement: Single newline renders as a visible line break

`MarkdownRenderer` SHALL render a single `\n` between two lines of text within the same paragraph (no blank line separating them) as a visible line break, not as collapsed whitespace. This applies to all consumers of `MarkdownRenderer`/`MDMessageViewer`: assistant message bubbles, `StageMarkdownContent`, and citation-marker-augmented markdown.

#### Scenario: Poem with single-newline-separated lines

- **GIVEN** message content `"Line one\nLine two\nLine three"`
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** the rendered output contains three visually separated lines (a line-break element between each pair of consecutive lines)
- **AND** no line is concatenated with the next via a plain space

#### Scenario: Address-style content with single newlines

- **GIVEN** message content `"123 Main St\nSpringfield\nUSA"`
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** each of the three lines is rendered on its own visual line

### Requirement: Existing block-level Markdown/GFM constructs remain unaffected

Adding single-newline break support SHALL NOT change how `MarkdownRenderer` renders block-level constructs that already have defined CommonMark/GFM semantics: paragraphs separated by a blank line, ordered/unordered lists, tables, blockquotes, task list items, and fenced/indented code blocks.

#### Scenario: Blank-line-separated paragraphs stay separate paragraphs

- **GIVEN** message content `"Paragraph one.\n\nParagraph two."`
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** two distinct `<p>` elements are rendered, one per paragraph
- **AND** no extra line break is introduced inside either paragraph

#### Scenario: List items keep list semantics

- **GIVEN** message content `"- Item one\n- Item two\n- Item three"`
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** a single list element is rendered containing three list items
- **AND** items are not rendered as line-broken plain text inside a single paragraph

#### Scenario: GFM table renders unchanged

- **GIVEN** message content containing a GFM pipe table with a header row and two data rows
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** a table element is rendered with the header and two body rows, matching current (pre-change) rendering

#### Scenario: Fenced code block preserves internal newlines without extra breaks

- **GIVEN** message content containing a fenced code block with multiple lines, e.g. ` ```\nline1\nline2\n``` `
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** the code block content renders `line1` and `line2` on separate lines via the existing `MarkdownCodeBlock`/`<pre>` handling
- **AND** no additional `<br/>` elements are injected inside the code block

#### Scenario: Inline code span with no newline renders unchanged

- **GIVEN** message content `` "Use `const x = 1;` here" ``
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** the inline code span renders exactly as before this change, with no line-break element inserted
