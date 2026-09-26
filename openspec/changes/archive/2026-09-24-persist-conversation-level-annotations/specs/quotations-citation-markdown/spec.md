## MODIFIED Requirements

### Requirement: Citation-aware markdown hook exported from the package root

`@epam/ai-dial-quotations` SHALL export a hook (`useCitationMarkdownComponents`) that, given raw markdown content, a list of `AnnotationGroup`s (which may mix URL-keyed groups and `cit`-id-keyed groups), a callbacks object (`onPreview`, `onOpenInBrowser`, `buildLabels`), and an `isStreaming: boolean`, returns `{ processedContent: string; markdownComponents: Components }` for `react-markdown`. The hook SHALL NOT import `react-i18next`, any application context, any attachment-canvas hook, or any application DTO-conversion helper.

The hook SHALL additionally accept an optional pool of **fallback** `AnnotationGroup`s, supplied by the host, which are groups not belonging to this message. The pool's only effect SHALL be on `data-id` resolution, described below. It SHALL be optional and default to an empty pool, so every existing call site keeps its current behaviour.

`processedContent` computation depends on `isStreaming`:
- When `isStreaming` is `true`: applies `stripCitTagsWhileStreaming(content)` unconditionally (regardless of `groups`), which hides complete supported `<cit data-id="…"></cit>` elements and escapes every other `cit` shape for literal display. `groups` is expected to be `[]` in this state (per the `message-annotations`/`citation-marker` capabilities' `useAnnotations` requirement), so no offset-based sentinel injection runs either.
- When `isStreaming` is `false`: injects sentinels for non-`html_tag` groups when present, then escapes every unsupported `cit` shape so it is displayed as ordinary text. The exact supported paired shape remains a real `<cit>` element handled by the component override.

The fallback pool SHALL NOT participate in `processedContent` at all. Sentinel injection places markers at character offsets **into this message's text** (`injectCitationSentinels` falls back to `content.length` for a group with no `text_character_range` offset), so admitting foreign groups there would inject phantom markers into unrelated content. `processedContent` SHALL therefore be byte-identical with and without a non-empty pool.

`markdownComponents` includes a `cit` override when a supported element is present or groups are non-empty. It looks the element's `data-id` prop up against an `html_tag`-selector group — first among `groups`, and only when that finds nothing, among the fallback pool — and renders the existing citation dropdown for a match; an element matching neither is serialized back to visible literal text. The message's own groups SHALL always win a collision on the same id.

Because a pool-only match still needs a `cit` override to exist, the empty-overrides fast path SHALL be taken only when `groups` is empty, the pool is empty, and the content has no `<cit` markup.

#### Scenario: Uncited content with empty groups takes the stable empty-overrides fast path

- **WHEN** the hook is called with `groups.length === 0`, an empty fallback pool, `isStreaming: false`, and `content` containing no `<cit` markup
- **THEN** `processedContent` equals the input `content` unchanged, and `markdownComponents` is an empty object, without calling `buildLabels`

#### Scenario: Cited content injects sentinels and returns paragraph/list/cit overrides

- **WHEN** the hook is called with one or more `AnnotationGroup`s and `isStreaming: false`
- **THEN** `processedContent` has sentinel markers injected at each non-`html_tag` group's character-offset insertion point, and `markdownComponents` contains `p`, `li`, and `cit` overrides

#### Scenario: A supported citation element is hidden while streaming

- **WHEN** the hook is called with `isStreaming: true` and `content` containing a `<cit data-id="e43864"></cit>` element
- **THEN** `processedContent` has that element removed, whether or not `groups` currently has a matching entry
- **AND** an unsupported or partial `cit` shape would instead be escaped for literal display

#### Scenario: An id absent from the message resolves from the fallback pool

- **WHEN** `content` contains `<cit data-id="e43864"></cit>`, `groups` has no `html_tag` group with that id, `isStreaming` is `false`, and the fallback pool has one
- **THEN** the `cit` override renders a `CitationDropdown` for the pooled group instead of literal text, and `onPreview` / `onOpenInBrowser` receive that pooled group's annotation

#### Scenario: The message's own group wins a colliding id

- **WHEN** both `groups` and the fallback pool contain an `html_tag` group with id `e1`
- **THEN** the rendered dropdown is built from the entry in `groups`

#### Scenario: The pool never shifts marker positions

- **WHEN** the hook is called twice with identical `content`, identical `groups` containing an offset-based group, `isStreaming: false`, once with an empty pool and once with a pool of three foreign groups
- **THEN** both calls return the same `processedContent` string

#### Scenario: A pool-only match still gets a cit override

- **WHEN** `groups` is empty, `isStreaming` is `false`, the fallback pool has an `html_tag` group with id `e1`, and `content` contains `<cit data-id="e1"></cit>`
- **THEN** `markdownComponents` contains a `cit` override and the element renders as a citation marker

#### Scenario: An id in neither place still degrades to text

- **WHEN** `content` contains `<cit data-id="zz"></cit>` and neither `groups` nor the fallback pool has that id
- **THEN** the element is serialized back to the literal text `<cit data-id="zz"></cit>`
