## ADDED Requirements

### Requirement: Stage content renders citation elements through a caller-supplied renderer

`CollapsedGroupProps` and `StagesPanelProps` in `@epam/ai-dial-conversation-stages` SHALL accept an optional `renderCitation` callback of the exported type `StageCitationRenderer` — `(dataId: string | undefined, children: ReactNode) => ReactNode`. `CollapsedGroup` SHALL forward it unchanged to its `StagesPanel`, and `StagesPanel` → `StageList` → `StageItem` SHALL forward it to every stage at every nesting depth, the same way `attachmentDisplayResolvers` is forwarded.

`StageMarkdownContent` (`libs/conversation-stages/src/components/StageMarkdownContent/StageMarkdownContent.tsx`) SHALL, when `renderCitation` is supplied, render every `<cit>` element in the stage content by calling `renderCitation` with the element's `data-id` value and children. When it is not supplied, a `<cit>` element SHALL keep rendering as literal text through the shared default `cit` override.

The callback SHALL only replace the `cit` element: the `classNames` derived from `StageTypography` and the stage `code` override SHALL apply unchanged to cited and uncited stage content. `StageMarkdownContent` SHALL build its `components` map with `useMemo` so a referentially stable `renderCitation` does not re-create it.

The library SHALL NOT import `@epam/ai-dial-quotations`, `react-i18next`, or any application module to support this; annotation lookup, labels and preview behavior stay with the caller.

#### Scenario: A supplied renderer replaces the cit element

- **WHEN** a stage with content `see <cit data-id="c1"></cit>` is expanded and `renderCitation` is supplied
- **THEN** `renderCitation` is called with `'c1'` and its result is rendered where the element was, and the literal text `<cit data-id="c1"></cit>` is not shown

#### Scenario: Without a renderer the element stays literal text

- **WHEN** the same stage is expanded and no `renderCitation` is supplied
- **THEN** the stage shows the literal text `<cit data-id="c1"></cit>`

#### Scenario: A nested stage receives the renderer

- **WHEN** `CollapsedGroup` receives `renderCitation` and a grandchild stage's content contains a `<cit>` element
- **THEN** the grandchild's expanded content renders that element through the same `renderCitation`

#### Scenario: Stage typography is preserved around a citation

- **WHEN** a stage paragraph containing a `<cit>` element is rendered with `typography.contentClassName` set
- **THEN** the paragraph keeps that class and the stage content class, with no message-body paragraph classes added

### Requirement: Assistant messages resolve stage citations from message-level annotations

`ConversationMessageItem` (`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`) SHALL pass `CollapsedGroup` a `renderCitation` built with `useCitationTagRenderer` from `@epam/ai-dial-quotations`, using the same `citationGroups`, `citationCallbacks` and `fallbackCitationGroups` it passes to `useCitationMarkdownComponents` for the message body. Stage citations SHALL NOT read any stage-level annotation field; the message's annotations, then the conversation annotation pool, are the only sources.

Before passing stages down, the host SHALL map every stage whose `content` contains `<cit` through `prepareCitationContent(content, isStreaming)`, and SHALL return every other stage by reference. The prepared stage list and the callback SHALL be memoized (`useMemo` on `stages` and `isStreaming`; the callback is memoized by the hook). Stage citations SHALL render inside the message's existing `CitationCardProvider`, so at most one citation card is open across the body and all stages.

No new user-visible strings are introduced: stage markers use the same `buildCitationLabels` translations as the body. The feature is not gated by `ENABLED_FEATURES`. RTL impact is none beyond the existing `CitationDropdown`, which already uses logical spacing. Keyboard and screen-reader behavior is the existing `CitationMarker` button behavior; a collapsed stage renders no content, so its markers are not focusable.

#### Scenario: A stage marker resolves from the message annotations

- **WHEN** a finished assistant message has an `html_tag` annotation with id `c1` in `custom_content.annotations`, and an expanded stage's content contains `<cit data-id="c1"></cit>`
- **THEN** the stage shows a citation marker for that annotation's source, and activating it opens the same card, preview and open-in-browser actions as a body marker for `c1`

#### Scenario: A stage marker resolves from the conversation pool

- **WHEN** the message has no annotation for `c2`, the conversation annotation pool has one, and a stage cites `<cit data-id="c2"></cit>`
- **THEN** the stage marker is rendered from the pooled annotation

#### Scenario: An unclaimed stage marker degrades to text

- **WHEN** a stage cites `<cit data-id="zz"></cit>` and neither the message nor the pool has an annotation for `zz`
- **THEN** the stage shows the literal text `<cit data-id="zz"></cit>`

#### Scenario: Stage markers are hidden while the message streams

- **WHEN** the message is streaming and a stage's content contains a complete `<cit data-id="c1"></cit>` and a partial `<cit data-id="c`
- **THEN** the complete element is not shown, the partial markup is shown as literal text, and no citation marker is rendered

#### Scenario: One card is open across body and stages

- **WHEN** the body and a stage both cite `c1`, the body marker's card is open, and the user activates the stage marker
- **THEN** the body card closes and the stage marker's card opens

#### Scenario: Stages without citation markup keep their identity

- **WHEN** the message re-renders and a stage's `content` contains no `<cit`
- **THEN** the stage object passed to `CollapsedGroup` is the same reference the host derived from the message
