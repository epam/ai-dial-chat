## Requirements

---

### Requirement: Annotations grouped by source attachment URL

`apps/chat/src/utils/group-annotations-by-source.ts` SHALL export `groupAnnotationsBySource(annotations: Annotation[]): AnnotationGroup[]` where `AnnotationGroup` is:
```ts
interface AnnotationGroup {
  sourceUrl: string;
  sourceName: string;   // filename from URL path, fallback to hostname
  annotations: Annotation[];
  primaryAnnotation: Annotation;  // first in the group
}
```

Grouping rules:
- Annotations are grouped by `body.source.attachment.url`.
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

- **WHEN** `groupAnnotationsBySource` is called with two annotations sharing the same `body.source.attachment.url`
- **THEN** the result contains one `AnnotationGroup` with both annotations

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

`apps/chat/src/hooks/annotations/useAnnotations.ts` SHALL export `useAnnotations(message: Message, isStreaming: boolean): Annotation[]` that:

- Returns `[]` immediately when `isStreaming` is `true` (markers are suppressed while streaming is active).
- When not streaming, resolves annotations in priority order:
  1. `message.custom_content?.annotations` — the internal normalised format accumulated by `apply-chunk.ts` as streaming deltas arrive.
  2. `message['custom_fields']?.annotations` — the raw DIAL API wire format present on messages loaded from the server rather than streamed in the current session. These are normalised via `normalizeRawAnnotations(raw, message.custom_content?.attachments ?? [])` from `apps/chat/src/utils/annotation.ts`. Note: the DIAL backend does not currently persist annotations in conversation storage, so this branch is exercised only if a future backend change adds persistence. Until then, annotations are available only in the current streaming session and disappear after a page reload.
- Filters the resolved list to exclude annotations without `body.source.attachment.url`. This also excludes attachments that carry only inline data (no `url`): some grounding providers stream attachments whose content is embedded as base64 or text in the `data` field rather than a resolvable URL, and those cannot be linked or previewed.
- Handles `null`/`undefined` annotation items gracefully (skips them without throwing).
- Wraps the result in `useMemo` keyed on `[isStreaming, contentAnnotations, attachments, customFields]`.

`normalizeRawAnnotations` converts raw DIAL `pdf_region` selectors (`{ left, top, width, height }`) to internal `PdfBBoxSelector` (`{ x1, y1, x2, y2, page }`) and resolves `attachment_index` references against the message's attachment list.

**i18n**: none.
**RTL**: none — hook returns data only.
**Feature flag**: none.

#### Scenario: Returns empty array during streaming

- **WHEN** `useAnnotations` is called with `isStreaming: true`
- **THEN** it returns `[]` regardless of what `message.custom_content?.annotations` contains

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

The assistant message markdown renderer in `apps/chat` SHALL inject `<CitationMarker>` components after the character offset indicated by each `AnnotationGroup`'s `primaryAnnotation.target.selector` (type `text_character_range`, using the `end` index as the insertion point).

Injection rules:
- Sentinel strings (`⟦C{idx}⟧`) are injected into the raw markdown at character offsets (descending order to avoid offset shift) before passing to the markdown renderer.
- React component overrides for `p` and `li` split string children on the sentinel pattern and replace them with `<CitationDropdown>` components.
- If `target` or `target.selector` is absent, the marker SHALL be appended after the last character of the message text.
- If the `end` offset exceeds the message text length, the marker SHALL be clamped to the end of the text.
- Markers SHALL NOT be rendered while the message is still streaming (`isStreaming: true`).
- Multiple markers at the same position SHALL be rendered in the order of their `AnnotationGroup` array.

**i18n**: see `CitationMarker` component above.
**RTL**: the injected markers use `ms-1` logical margin; no additional RTL handling needed.
**Memoisation**: `processedContent` and `markdownComponents` SHALL be memoised with `useMemo`.

#### Scenario: Marker appears after cited text span

- **WHEN** an assistant message has text "The revenue was $1B." and an annotation with `target.selector.end = 19`
- **THEN** the `CitationMarker` is rendered immediately after the character at position 19 in the rendered output

#### Scenario: No markers during streaming

- **WHEN** `isStreaming` is `true`
- **THEN** `useAnnotations` returns `[]`, `groups` is empty, `markdownComponents` returns `{}`, and no `CitationMarker` components are rendered in the message bubble

#### Scenario: Missing selector appends marker at end of text

- **WHEN** an annotation has no `target.selector`
- **THEN** the `CitationMarker` is rendered after the last character of the message text

#### Scenario: Out-of-range offset clamps to end

- **WHEN** an annotation has `target.selector.end` greater than the text length
- **THEN** the `CitationMarker` is rendered at the end of the text without throwing
