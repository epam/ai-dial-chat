# markdown-code-blocks Specification

## Purpose

Fenced code blocks in rendered markdown: language detection, the copy action, theming, internal scrolling, RTL, and accessibility.

## Requirements

### Requirement: Render fenced code blocks with polished layout

The system SHALL render fenced code blocks (produced by react-markdown from ` ```lang … ``` ` and ` ``` … ``` ` markdown) using `MarkdownCodeBlock`, a dedicated component that owns its full container. The container MUST include:
- A visible frame (rounded border, background).
- A compact sticky header with the language label (start) and a copy icon button (end).
- A scrollable body with `max-h-[60vh] overflow-auto`.
- `dir="ltr"` on the scrollable body to preserve code direction on RTL pages.

The `pre` override in `MarkdownRenderer` MUST be a fragment passthrough so `MarkdownCodeBlock` controls the entire container.

#### Scenario: TypeScript fenced block renders with language label

- **GIVEN** the markdown string contains ` ```typescript\nconst x = 1;\n``` `
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** a code block container is rendered with the text `typescript` visible in its header
- **AND** a copy icon button is present in the header
- **AND** the text `const x = 1;` is rendered inside the scrollable body
- **AND** no `<pre>` element wraps the container as an outer ancestor

#### Scenario: JSON fenced block renders with language label

- **GIVEN** the markdown string contains ` ```json\n{"a":1}\n``` `
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** a code block container is rendered with the text `json` visible in its header

---

### Requirement: Detect language from `language-*` class

The system SHALL extract the language identifier from the `className="language-{lang}"` attribute that `react-markdown` places on `<code>` elements inside fenced blocks. Detection regex: `/language-(\w+)/`. The extracted string SHALL be passed as-is (lowercase) to the `MarkdownCodeBlock` `language` prop.

#### Scenario: Language extracted correctly

- **GIVEN** react-markdown produces `<code className="language-typescript">`
- **WHEN** the `code` component override runs
- **THEN** `language="typescript"` is passed to `MarkdownCodeBlock`

---

### Requirement: Support multiline code blocks without a language

The system SHALL treat a `<code>` node whose string children contain a newline character (`\n`) and whose `className` does not match `language-*` as a block code node. Such nodes MUST render as `MarkdownCodeBlock` with `language=""`. The header MUST NOT show any label text in this case but MUST still render the copy button (when not streaming).

#### Scenario: Plaintext multiline block without language

- **GIVEN** the markdown string contains a fenced block with no language tag: ` ```\nline1\nline2\n``` `
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** a `MarkdownCodeBlock` container is rendered
- **AND** the header contains no language label text
- **AND** the copy button is present
- **AND** both `line1` and `line2` appear inside the scrollable body

---

### Requirement: Preserve inline code behavior

Inline code (a `<code>` node whose children contain no `\n` and whose `className` does not contain `language-`) MUST continue to render as a plain `<code>` element with rounded padding and monospace font. It MUST NOT render a header or copy button.

#### Scenario: Inline code remains inline

- **GIVEN** the markdown string contains `` `someValue` `` inside a sentence
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** a `<code>` element is rendered with no enclosing `MarkdownCodeBlock` container
- **AND** no copy button is rendered
- **AND** the element has no role or structure beyond a styled inline `<code>`

---

### Requirement: Copy raw code content

The system SHALL provide a copy icon button inside each `MarkdownCodeBlock` header. Activating the button SHALL copy the raw code string (with trailing newline stripped, no markdown fences) to the clipboard using the `copyToClipboard` utility from `@epam/ai-dial-chat-shared`.

The copy button MUST be keyboard-focusable (rendered via `GhostIconButton`) and activatable via Enter and Space.

#### Scenario: Copy button copies raw code

- **GIVEN** a rendered `MarkdownCodeBlock` with `value="const x = 1;"`
- **WHEN** the user clicks (or activates via keyboard) the copy button
- **THEN** `copyToClipboard("const x = 1;")` is called

#### Scenario: Copy failure — clipboard API unavailable

- **GIVEN** `navigator.clipboard` is undefined (HTTP context)
- **WHEN** the user activates the copy button
- **THEN** the `execCommand('copy')` fallback in `copyToClipboard` is invoked silently
- **AND** no error toast is shown (silent fallback is acceptable)

---

### Requirement: Copied feedback

After a successful copy the system SHALL:
1. Switch the copy button icon from `IconCopy` to `IconCheck`.
2. Update the button's `aria-label` to `copiedLabel` (default `'Copied!'`).
3. Revert both after 2 000 ms.

The button MUST NOT be disabled during the feedback state (clicking again restarts the timer).

#### Scenario: Copy success feedback lifecycle

- **GIVEN** a rendered `MarkdownCodeBlock` in idle state (showing `IconCopy`)
- **WHEN** the user clicks the copy button
- **THEN** the icon switches to `IconCheck` immediately
- **AND** the `aria-label` becomes `copiedLabel`
- **AND** after 2 000 ms the icon reverts to `IconCopy` and the label reverts to `copyLabel`

---

### Requirement: Preserve formatting and support internal scrolling

Code content MUST be rendered with `whitespace-pre` so that indentation and line breaks are preserved exactly. Long lines MUST scroll horizontally inside the code body rather than wrapping or expanding the message bubble. Tall code blocks (exceeding 60 vh) MUST show an internal scrollbar (`max-h-[60vh] overflow-auto`) rather than growing the message container.

