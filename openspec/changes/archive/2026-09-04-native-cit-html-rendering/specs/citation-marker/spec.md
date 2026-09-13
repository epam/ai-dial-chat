## MODIFIED Requirements

### Requirement: `useAnnotations` resolves the annotation list for a message

`libs/quotations/src/utils/useAnnotations.ts` SHALL export `useAnnotations(message: Message, isStreaming: boolean): Annotation[]` that:

- When `isStreaming` is `false`, resolves annotations in priority order:
  1. `message.custom_content?.annotations` — the internal normalised format accumulated by `apply-chunk.ts` as streaming deltas arrive, or persisted by the backend on reload.
  2. `message['custom_fields']?.annotations` — the raw DIAL API wire format present on messages loaded without a normalised `custom_content.annotations`. These are normalised via `normalizeRawAnnotations(raw, message.custom_content?.attachments ?? [])`, which recognizes both the legacy `attachment_index` + `pdf_region` shape and the `html_tag` + flat `body.source.url` shape.
- When `isStreaming` is `true`, returns `[]` unconditionally — every selector family, including `html_tag`, is suppressed until the message finishes streaming. A `<cit>` tag renders as a real HTML element once `rehype-raw` parses it (see "Citation markers injected into rendered assistant message text" below); showing its pill mid-stream would require revealing that element before its closing tag has necessarily arrived, which risks the HTML parser swallowing subsequently-streamed text as the element's content.
- Filters the resolved list to exclude annotations without `body.source.attachment.url`. This also excludes attachments that carry only inline data (no `url`): some grounding providers stream attachments whose content is embedded as base64 or text in the `data` field rather than a resolvable URL, and those cannot be linked or previewed.
- Handles `null`/`undefined` annotation items gracefully (skips them without throwing).
- Wraps the result in `useMemo` keyed on `[isStreaming, message]`.

**i18n**: none.
**RTL**: none — hook returns data only.
**Feature flag**: none.

#### Scenario: Returns empty array while streaming, even with html_tag annotations present

- **WHEN** `useAnnotations` is called with `isStreaming: true` and the message's resolved annotations include one `html_tag` annotation and one `text_character_range` annotation
- **THEN** it returns `[]`

#### Scenario: Returns internal normalised annotations for a completed streamed message

- **WHEN** `message.custom_content.annotations` has entries and `isStreaming` is `false`
- **THEN** those annotations (filtered to those with `body.source.attachment.url`) are returned without normalisation

#### Scenario: Falls back to raw `custom_fields.annotations` for server-loaded messages

- **WHEN** `message.custom_content?.annotations` is absent but `message['custom_fields']?.annotations` is a non-empty array and `isStreaming` is `false`
- **THEN** `normalizeRawAnnotations` is applied and the normalised, filtered list is returned

#### Scenario: Annotations without a source URL are excluded

- **WHEN** the resolved annotation list contains one entry with `body.source.attachment.url` and one without
- **THEN** only the entry with a URL is included in the returned array

---

### Requirement: Citation markers injected into rendered assistant message text

The citation-aware markdown hook in `libs/quotations` (`useCitationMarkdownComponents`) SHALL support two distinct citation families, differing in *how* a marker reaches the screen, depending on each `AnnotationGroup`'s `primaryAnnotation.target?.selector?.type`:

- **Offset-based** (`text_character_range`, or any non-`html_tag` selector, including missing/unknown selectors): a sentinel string is injected into the pre-processed markdown at the character offset indicated by `target.selector.end`, and a `p`/`li` component override splits string children on that sentinel to render a `<CitationDropdown>` in its place. Unchanged from before the `html_tag` family existed.
- **Tag-based** (`html_tag`): the tag is a real inline HTML element in the message content — `<cit data-id="…"></cit>` — parsed into a hast element by the host's `rehype-raw` pipeline and allow-listed through its `rehype-sanitize` schema (tag name `cit`, attribute `dataId`; see the `libs/chat-shared` `MarkdownRenderer`'s `baseRehypePlugins`). The hook registers a `cit` react-markdown component override that looks up the group by the element's `data-id` prop and renders `<CitationDropdown>`, or `null` when no group has a matching id.

The hook accepts an `isStreaming: boolean` parameter (added before `isCompactTypography` in its parameter list). Its `processedContent` computation:

