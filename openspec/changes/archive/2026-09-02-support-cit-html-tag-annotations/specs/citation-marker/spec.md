## MODIFIED Requirements

### Requirement: Annotations grouped by source attachment URL

`libs/quotations/src/utils/group-annotations-by-source.ts` SHALL export `groupAnnotationsBySource(annotations: Annotation[]): AnnotationGroup[]` where `AnnotationGroup` is:
```ts
interface AnnotationGroup {
  groupKey: string;      // this group's identity — used for open/active-index state and React keys
  sourceUrl: string;      // the cited attachment's URL — used for Preview/Download
  sourceName: string;   // filename from URL path, fallback to hostname
  annotations: Annotation[];
  primaryAnnotation: Annotation;  // first in the group
}
```

`groupAnnotationsBySource` groups only annotations whose `target?.selector?.type !== 'html_tag'` (`html_tag` annotations are grouped separately — see "Annotations grouped by cit tag id" below). Grouping rules:
- Annotations are grouped by `body.source.attachment.url`.
- `groupKey` SHALL equal `sourceUrl` for every group produced by this function (unchanged value/behavior from before `groupKey` existed).
- `sourceName` SHALL be resolved in priority order:
  1. `body.source.attachment.title` when present and non-empty.
  2. Otherwise, extract the last non-empty decoded path segment of the URL (without query params); for absolute URLs use `new URL()` to parse; for relative paths split on `/` directly.
  3. If no path segment is found for an absolute URL, fall back to the URL hostname.
- Within a group, annotations SHALL preserve their original order.
- Annotations without `body.source.attachment.url` SHALL be excluded (already filtered by `useAnnotations`).

**i18n**: none (source name derivation is programmatic).
**RTL**: none — pure data transformation.
**Feature flag**: none.

#### Scenario: Two annotations citing the same URL form one group

- **WHEN** `groupAnnotationsBySource` is called with two `text_character_range` annotations sharing the same `body.source.attachment.url`
- **THEN** the result contains one `AnnotationGroup` with both annotations and `groupKey === sourceUrl`

#### Scenario: Two annotations with different URLs form two groups

- **WHEN** `groupAnnotationsBySource` is called with two annotations with different `body.source.attachment.url` values
- **THEN** the result contains two `AnnotationGroup` objects

#### Scenario: Source name prefers attachment.title over URL

- **WHEN** the annotation has `body.source.attachment.title = "Q3 Revenue Report"` and URL `https://files.example.com/path/to/abc123.pdf`
- **THEN** `sourceName` is `"Q3 Revenue Report"`

#### Scenario: Source name uses filename from absolute URL path when title is absent

- **WHEN** the attachment URL is `https://files.example.com/path/to/report.pdf` and `attachment.title` is absent
- **THEN** `sourceName` is `"report.pdf"`

#### Scenario: Source name uses filename from relative URL path when title is absent

- **WHEN** the attachment URL is `files/6FEup-abc/Group1-2.pdf` (a relative path, no protocol) and `attachment.title` is absent
- **THEN** `sourceName` is `"Group1-2.pdf"`

#### Scenario: Source name falls back to hostname when path has no filename

- **WHEN** the attachment URL is `https://wikipedia.org/`
- **THEN** `sourceName` is `"wikipedia.org"`

#### Scenario: html_tag annotations are excluded from source-URL grouping

- **WHEN** `groupAnnotationsBySource` is called with an annotation whose `target.selector.type === 'html_tag'`
- **THEN** that annotation is excluded from every returned group

---

### Requirement: `useAnnotations` resolves the annotation list for a message

`libs/quotations/src/utils/useAnnotations.ts` SHALL export `useAnnotations(message: Message, isStreaming: boolean): Annotation[]` that:

- When `isStreaming` is `false`, resolves annotations in priority order:
  1. `message.custom_content?.annotations` — the internal normalised format accumulated by `apply-chunk.ts` as streaming deltas arrive, or persisted by the backend on reload.
  2. `message['custom_fields']?.annotations` — the raw DIAL API wire format present on messages loaded without a normalised `custom_content.annotations`. These are normalised via `normalizeRawAnnotations(raw, message.custom_content?.attachments ?? [])`, which recognizes both the legacy `attachment_index` + `pdf_region` shape and the `html_tag` + flat `body.source.url` shape.
