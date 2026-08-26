## ADDED Requirements

### Requirement: Citation-aware markdown hook exported from the package root

`@epam/ai-dial-quotations` SHALL export a hook (the generalized form of
`apps/chat`'s `useCitationMarkdownComponents`) that, given raw markdown
content, a list of `AnnotationGroup`s, and a callbacks object
(`onPreview`, `onOpenInBrowser`, `buildLabels`), returns `{ processedContent:
string; markdownComponents: Components }` for `react-markdown`. The hook
SHALL NOT import `react-i18next`, any application context, any
attachment-canvas hook, or any application DTO-conversion helper.

#### Scenario: Uncited content takes the stable empty-overrides fast path

- **WHEN** the hook is called with `groups.length === 0`
- **THEN** `processedContent` equals the input `content` unchanged, and
  `markdownComponents` is an empty object, without calling `buildLabels`

#### Scenario: Cited content injects sentinels and returns paragraph/list overrides

- **WHEN** the hook is called with one or more `AnnotationGroup`s
- **THEN** `processedContent` has sentinel markers injected at each group's
  primary annotation's character-range end offset, and `markdownComponents`
  contains `p` and `li` overrides that replace sentinels in their children
  with a rendered `CitationDropdown`

### Requirement: Preview and browser-open actions are delegated to injected callbacks

The hook SHALL call the host-supplied `onPreview(annotation, group)` when a
citation marker's preview action is invoked, and `onOpenInBrowser(annotation)`
when its open-in-browser action is invoked. The hook SHALL own none of the
PDF-source detection, attachment-DTO conversion, or canvas-opening logic that
`apps/chat`'s app hook previously performed inline — that logic moves to the
application's own composed `onPreview` implementation. The hook SHALL NOT
depend on `@epam/ai-dial-attachment-canvas`.

#### Scenario: Preview action delegates without PDF-source branching in the library

- **WHEN** a citation marker's preview action is invoked for any annotation,
  regardless of whether its source is a PDF
- **THEN** the hook calls `onPreview(annotation, group)` and performs no
  content-type-specific branching itself

#### Scenario: Open-in-browser action delegates directly

- **WHEN** a citation marker's open-in-browser action is invoked
- **THEN** the hook calls `onOpenInBrowser(annotation)` and performs no
  DIAL-file-id resolution or `window.open` call itself

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

The hook SHALL return `null` for a sentinel marker whose index has no
corresponding entry in `groups`, and SHALL leave content unchanged when
`injectCitationSentinels` receives a group whose primary annotation has no
`text_character_range` selector (defaulting the injection point to the end
of the content).

#### Scenario: Sentinel index beyond the groups array renders nothing

- **WHEN** `processedContent` contains a sentinel referencing an index with
  no corresponding `groups` entry
- **THEN** the corresponding marker renders as `null` rather than throwing

#### Scenario: Missing character-range selector defaults to end-of-content injection

- **WHEN** a group's primary annotation has a selector that is not
  `text_character_range`
- **THEN** its sentinel is injected at the end of `content` rather than at an
  undefined offset
