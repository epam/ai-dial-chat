## MODIFIED Requirements

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
