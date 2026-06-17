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
- `sourceName` SHALL be derived by extracting the last path segment of the URL (decoded, without query params); if that segment is empty or not parseable, fall back to the URL hostname.
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

#### Scenario: Source name uses filename from URL path

- **WHEN** the attachment URL is `https://files.example.com/path/to/report.pdf`
- **THEN** `sourceName` is `"report.pdf"`

#### Scenario: Source name falls back to hostname when path has no filename

- **WHEN** the attachment URL is `https://wikipedia.org/`
- **THEN** `sourceName` is `"wikipedia.org"`

---

### Requirement: `CitationMarker` renders an inline button after the cited text span

`apps/chat/src/components/Citations/CitationMarker/CitationMarker.tsx` SHALL render a UI kit `Button` (variant neutral, appearance outlined, size small) with:
- Label: `sourceName` when `annotationCount === 1`; `sourceName + " +" + (annotationCount - 1)` when `annotationCount > 1` (e.g. `"Wikipedia +1"`)
- `aria-label`: `"Citation from <sourceName>"` (i18n key `citations.marker.ariaLabel`)
- `onClick`: calls the `onOpen` callback prop

The component SHALL accept:
```ts
interface CitationMarkerProps {
  sourceName: string;
  annotationCount: number;
  onOpen: () => void;
}
```

**i18n keys**: `citations.marker.label` (single), `citations.marker.labelWithOverflow` (with `+N`), `citations.marker.ariaLabel`.
**RTL**: the button itself is direction-agnostic (text content only, no directional icon).
**Accessibility**: button role is already provided by the UI kit `Button`; no additional ARIA attributes needed.
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
- **THEN** no `CitationMarker` components are rendered in the message bubble

#### Scenario: Missing selector appends marker at end of text

- **WHEN** an annotation has no `target.selector`
- **THEN** the `CitationMarker` is rendered after the last character of the message text

#### Scenario: Out-of-range offset clamps to end

- **WHEN** an annotation has `target.selector.end` greater than the text length
- **THEN** the `CitationMarker` is rendered at the end of the text without throwing
