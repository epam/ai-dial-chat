# Spec: markdown-line-breaks

## Purpose

Defines how `MarkdownRenderer` handles single vs. double newlines in message content, ensuring a single `\n` inside a paragraph is preserved as a visible line break while all existing block-level Markdown/GFM constructs (paragraphs, lists, tables, code fences, inline code) continue to render exactly as before.

## Requirements

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

### Requirement: Parse literal raw HTML in markdown source into real elements

`MarkdownRenderer` SHALL run `rehypeRaw` over the parsed tree so that raw HTML left as literal text by `remark` (e.g. a model emitting `<br>` for a line break) is re-parsed into real hast elements and rendered as actual DOM nodes, rather than being displayed as escaped text.

#### Scenario: Literal `<br>` tag renders as a real line break

- **GIVEN** message content `"Line one <br>Line two"`
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** a real `<br>` element is rendered between "Line one" and "Line two"
- **AND** the rendered text does not contain the literal substring `<br>`

### Requirement: Sanitize raw HTML output

`MarkdownRenderer` SHALL run `rehypeSanitize` (extending `defaultSchema` from `rehype-sanitize`) after `rehypeRaw` and `rehypeKatex` in the shared rehype plugin pipeline, so that any element or attribute the raw-HTML pass could have introduced — and that is not explicitly allow-listed — is stripped before render. This applies to all consumers of `MarkdownRenderer`/`MDMessageViewer`.

The extended schema MUST allow-list, on top of `defaultSchema`:
- The MathML tag set produced by `rehypeKatex`'s `output: 'mathml'` mode (e.g. `math`, `mrow`, `mi`, `mo`, `mn`, `semantics`, `annotation`, …), so KaTeX-rendered formulas are not stripped.
- The `className` attribute on `code` elements, so the `language-*` class used for fenced-code-block language detection (see `markdown-code-blocks` spec) survives sanitization.

Plugin order is significant: `rehypeRaw` MUST run first so raw HTML text nodes become real elements before any later plugin inspects the tree, and `rehypeSanitize` MUST run last so it can catch anything unsafe that `rehypeRaw` or `rehypeKatex` introduced.

#### Scenario: Dangerous raw HTML is stripped

- **GIVEN** message content containing a raw `<script>` tag or an `onerror` attribute on an `<img>` tag
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** the dangerous tag/attribute is not present in the rendered DOM

#### Scenario: KaTeX MathML output survives sanitization

- **GIVEN** message content containing inline math, e.g. `"$x^2$"`
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** the `rehypeKatex` MathML output (`<math>`, `<mi>`, `<mo>`, etc.) is rendered, not stripped

#### Scenario: Fenced code block language class survives sanitization

- **GIVEN** the markdown string contains ` ```typescript\nconst x = 1;\n``` `
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** the `<code>` element's `language-typescript` class is preserved through sanitization, so language detection (see `markdown-code-blocks` spec) continues to work
