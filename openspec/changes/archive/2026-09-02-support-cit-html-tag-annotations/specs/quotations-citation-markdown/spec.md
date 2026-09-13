## MODIFIED Requirements

### Requirement: Citation-aware markdown hook exported from the package root

`@epam/ai-dial-quotations` SHALL export a hook (`useCitationMarkdownComponents`) that, given raw markdown content, a list of `AnnotationGroup`s (which may mix URL-keyed groups and `cit`-id-keyed groups), and a callbacks object (`onPreview`, `onOpenInBrowser`, `buildLabels`), returns `{ processedContent: string; markdownComponents: Components }` for `react-markdown`. The hook SHALL NOT import `react-i18next`, any application context, any attachment-canvas hook, or any application DTO-conversion helper.

`processedContent` computation SHALL run even when `groups.length === 0`, whenever `content` contains a `<cit` substring — an unmatched `<cit id="…">` tag must be stripped from the rendered output regardless of whether any group currently matches it, so a citation tag never flashes as raw text before its annotation resolves. When `groups.length === 0` and `content` contains no `<cit` substring, the prior fast path (return `content` unchanged, `markdownComponents: {}`) still applies.

#### Scenario: Uncited content with no cit tags takes the stable empty-overrides fast path

- **WHEN** the hook is called with `groups.length === 0` and `content` containing no `<cit` substring
- **THEN** `processedContent` equals the input `content` unchanged, and `markdownComponents` is an empty object, without calling `buildLabels`

#### Scenario: Cited content injects sentinels and returns paragraph/list overrides

- **WHEN** the hook is called with one or more `AnnotationGroup`s
- **THEN** `processedContent` has sentinel markers injected at each group's insertion point (character-offset end for offset-based groups, `<cit id>` tag position for tag-based groups), and `markdownComponents` contains `p` and `li` overrides that replace sentinels in their children with a rendered `CitationDropdown`

#### Scenario: Unmatched cit tags are stripped even with zero groups

- **WHEN** the hook is called with `groups.length === 0` and `content` containing a `<cit id="e43864">` tag
- **THEN** `processedContent` has the tag removed, and `markdownComponents` is an empty object

### Requirement: Out-of-range or malformed annotation input is handled defensively

The hook SHALL return `null` for a sentinel marker whose index has no corresponding entry in `groups`, and SHALL leave content unchanged when the offset-based injection path receives a group whose primary annotation has no `text_character_range` selector (defaulting the injection point to the end of the content). For the tag-based injection path, a `<cit id="…">` tag whose `id` has no corresponding entry in `groups` SHALL be removed from `processedContent` rather than left as literal text or causing an error; a trailing incomplete tag fragment at the end of `content` (a tag split across a streaming chunk boundary) SHALL be stripped before any further processing.

#### Scenario: Sentinel index beyond the groups array renders nothing

- **WHEN** `processedContent` contains a sentinel referencing an index with no corresponding `groups` entry
- **THEN** the corresponding marker renders as `null` rather than throwing

#### Scenario: Missing character-range selector defaults to end-of-content injection

- **WHEN** a group's primary annotation has a selector that is not `text_character_range`
- **THEN** its sentinel is injected at the end of `content` rather than at an undefined offset

#### Scenario: Unmatched cit id is removed without error

- **WHEN** `content` contains a `<cit id="unknown-id">` tag and no group's `target.selector.id` equals `"unknown-id"`
- **THEN** `processedContent` has the tag removed and the hook does not throw

#### Scenario: Trailing incomplete tag fragment is stripped

- **WHEN** `content` ends with `<cit id="e4` (an incomplete tag, still streaming in)
- **THEN** `processedContent` has that trailing fragment removed
