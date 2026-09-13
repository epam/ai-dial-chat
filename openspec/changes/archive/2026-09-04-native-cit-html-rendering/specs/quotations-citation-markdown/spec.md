## MODIFIED Requirements

### Requirement: Citation-aware markdown hook exported from the package root

`@epam/ai-dial-quotations` SHALL export a hook (`useCitationMarkdownComponents`) that, given raw markdown content, a list of `AnnotationGroup`s (which may mix URL-keyed groups and `cit`-id-keyed groups), a callbacks object (`onPreview`, `onOpenInBrowser`, `buildLabels`), and an `isStreaming: boolean`, returns `{ processedContent: string; markdownComponents: Components }` for `react-markdown`. The hook SHALL NOT import `react-i18next`, any application context, any attachment-canvas hook, or any application DTO-conversion helper.

`processedContent` computation depends on `isStreaming`:
- When `isStreaming` is `true`: applies `stripCitTagsWhileStreaming(content)` unconditionally (regardless of `groups`), which hides every `<cit>` element — complete, or with a still-arriving closing tag — from the output. `groups` is expected to be `[]` in this state (per the `message-annotations`/`citation-marker` capabilities' `useAnnotations` requirement), so no offset-based sentinel injection runs either.
- When `isStreaming` is `false` and `groups.length === 0`: returns `content` unchanged (fast path).
- When `isStreaming` is `false` and `groups.length > 0`: runs `injectCitationSentinels(content, groups)`, which injects sentinels only for non-`html_tag` groups (their content stays as real `<cit>` elements, handled by the `cit` component override in `markdownComponents` instead).

`markdownComponents` includes a `cit` override — looked up by the element's `data-id` prop against an `html_tag`-selector group in `groups` — whenever `groups` is non-empty; it renders `null` for an id with no matching group.

#### Scenario: Uncited content with empty groups takes the stable empty-overrides fast path

- **WHEN** the hook is called with `groups.length === 0`, `isStreaming: false`, and `content` containing no `<cit` markup
- **THEN** `processedContent` equals the input `content` unchanged, and `markdownComponents` is an empty object, without calling `buildLabels`

#### Scenario: Cited content injects sentinels and returns paragraph/list/cit overrides

- **WHEN** the hook is called with one or more `AnnotationGroup`s and `isStreaming: false`
- **THEN** `processedContent` has sentinel markers injected at each non-`html_tag` group's character-offset insertion point, and `markdownComponents` contains `p`, `li`, and `cit` overrides

#### Scenario: Every cit tag is hidden while streaming, regardless of groups

- **WHEN** the hook is called with `isStreaming: true` and `content` containing a `<cit data-id="e43864"></cit>` element
- **THEN** `processedContent` has that element removed, whether or not `groups` currently has a matching entry

---

### Requirement: Out-of-range or malformed annotation input is handled defensively

The hook SHALL return `null` for a sentinel marker whose index has no corresponding entry in `groups`, and SHALL leave content unchanged when the offset-based injection path receives a group whose primary annotation has no `text_character_range` selector (defaulting the injection point to the end of the content). For the tag-based (`cit` element) path, the `cit` component override SHALL render `null` — not raw text, not an error — for a `data-id` with no corresponding entry in `groups`. While streaming, `stripCitTagsWhileStreaming` SHALL remove a dangling (unclosed) `<cit` tag and everything after it in `content`, so a tag split across a streaming chunk boundary is never rendered — this is a string-level guard applied before `react-markdown` runs, independent of whether the `cit` component override is even registered for the current render.

#### Scenario: Sentinel index beyond the groups array renders nothing

- **WHEN** `processedContent` contains a sentinel referencing an index with no corresponding `groups` entry
- **THEN** the corresponding marker renders as `null` rather than throwing

#### Scenario: Missing character-range selector defaults to end-of-content injection

- **WHEN** a group's primary annotation has a selector that is not `text_character_range`
- **THEN** its sentinel is injected at the end of `content` rather than at an undefined offset

#### Scenario: Unmatched cit data-id renders null without error

- **WHEN** `content` contains a `<cit data-id="unknown-id"></cit>` element and no group's `target.selector.id` equals `"unknown-id"`
- **THEN** the `cit` component override returns `null` for that element and the hook does not throw

#### Scenario: A dangling open tag while streaming hides itself and everything after it

- **WHEN** `isStreaming` is `true` and `content` ends with `<cit data-id="e438">` followed by more already-streamed text but no `</cit>`
- **THEN** `processedContent` is truncated at the start of that `<cit` occurrence — both the tag and the text after it are hidden