- When `isStreaming` is `true`: applies `stripCitTagsWhileStreaming(content)`, which removes every complete `<cit>…</cit>` element and, if a dangling (unclosed) `<cit` remains after that, truncates the string there — hiding that tag and everything streamed after it. This SHALL run regardless of whether `groups` is empty, since an unresolved `<cit>` tag can be present in `content` before its annotation ever arrives. No offset-based sentinel injection runs while streaming (`groups` is always `[]` in this state per the `useAnnotations` requirement above).
- When `isStreaming` is `false`: runs `injectCitationSentinels(content, groups)` when `groups` is non-empty (unchanged fast path when empty), which now SHALL skip `html_tag` groups entirely — no sentinel is injected for them, since they render through the native `cit` element path instead. Sentinel indices for the remaining (offset-based) groups SHALL still be that group's position in the original, unfiltered `groups` array, so a `renderMarker(idx)` lookup (`groups[idx]`) resolves correctly.

Other injection rules, unchanged:
- Sentinel strings (`⟦C{idx}⟧`) are injected in descending character-offset order to avoid offset shift from earlier insertions.
- If an offset-based `target`/`target.selector` is absent, the marker SHALL be appended after the last character of the message text.
- If the `end` offset exceeds the message text length, the marker SHALL be clamped to the end of the text.
- Multiple markers at the same position SHALL be rendered in the order of their `AnnotationGroup` array.

A `<cit>` tag with no matching `html_tag` group when not streaming — because its annotation never arrives, or doesn't resolve — renders nothing via the `cit` component override; it is never shown as raw text or an unstyled custom element (the shared `MarkdownRenderer`'s `defaultMarkdownComponents.cit` also defaults to `() => null` for any other consumer that doesn't override it).

**i18n**: see `CitationMarker` component above.
**RTL**: the injected markers use `ms-1` logical margin; no additional RTL handling needed.
**Memoisation**: `processedContent` and `markdownComponents` SHALL be memoised with `useMemo`.

#### Scenario: Marker appears after cited text span

- **WHEN** an assistant message has text "The revenue was $1B." and an annotation with `target.selector.end = 19`
- **THEN** the `CitationMarker` is rendered immediately after the character at position 19 in the rendered output

#### Scenario: No markers of any family during streaming

- **WHEN** `isStreaming` is `true`, regardless of whether the message has `text_character_range` or `html_tag` annotations
- **THEN** `useAnnotations` returns `[]`, `groups` is empty, and no `CitationMarker`/`CitationDropdown` components are rendered in the message bubble

#### Scenario: Missing selector appends marker at end of text

- **WHEN** an annotation has no `target.selector`
- **THEN** the `CitationMarker` is rendered after the last character of the message text

#### Scenario: Out-of-range offset clamps to end

- **WHEN** an annotation has `target.selector.end` greater than the text length
- **THEN** the `CitationMarker` is rendered at the end of the text without throwing

#### Scenario: A matched cit element renders its marker once streaming finishes

- **WHEN** the message content is `...implantation<cit data-id="e43864"></cit>, and the plan...`, `isStreaming` is `false`, and `groups` contains an `html_tag` group with `target.selector.id === "e43864"`
- **THEN** the rendered output shows the citation marker in place of the `<cit>` element, with no literal `<cit>` markup visible

#### Scenario: An unmatched cit element renders nothing

- **WHEN** the message content contains a `<cit data-id="e52dc2"></cit>` element, `isStreaming` is `false`, and no group's `target.selector.id` equals `"e52dc2"`
- **THEN** the `cit` component override renders `null` for that element — no marker, no raw tag, no unstyled custom element

#### Scenario: Every cit tag is hidden while streaming, even a well-formed matched pair

- **WHEN** the message content is `Patient meets criteria<cit data-id="e1"></cit>.`, `isStreaming` is `true`, and `groups` contains a matching `html_tag` group for `"e1"`
- **THEN** `processedContent` has the entire `<cit>` element removed and no marker is rendered — the pill only appears once `isStreaming` becomes `false`

#### Scenario: A dangling open cit tag hides itself and the text streamed after it

- **WHEN** the message content is `Patient meets criteria<cit data-id="e438">and more streaming text` (opening tag complete, no closing tag yet) and `isStreaming` is `true`
- **THEN** `processedContent` is truncated to `Patient meets criteria` — both the incomplete tag and the text that streamed in after it are hidden until the closing tag arrives in a later render