- When `isStreaming` is `true`, returns only the subset of the above resolution whose `target?.selector?.type === 'html_tag'` — every other selector type is suppressed until the message finishes streaming, so a `cit`-tag pill can appear mid-stream while offset-based markers still wait for completion.
- Filters the resolved list to exclude annotations without `body.source.attachment.url`. This also excludes attachments that carry only inline data (no `url`): some grounding providers stream attachments whose content is embedded as base64 or text in the `data` field rather than a resolvable URL, and those cannot be linked or previewed.
- Handles `null`/`undefined` annotation items gracefully (skips them without throwing).
- Wraps the result in `useMemo` keyed on `[isStreaming, message]`.

**i18n**: none.
**RTL**: none — hook returns data only.
**Feature flag**: none.

#### Scenario: Returns html_tag annotations while streaming

- **WHEN** `useAnnotations` is called with `isStreaming: true` and the message's resolved annotations include one `html_tag` annotation and one `text_character_range` annotation
- **THEN** it returns only the `html_tag` annotation

#### Scenario: Returns empty array during streaming when no html_tag annotations exist

- **WHEN** `useAnnotations` is called with `isStreaming: true` and every resolved annotation is `text_character_range`
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

The citation-aware markdown hook in `libs/quotations` SHALL inject markers into rendered message text at two kinds of insertion point, depending on each `AnnotationGroup`'s `primaryAnnotation.target?.selector?.type`:

- **Offset-based** (`text_character_range`, or any non-`html_tag` selector, including missing/unknown selectors): a sentinel is injected at the character offset indicated by `target.selector.end`, unchanged from before.
- **Tag-based** (`html_tag`): every `<cit id="…">` occurrence in the accumulated message content is replaced — with a marker sentinel when its `id` matches an `html_tag` group's `target.selector.id`, or removed entirely (rendered as nothing) when no group has a matching `id` yet.

Injection rules:
- Sentinel strings (`⟦C{idx}⟧`) are injected into the raw markdown, indexed by the injected group's position in the flat `groups` array passed to the hook.
- Offset-based sentinels are injected in descending character-offset order (unchanged) to avoid offset shift from earlier insertions.
- Tag-based replacement operates on the accumulated message content as a whole, not on individual SSE chunks — a `<cit id="…">` tag split across two streaming chunks is only recognized (or stripped) once the full tag has accumulated into the message content.
- A `<cit id="…">` tag with no matching `html_tag` group — because its annotation has not arrived yet, or never arrives — is stripped from the rendered output; it is never shown as raw text.
- A trailing, incomplete prefix of a `<cit id="…">` tag at the end of the accumulated content (a tag currently split across the streaming boundary) is stripped before markdown rendering, so a partially-received tag never flashes as literal text.
- React component overrides for `p` and `li` split string children on the sentinel pattern and replace them with `<CitationDropdown>` components, for both offset-based and tag-based sentinels alike.
- If an offset-based `target`/`target.selector` is absent, the marker SHALL be appended after the last character of the message text.
- If the `end` offset exceeds the message text length, the marker SHALL be clamped to the end of the text.
- Offset-based markers SHALL NOT be rendered while the message is still streaming (`isStreaming: true`), unchanged from before. Tag-based markers, by contrast, render as soon as their matching `html_tag` group exists — see the `useAnnotations` requirement above.
- Multiple markers at the same position SHALL be rendered in the order of their `AnnotationGroup` array.

**i18n**: see `CitationMarker` component above.
**RTL**: the injected markers use `ms-1` logical margin; no additional RTL handling needed.
**Memoisation**: `processedContent` and `markdownComponents` SHALL be memoised with `useMemo`.

#### Scenario: Marker appears after cited text span

- **WHEN** an assistant message has text "The revenue was $1B." and an annotation with `target.selector.end = 19`
- **THEN** the `CitationMarker` is rendered immediately after the character at position 19 in the rendered output

#### Scenario: No offset-based markers during streaming

- **WHEN** `isStreaming` is `true` and the message has only `text_character_range` annotations
- **THEN** `useAnnotations` returns `[]`, `groups` is empty, `markdownComponents` returns `{}`, and no `CitationMarker` components are rendered in the message bubble

#### Scenario: Missing selector appends marker at end of text

- **WHEN** an annotation has no `target.selector`
- **THEN** the `CitationMarker` is rendered after the last character of the message text

#### Scenario: Out-of-range offset clamps to end