#### Scenario: Long line horizontal scrolling

- **GIVEN** a code block containing a single line longer than the container width
- **WHEN** rendered
- **THEN** the line does not wrap
- **AND** a horizontal scrollbar appears inside the code body
- **AND** the outer message bubble width is unchanged

#### Scenario: Tall block internal scrolling

- **GIVEN** a code block with more lines than fit in 60 vh
- **WHEN** rendered
- **THEN** the code body is capped at 60 vh height
- **AND** a vertical scrollbar appears inside the code body
- **AND** the page does not grow to accommodate the full code height

---

### Requirement: Support light and dark themes

`MarkdownCodeBlock` MUST NOT hardcode a background color that is incompatible with either light or dark theme. The container and header MUST use `bg-black/20` (alpha-transparent overlay) so the component composes correctly over any message bubble background in both themes.

#### Scenario: Code block in light theme

- **GIVEN** the page renders in light mode
- **WHEN** a `MarkdownCodeBlock` is rendered
- **THEN** the container and header are visible and readable

#### Scenario: Code block in dark theme

- **GIVEN** the page renders in dark mode
- **WHEN** a `MarkdownCodeBlock` is rendered
- **THEN** the container and header are visible and readable

---

### Requirement: Support RTL pages while keeping code LTR

When the page `<html>` element has `dir="rtl"`:
1. The `MarkdownCodeBlock` container layout (header flex, padding, border radius) MUST respond to writing direction via logical Tailwind properties (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`).
2. The scrollable code body MUST have `dir="ltr"` set explicitly so code text and horizontal scroll direction are always left-to-right.

No icon mirroring is required (`IconCopy` and `IconCheck` are symmetric).

#### Scenario: RTL page rendering

- **GIVEN** the page `<html dir="rtl">` is set (Arabic locale active)
- **WHEN** a `MarkdownCodeBlock` is rendered
- **THEN** the header language label aligns to the logical start (right edge in RTL)
- **AND** the copy button aligns to the logical end (left edge in RTL)
- **AND** the code content inside the scrollable body reads left-to-right (code is LTR)
- **AND** the horizontal scrollbar appears on the right side of the code body

---

### Requirement: Accessibility and keyboard support

- The copy button MUST be rendered via `GhostIconButton`, which produces a `<button>` element that is keyboard-focusable and activatable via Enter and Space.
- The `aria-label` MUST reflect the current state: `copyLabel` when idle, `copiedLabel` after copy.
- The code text MUST remain selectable by the user (no `user-select: none` override).
- Focus MUST NOT be trapped inside the code block.

#### Scenario: Keyboard copy activation

- **GIVEN** focus is on the copy button inside a `MarkdownCodeBlock`
- **WHEN** the user presses Enter or Space
- **THEN** the copy action fires (same as clicking)
- **AND** the icon and label switch to the copied state

---

### Requirement: Preserve existing table rendering behavior

Introducing `MarkdownCodeBlock` MUST NOT alter the rendering of GFM tables. `MarkdownTable` continues to receive the `table` component override; its `classNames.tableWrapper` / `classNames.tableFont` forwarding is unchanged.

#### Scenario: Existing GFM table still renders correctly

- **GIVEN** the markdown string contains a GFM table (`| Name | Value | …`)
- **WHEN** `MarkdownRenderer` renders the content
- **THEN** a `<table>` element is rendered inside a horizontally scrollable container (as per existing behavior)
- **AND** no `MarkdownCodeBlock` is rendered

---

### Requirement: Hide copy button during streaming

When `isStreaming` is `true` the copy button MUST NOT be rendered. The code content is still visible and updating. The copy button appears once `isStreaming` becomes `false`.

#### Scenario: Streaming message behavior

- **GIVEN** `isStreaming={true}` is passed to `MarkdownRenderer`
- **WHEN** a code block is rendered during streaming
- **THEN** no copy button is rendered inside any `MarkdownCodeBlock`
- **AND** the code content is still visible

---

## i18n Keys

| Key | Default value | Usage |
|-----|---------------|-------|
| `buttons.copy` (existing) | `"Copy"` | Passed as `codeBlockCopyLabel` from app to `MDMessageViewer` |
| `buttons.copied` (existing) | `"Copied!"` | Passed as `codeBlockCopiedLabel` from app to `MDMessageViewer` |

No new keys are introduced. The lib defaults to English strings (`'Copy code'` / `'Copied!'`).

---

## RTL / Direction Impact

The `MarkdownCodeBlock` component requires:
- Logical Tailwind classes (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`) for all directional layout except the code body.
- `dir="ltr"` on the code body — intentional physical exception (code is not natural-language text).
- No directional icon mirroring required.

See `.claude/rules/rtl.md` for the full RTL rules.

---

## Feature Flag

Not gated. This is a pure UI rendering change with no server toggle or `ENABLED_FEATURES` key.

---

## Memoisation

- `MarkdownCodeBlock` SHOULD be wrapped in `memo()` — it receives stable primitive props from the `code` renderer; memoisation prevents re-renders when unrelated markdown content updates.
- `useCodeCopy` uses `useCallback` for the `copy` function so that `MarkdownCodeBlock.memo` does not re-render due to a new function reference on parent re-render.

---

## Observability / Telemetry

None required for this slice. Copy actions are not tracked.
