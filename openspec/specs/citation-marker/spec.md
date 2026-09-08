# citation-marker Specification

## Purpose

Inline citation markers injected after cited text spans in assistant messages, grouped by source attachment.

## Requirements

---

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

---

### Requirement: `CitationMarker` renders an inline button after the cited text span

`apps/chat/src/components/Citations/CitationMarker/CitationMarker.tsx` SHALL render a UI kit `Button` (variant neutral, appearance outlined, size small) with:
- An optional leading icon, rendered before the label, when the `icon` prop is provided; omitted (no icon) when the prop is absent.
- Label: `sourceName` when `annotationCount === 1`; `sourceName + " +" + (annotationCount - 1)` when `annotationCount > 1` (e.g. `"Wikipedia +1"`)
- `aria-label`: `"Citation from <sourceName>"` (i18n key `citations.marker.ariaLabel`)
- `onClick`: calls the `onOpen` callback prop

The component SHALL accept:
```ts
interface CitationMarkerProps {
  sourceName: string;
  annotationCount: number;
  onOpen: () => void;
  icon?: ReactNode;
}
```

Existing inline-citation call sites (`CitationDropdown` used from `useCitationMarkdownComponents`) SHALL NOT pass `icon`, preserving their current icon-less appearance.

**i18n keys**: `citations.marker.label` (single), `citations.marker.labelWithOverflow` (with `+N`), `citations.marker.ariaLabel`.
**RTL**: the button itself is direction-agnostic (text content only, no directional icon); when `icon` is provided, it is a symmetric icon (e.g. a link glyph) that SHALL NOT be mirrored.
**Accessibility**: button role is already provided by the UI kit `Button`; the optional icon SHALL be marked `aria-hidden` by the caller.
**Feature flag**: none.

#### Scenario: Single-source marker shows source name only

- **WHEN** `CitationMarker` is rendered with `sourceName="Wikipedia"` and `annotationCount={1}`
- **THEN** the button label is `"Wikipedia"`

#### Scenario: Multi-source marker shows overflow count

- **WHEN** `CitationMarker` is rendered with `sourceName="Wikipedia"` and `annotationCount={3}`
- **THEN** the button label is `"Wikipedia +2"`

#### Scenario: Clicking the marker calls onOpen

- **WHEN** the user clicks the `CitationMarker` button
- **THEN** the `onOpen` callback is invoked once

#### Scenario: Marker renders without an icon by default

- **WHEN** `CitationMarker` is rendered without the `icon` prop
- **THEN** no icon element is rendered before the label

#### Scenario: Marker renders the provided icon before the label

- **WHEN** `CitationMarker` is rendered with `icon={<IconLink />}`
- **THEN** the icon is rendered before the label text inside the button

---

### Requirement: `useAnnotations` resolves the annotation list for a message

`libs/quotations/src/utils/useAnnotations.ts` SHALL export `useAnnotations(message: Message, isStreaming: boolean): Annotation[]` that:

- When `isStreaming` is `false`, resolves annotations in priority order:
  1. `message.custom_content?.annotations` — the internal normalised format accumulated by `apply-chunk.ts` as streaming deltas arrive, or persisted by the backend on reload.
  2. `message['custom_fields']?.annotations` — the raw DIAL API wire format present on messages loaded without a normalised `custom_content.annotations`. These are normalised via `normalizeRawAnnotations(raw, message.custom_content?.attachments ?? [])`, which recognizes both the legacy `attachment_index` + `pdf_region` shape and the `html_tag` + flat `body.source.url` shape.
- Reconciles each resolved `html_tag` source attachment's MIME type with a recognized URL extension. This repairs conversations persisted by the historical fallback that labelled every non-HTML `html_tag` source as PDF; an opaque URL keeps its stored type.
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
- **THEN** those annotations (filtered to those with `body.source.attachment.url`) are returned with recognized `html_tag` URL extensions reconciled against the stored MIME type

#### Scenario: Persisted XLSX citation with the old PDF fallback is repaired

- **WHEN** a completed message contains an `html_tag` annotation whose source type is `application/pdf` and whose URL ends in `.xlsx`
- **THEN** `useAnnotations` returns that source with `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

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
</content>