- **WHEN** an annotation has `target.selector.end` greater than the text length
- **THEN** the `CitationMarker` is rendered at the end of the text without throwing

#### Scenario: cit tag replaced by marker once its annotation resolves

- **WHEN** the accumulated content contains `...implantation<cit id="e43864">, and the plan...` and a `groups` array contains an `html_tag` group with `target.selector.id === "e43864"`
- **THEN** the rendered output shows the citation marker immediately after "implantation" and before ", and the plan", with no literal `<cit>` text visible

#### Scenario: Unmatched cit tag is hidden, not shown as raw text

- **WHEN** the accumulated content contains a `<cit id="e52dc2">` tag and no group's `target.selector.id` equals `"e52dc2"`
- **THEN** the tag is stripped from the rendered output and no marker is rendered in its place

#### Scenario: A cit tag split across streaming chunks does not flash as raw text

- **WHEN** the accumulated content ends with an incomplete tag fragment, e.g. `...permanent implantation<cit id="e4`
- **THEN** the trailing incomplete fragment is stripped before rendering, and the visible text ends with "...permanent implantation"

## ADDED Requirements

### Requirement: Annotations grouped by cit tag id

`libs/quotations/src/utils/group-annotations-by-source.ts` SHALL export `groupAnnotationsByCitId(annotations: Annotation[]): AnnotationGroup[]` that groups only annotations whose `target?.selector?.type === 'html_tag'`, one group per distinct `target.selector.id` — never collapsing two different `id`s that happen to cite the same source document into one group.

For each group:
- `groupKey` SHALL equal `` `cit:${id}` `` (prefixed so it can never collide with a `groupAnnotationsBySource` group's `groupKey`, which equals a raw URL).
- `sourceUrl` SHALL equal the group's first annotation's `body.source.attachment.url` (used for Preview/Download — identical in meaning to `groupAnnotationsBySource`'s `sourceUrl`).
- `sourceName` SHALL be resolved using the same priority order as `groupAnnotationsBySource` (attachment title, then URL filename, then hostname).
- `annotations` and `primaryAnnotation` follow the same semantics as `groupAnnotationsBySource` (original order preserved; first annotation is primary).

Annotations without `target.selector.id` or without `body.source.attachment.url` are excluded.

**i18n**: none.
**RTL**: none — pure data transformation.
**Feature flag**: none.

#### Scenario: Two cit ids citing the same document form two groups

- **WHEN** `groupAnnotationsByCitId` is called with two `html_tag` annotations that share the same `body.source.attachment.url` but have `target.selector.id` values `"e43864"` and `"e52dc2"`
- **THEN** the result contains two `AnnotationGroup` objects, with `groupKey` values `"cit:e43864"` and `"cit:e52dc2"`, each `sourceUrl` equal to the shared document URL

#### Scenario: Two annotations sharing the same cit id form one group

- **WHEN** two `html_tag` annotations both have `target.selector.id === "e43864"` (e.g. a partial chunk followed by a completion chunk for the same tag)
- **THEN** the result contains one `AnnotationGroup` for `"e43864"` containing both annotations

#### Scenario: Non-html_tag annotations are excluded from cit-id grouping

- **WHEN** `groupAnnotationsByCitId` is called with a `text_character_range` annotation
- **THEN** that annotation is excluded from every returned group

---

### Requirement: Combined annotation grouping dispatcher

`libs/quotations` SHALL export `groupAnnotations(annotations: Annotation[]): AnnotationGroup[]` that partitions its input by `target?.selector?.type` and returns the concatenation of `groupAnnotationsByCitId` (for `html_tag` annotations) and `groupAnnotationsBySource` (for every other annotation), so a host application never branches on selector type itself.

The frontend host's citation-rendering call site SHALL call `groupAnnotations` instead of calling `groupAnnotationsBySource` directly.

**i18n**: none.
**RTL**: none — pure data transformation.
**Feature flag**: none.

#### Scenario: Mixed annotation list groups each family separately

- **WHEN** `groupAnnotations` is called with one `text_character_range` annotation and two `html_tag` annotations with distinct ids citing the same document
- **THEN** the result contains one URL-keyed group (from `groupAnnotationsBySource`) and two cit-id-keyed groups (from `groupAnnotationsByCitId`)

#### Scenario: Empty input returns empty output

- **WHEN** `groupAnnotations` is called with `[]`
- **THEN** it returns `[]`
