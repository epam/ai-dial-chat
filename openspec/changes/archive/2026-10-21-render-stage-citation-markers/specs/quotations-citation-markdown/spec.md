## ADDED Requirements

### Requirement: Cit-only citation renderer for markdown surfaces other than the message body

`@epam/ai-dial-quotations` SHALL export a hook `useCitationTagRenderer(groups, callbacks, fallbackGroups?)` taking the same `AnnotationGroup[]`, `UseCitationMarkdownComponentsCallbacks` and optional fallback pool as `useCitationMarkdownComponents`. It SHALL return a memoized function `(dataId: string | undefined, children: ReactNode) => ReactNode` that resolves `dataId` against an `html_tag`-selector group — first among `groups`, then among the fallback pool, with `groups` winning a colliding id — and renders that group's `CitationDropdown` with the callbacks and the labels from `buildLabels`. An undefined or unmatched `dataId` SHALL render the element back as literal text (`<cit data-id="…">`, the children, `</cit>`).

The returned function SHALL keep its reference across re-renders while `groups`, the fallback pool and every callback keep theirs. The hook SHALL NOT inject sentinels, SHALL NOT render offset-based (non-`html_tag`) groups, and SHALL NOT return `p`/`li` overrides. `useCitationMarkdownComponents` SHALL render its `cit` matches through the same internal group renderer, with no change to its own behavior. Like the existing hook, it SHALL NOT import `react-i18next`, any application context, any attachment-canvas hook, or any application DTO-conversion helper.

#### Scenario: A claimed id renders a citation dropdown

- **WHEN** the returned function is called with `'c1'` and `groups` contains an `html_tag` group for `c1`
- **THEN** it renders a `CitationDropdown` for that group, and activating its preview calls `onPreview` with the group's annotation

#### Scenario: A pooled id renders when the message lacks it

- **WHEN** `groups` has no group for `c2` and the fallback pool does
- **THEN** the function renders the pooled group's `CitationDropdown`

#### Scenario: An unclaimed id renders literal text

- **WHEN** the function is called with `'zz'` and neither `groups` nor the pool has it
- **THEN** it renders the text `<cit data-id="zz"></cit>`

#### Scenario: The renderer is referentially stable

- **WHEN** the component using the hook re-renders with the same `groups`, pool and callbacks references
- **THEN** the hook returns the same function reference

#### Scenario: Offset-based groups are ignored

- **WHEN** `groups` contains only a `text_character_range` group and the function is called with any id
- **THEN** it renders literal text and does not render that group

### Requirement: Shared citation content preparation

`@epam/ai-dial-quotations` SHALL export a pure function `prepareCitationContent(content: string, isStreaming: boolean): string`. While `isStreaming` is `true` it SHALL return `stripCitTagsWhileStreaming(content)`; otherwise it SHALL return `content` with every unsupported `cit` shape escaped for literal display, the exact supported paired element `<cit data-id="…"></cit>` left as markup. It SHALL NOT inject citation sentinels. It SHALL return `content` unchanged when it contains no `<cit`.

#### Scenario: Streaming content hides complete elements

- **WHEN** called with `'a <cit data-id="x"></cit> b'` and `isStreaming: true`
- **THEN** the result does not contain `<cit data-id="x"></cit>`

#### Scenario: Finished content keeps supported elements and escapes the rest

- **WHEN** called with `isStreaming: false` and content containing `<cit data-id="x"></cit>` and a malformed `<cit data-id="y>`
- **THEN** the supported element is unchanged and the malformed one is escaped so it renders as literal text

#### Scenario: Content without citation markup is returned unchanged

- **WHEN** called with `'plain text'` and either streaming value
- **THEN** the result is `'plain text'`
