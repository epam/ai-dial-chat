## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Preview and browser-open actions are delegated to injected callbacks

The hook SHALL call the host-supplied `onPreview(annotation, group)` when a citation marker's preview action is invoked, and `onOpenInBrowser(annotation)` when its open-in-browser action is invoked. The hook SHALL own none of the PDF-source detection, attachment-DTO conversion, or canvas-opening logic that `apps/chat`'s app hook previously performed inline — that logic moves to the application's own composed `onPreview` implementation. The hook SHALL NOT depend on `@epam/ai-dial-attachment-canvas`.

The `annotation` argument SHALL be the object the card is currently displaying — `group.annotations[activeIndex]`, falling back to `group.primaryAnnotation` — passed by reference, never copied. The `group` argument SHALL be the same object supplied in the hook's `groups` array. Host mappers rely on both: `annotationToOoxmlCanvasContent` marks the clicked highlight selected via `entry === annotation`, and `annotationToPdfCanvasContent` locates the group via `groups.find(g => g.annotations.includes(annotation))`.

Each callback SHALL be invoked exactly once per user activation. Where several markers resolve to one group, the invocation SHALL come from the occurrence whose card is open, and no other occurrence SHALL contribute an additional invocation.

#### Scenario: Preview action delegates without PDF-source branching in the library

- **WHEN** a citation marker's preview action is invoked for any annotation, regardless of whether its source is a PDF
- **THEN** the hook calls `onPreview(annotation, group)` and performs no content-type-specific branching itself

#### Scenario: Open-in-browser action delegates directly

- **WHEN** a citation marker's open-in-browser action is invoked
- **THEN** the hook calls `onOpenInBrowser(annotation)` and performs no DIAL-file-id resolution or `window.open` call itself

#### Scenario: The delegated annotation is reference-identical

- **WHEN** the host compares the annotation it receives against the entries of the `groups` array it passed in
- **THEN** the received annotation is the same object instance, not a structural copy

#### Scenario: A repeated marker does not double-invoke

- **WHEN** a group is rendered by several markers in one message and the user clicks "Preview" once
- **THEN** `callbacks.onPreview` is called exactly once
