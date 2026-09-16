# quotations-citation-markdown Specification

## Purpose

Specifies the host-agnostic citation-aware markdown hook exported from
`@epam/ai-dial-quotations` — the generalized form of `apps/chat`'s
`useCitationMarkdownComponents` — covering sentinel injection, the
`react-markdown` `p`/`li` overrides that render `CitationDropdown`, and the
delegation of preview/open-in-browser actions and label text to
host-supplied callbacks instead of `react-i18next`, application DTO
conversion, or `@epam/ai-dial-attachment-canvas`.

## Requirements

### Requirement: Citation-aware markdown hook exported from the package root

`@epam/ai-dial-quotations` SHALL export a hook (`useCitationMarkdownComponents`) that, given raw markdown content, a list of `AnnotationGroup`s (which may mix URL-keyed groups and `cit`-id-keyed groups), a callbacks object (`onPreview`, `onOpenInBrowser`, `buildLabels`), and an `isStreaming: boolean`, returns `{ processedContent: string; markdownComponents: Components }` for `react-markdown`. The hook SHALL NOT import `react-i18next`, any application context, any attachment-canvas hook, or any application DTO-conversion helper.

`processedContent` computation depends on `isStreaming`:
- When `isStreaming` is `true`: applies `stripCitTagsWhileStreaming(content)` unconditionally (regardless of `groups`), which hides complete supported `<cit data-id="…"></cit>` elements and escapes every other `cit` shape for literal display. `groups` is expected to be `[]` in this state (per the `message-annotations`/`citation-marker` capabilities' `useAnnotations` requirement), so no offset-based sentinel injection runs either.
- When `isStreaming` is `false`: injects sentinels for non-`html_tag` groups when present, then escapes every unsupported `cit` shape so it is displayed as ordinary text. The exact supported paired shape remains a real `<cit>` element handled by the component override.

`markdownComponents` includes a `cit` override when a supported element is present or groups are non-empty. It looks the element's `data-id` prop up against an `html_tag`-selector group and renders the existing citation dropdown for a match; an unmatched supported element is serialized back to visible literal text.

#### Scenario: Uncited content with empty groups takes the stable empty-overrides fast path

- **WHEN** the hook is called with `groups.length === 0`, `isStreaming: false`, and `content` containing no `<cit` markup
- **THEN** `processedContent` equals the input `content` unchanged, and `markdownComponents` is an empty object, without calling `buildLabels`

#### Scenario: Cited content injects sentinels and returns paragraph/list/cit overrides

- **WHEN** the hook is called with one or more `AnnotationGroup`s and `isStreaming: false`
- **THEN** `processedContent` has sentinel markers injected at each non-`html_tag` group's character-offset insertion point, and `markdownComponents` contains `p`, `li`, and `cit` overrides

#### Scenario: A supported citation element is hidden while streaming

- **WHEN** the hook is called with `isStreaming: true` and `content` containing a `<cit data-id="e43864"></cit>` element
- **THEN** `processedContent` has that element removed, whether or not `groups` currently has a matching entry
- **AND** an unsupported or partial `cit` shape would instead be escaped for literal display

### Requirement: A repeated citation marker owns its own popup

When one message's content resolves more than one rendered marker to the **same** `AnnotationGroup` — a `<cit data-id="X"></cit>` element occurring several times, or a reference chip whose group shares a `groupKey` with an inline group — each rendered occurrence SHALL be an independent popup owner.

The hook SHALL achieve this without changing citation data: it SHALL NOT deduplicate markers, SHALL NOT synthesise a distinct `AnnotationGroup` per occurrence, and SHALL NOT clone the group's `Annotation` objects. Occurrence identity belongs to the rendered `CitationDropdown` instance (see the `citation-card` capability), not to the group.

Consequently:

- Activating any marker SHALL open exactly one card, anchored to that marker's own trigger element.
- At most one citation card SHALL be present in the document at any time within one message.
- Activating a different occurrence SHALL transfer the open card to it.
- `onPreview` and `onOpenInBrowser` SHALL each be invoked **exactly once** per user activation, with the `Annotation` the open card is currently displaying, and with that annotation reference-identical to the object held in the `groups` array the hook was given.
- `onPreview` SHALL receive the same `AnnotationGroup` object the hook was given, so the host's group-containment and index lookups continue to resolve.

`markdownComponents` SHALL remain independent of citation popup state, so no rerender caused by opening, navigating, or closing a card remounts a marker and discards its occurrence identity.

#### Scenario: Two occurrences of one cit id open one card at a time

- **WHEN** the content is `Alice did X<cit data-id="e1"></cit> Bob did X<cit data-id="e1"></cit>`, `isStreaming` is `false`, one `html_tag` group matches `"e1"`, and the user activates the first marker
- **THEN** exactly one citation card is rendered

#### Scenario: Activating the second occurrence moves the card

- **WHEN** the first occurrence's card is open and the user activates the second occurrence's marker
- **THEN** exactly one card is rendered, anchored to the second marker

#### Scenario: Preview fires once with the displayed annotation

- **WHEN** a card opened from a repeated marker is showing an annotation and the user clicks "Preview"
- **THEN** `onPreview` is called exactly once, with that annotation and its group, and the annotation is reference-identical to the entry in `groups`

#### Scenario: Download fires once with the displayed annotation

- **WHEN** a card opened from a repeated marker is showing an annotation and the user clicks "Download"/"Open in browser"
- **THEN** `onOpenInBrowser` is called exactly once with that annotation

#### Scenario: Reopening after a dismissal still works

- **WHEN** the user opens an occurrence's card, dismisses it, and activates the same or another occurrence again
- **THEN** a card opens and its Preview and Download buttons each invoke their callback exactly once

#### Scenario: Repeated markers in separate paragraphs behave the same

- **WHEN** two occurrences of one `data-id` are in two different paragraphs
- **THEN** activating either opens exactly one card and its actions fire once

### Requirement: Preview and browser-open actions are delegated to injected callbacks

The hook SHALL call the host-supplied `onPreview(annotation, group)` when a citation marker's preview action is invoked, and `onOpenInBrowser(annotation)` when its open-in-browser action is invoked. The hook SHALL own none of the PDF-source detection, attachment-DTO conversion, or canvas-opening logic that `apps/chat`'s app hook previously performed inline — that logic moves to the application's own composed `onPreview` implementation. The hook SHALL NOT depend on `@epam/ai-dial-attachment-canvas`.

The `annotation` argument SHALL be the object the card is currently displaying — `group.annotations[activeIndex]`, falling back to `group.primaryAnnotation` — passed by reference, never copied. The `group` argument SHALL be the same object supplied in the hook's `groups` array. Host mappers rely on both: `annotationToOoxmlCanvasContent` marks the clicked highlight selected via `entry === annotation`, and `annotationToPdfCanvasContent` locates the group via `groups.find(g => g.annotations.includes(annotation))`.

Each callback SHALL be invoked exactly once per user activation. Where several markers resolve to one group, the invocation SHALL come from the occurrence whose card is open, and no other occurrence SHALL contribute an additional invocation.

#### Scenario: Preview action delegates without PDF-source branching in the library

- **WHEN** a citation marker's preview action is invoked for any annotation,
  regardless of whether its source is a PDF
- **THEN** the hook calls `onPreview(annotation, group)` and performs no
  content-type-specific branching itself

#### Scenario: Open-in-browser action delegates directly

- **WHEN** a citation marker's open-in-browser action is invoked
- **THEN** the hook calls `onOpenInBrowser(annotation)` and performs no
  DIAL-file-id resolution or `window.open` call itself

#### Scenario: The delegated annotation is reference-identical

- **WHEN** the host compares the annotation it receives against the entries of the `groups` array it passed in
- **THEN** the received annotation is the same object instance, not a structural copy

#### Scenario: A repeated marker does not double-invoke

- **WHEN** a group is rendered by several markers in one message and the user clicks "Preview" once
- **THEN** `callbacks.onPreview` is called exactly once

### Requirement: Marker labels are built per group via an injected callback

The hook SHALL call the host-supplied `buildLabels(group): { cardLabels;
markerLabels }` to obtain all translated strings for a given citation
group, memoizing the resulting override map so that `p`/`li` overrides only
change identity when `groups`, `buildLabels`, `onPreview`, `onOpenInBrowser`,
or `isCompactTypography` change — never on citation-card open/close
interaction state.

#### Scenario: Stable component references across unrelated re-renders

- **WHEN** the host re-renders with the same `groups`, `callbacks`, and
  `isCompactTypography`, but changed, unrelated component state
- **THEN** `markdownComponents` retains the same object identity as the
  previous render

#### Scenario: Component references change only when groups transition between empty and non-empty

- **WHEN** `groups` changes from an empty array to a non-empty array (or vice
  versa) between renders
- **THEN** `markdownComponents` is recomputed; a change to `groups`'
  contents alone (same emptiness) with the same `buildLabels` reference does
  not otherwise change unrelated overrides' identity

### Requirement: Out-of-range or malformed annotation input is handled defensively

The hook SHALL return `null` for a sentinel marker whose index has no corresponding entry in `groups`, and SHALL leave content unchanged when the offset-based injection path receives a group whose primary annotation has no `text_character_range` selector (defaulting the injection point to the end of the content). For the tag-based (`cit` element) path, a `data-id` with no corresponding group SHALL render as literal `<cit data-id="…"></cit>` text. Unsupported shapes, including dangling tags and tags using `id` instead of `data-id`, SHALL be escaped before `react-markdown` parses them so the original markup and following text remain visible without mounting a custom element.

#### Scenario: Sentinel index beyond the groups array renders nothing

- **WHEN** `processedContent` contains a sentinel referencing an index with no corresponding `groups` entry
- **THEN** the corresponding marker renders as `null` rather than throwing

#### Scenario: Missing character-range selector defaults to end-of-content injection

- **WHEN** a group's primary annotation has a selector that is not `text_character_range`
- **THEN** its sentinel is injected at the end of `content` rather than at an undefined offset

#### Scenario: Unmatched cit data-id renders as text without error

- **WHEN** `content` contains a `<cit data-id="unknown-id"></cit>` element and no group's `target.selector.id` equals `"unknown-id"`
- **THEN** the `cit` component override renders the original element markup as literal text and the hook does not throw

#### Scenario: A dangling open tag while streaming remains literal text

- **WHEN** `isStreaming` is `true` and `content` ends with `<cit data-id="e438">` followed by more already-streamed text but no `</cit>`
- **THEN** the dangling tag is escaped and both its markup and the text after it remain visible
