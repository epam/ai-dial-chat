# stage-visualization Specification

## Purpose

The `conversation-stages` library: merging streamed stages into a conversation and rendering them above assistant message bubbles.

## Requirements

### Requirement: `libs/conversation-stages` exposes the stage renderers

The `@epam/ai-dial-conversation-stages` library SHALL exist at `libs/conversation-stages/`. It SHALL export `StagesPanel`, `CollapsedGroup`, their public props, labels, color, style, and typography types, and the `CONVERSATION_STAGES_CLASS` public class-name constant. The library SHALL declare `react`, `@epam/ai-dial-ui-kit`, and `@epam/ai-dial-chat-shared` as peer dependencies, and `@tabler/icons-react` and `@epam/ai-dial-attachment-input` (whose `AttachmentCard` renders stage attachment tiles) as runtime `dependencies`.

#### Scenario: CollapsedGroup is importable in apps/chat
- **WHEN** `apps/chat` imports `CollapsedGroup` from `@epam/ai-dial-conversation-stages`
- **THEN** TypeScript resolves the import without error

---

### Requirement: Stage type includes optional content field

The `Stage` interface in `libs/chat-shared` SHALL include `content?: string` in addition to `index`, `name`, and `status`. The field accumulates the stage's markdown body text across streaming chunks. The interface SHALL additionally include `parent_stage_index?: number`, referring to the parent's index in the same message's normalized stage array. Omission denotes a top-level stage; zero is a valid parent index. The public model SHALL remain a flat array without persisted `children` lists.

#### Scenario: Stage without content is valid
- **WHEN** a `Stage` object is constructed without `content`
- **THEN** TypeScript accepts it without error

#### Scenario: Stage with content is valid
- **WHEN** a `Stage` object is constructed with `content: "## Result\n...">`
- **THEN** TypeScript accepts it without error

#### Scenario: Child of the first stage is valid
- **WHEN** a `Stage` has `index: 1` and `parent_stage_index: 0`
- **THEN** TypeScript accepts it and the parent reference remains zero

#### Scenario: Flat stages remain source-compatible
- **WHEN** an existing host constructs stages without `parent_stage_index`
- **THEN** no additional required property is needed

### Requirement: Streaming assembly merges incoming stages into `custom_content`

`applyChunkToMessages` in `libs/chat-hooks/src/conversation/useConversationStream/apply-chunk.ts` SHALL read `chunk.choices[0]?.delta?.custom_content?.stages` on every chunk. If stages are present, it MUST merge them through the exported `mergeStages(existing, incoming)` helper in the same file, which SHALL:
1. Upsert each incoming stage into `message.custom_content.stages` by `index`, merging an existing entry and appending a new index.
2. Append `stage.name` and `stage.content` deltas to the existing values for that index.
3. Apply an incoming `status` only to the stage with the matching index; it MUST NOT infer a completed status from the arrival of another stage.
4. Preserve stages when a chunk contains no stage update.
5. Preserve an accumulated `parent_stage_index` when a later delta omits it; retain a supplied zero without truthiness checks. Parent metadata SHALL remain associated with the child's own index, independent of status/content/attachment updates.
6. Keep message data owned by the existing `useConversationStream` buffers and backend generation persistence; derive hierarchy only for rendering.

Text token accumulation (`delta.content`) SHALL continue independently.

#### Scenario: Stage with new index is appended
- **WHEN** a chunk arrives with `custom_content.stages: [{ index: 3, name: 'Lookup', status: null }]` and the message has no stage at index 3
- **THEN** the assistant message's `custom_content.stages` array contains the new entry

#### Scenario: Stage with existing index is updated
- **WHEN** a chunk arrives with `custom_content.stages: [{ index: 1, status: 'completed' }]` and the message already has `{ index: 1, status: null }`
- **THEN** the stage at index 1 has `status: 'completed'`

#### Scenario: A later stage does not complete an earlier stage
- **WHEN** stage 6 has `status: null` and a subsequent chunk introduces stage 7
- **THEN** stage 6 keeps `status: null` until a chunk for index 6 explicitly supplies `status: 'completed'` or `status: 'failed'`

#### Scenario: Stage content is appended
- **WHEN** two chunks both carry `content` for stage index 0
- **THEN** the accumulated `stage.content` equals the concatenation of both values

#### Scenario: Chunk without stages does not clear existing stages
- **WHEN** a chunk arrives with no `custom_content.stages`
- **THEN** the assistant message's existing stages are unchanged

#### Scenario: Stages persist after streaming ends
- **WHEN** streaming completes, the backend generation service persists the assembled message, and the frontend reloads the conversation
- **THEN** the saved conversation's last assistant message contains the full accumulated stages and their parent references in `custom_content.stages`

#### Scenario: Parent metadata is sent only when a stage opens
- **GIVEN** the opening delta for stage 1 has `parent_stage_index: 0`
- **WHEN** later deltas for stage 1 provide content, attachments and terminal status without `parent_stage_index`
- **THEN** the accumulated stage retains parent 0 and all of its own accumulated content
- **AND** stage 0's status is unchanged by stage 1's updates

#### Scenario: Sparse indexed siblings keep their parent through replay
- **WHEN** replay opens parent 4 and children 7 and 9, both referencing parent 4, and subsequently updates the children in interleaved chunks
- **THEN** all three indexes remain distinct and both children retain parent 4

### Requirement: `StageIcon` maps status to the correct icon

The `StageIcon` component SHALL render:
- `IconAlertCircle` — when `status === StageStatus.Failed`, regardless of a stale `isLive` value
- `IconCheck` — when `status === StageStatus.Completed`, regardless of a stale `isLive` value
- `Spinner` — when `status === null` AND `isLive === true`
- no status icon — when `status === null` AND `isLive === false`

A completion check MUST be driven only by the explicit `StageStatus.Completed` value. The component MUST NOT infer completion because a stage is no longer the latest entry or because `isLive` is `false`.

#### Scenario: Live running stage shows spinner
- **WHEN** `status` is `null` and `isLive` is `true`
- **THEN** `Spinner` is rendered

#### Scenario: Completed stage shows check icon
- **WHEN** `status` is `StageStatus.Completed`
- **THEN** `IconCheck` is rendered

#### Scenario: Non-live unresolved stage does not show a completed check
- **WHEN** `status` is `null` and `isLive` is `false`
- **THEN** neither `IconCheck`, `IconAlertCircle`, nor `Spinner` is rendered

#### Scenario: Explicit failure wins over stale live state
- **WHEN** `status` is `StageStatus.Failed` and `isLive` is `true`
- **THEN** `IconAlertCircle` is rendered and `Spinner` is not rendered

---

### Requirement: `StageItem` collapses/expands its content body

Each `StageItem` SHALL render a header row (icon + name). When `stage.content` is present, `stage.attachments` contains at least one entry, or the stage has derived child nodes, the item SHALL render as the kit's `Accordion` component, whose header toggles a content body mounted only while expanded, with immediate unmount on collapse. When `stage.content` and `stage.attachments` are absent/empty and the stage has no child nodes, the item is a static row with no toggle.

#### Scenario: Stage without content renders a plain row
- **WHEN** `stage.content` is undefined or empty, `stage.attachments` is undefined or empty, and the stage has no child nodes
- **THEN** no toggle button is rendered

#### Scenario: Stage with content renders a collapsible button
- **WHEN** `stage.content` is a non-empty string
- **THEN** a button element is rendered and clicking it expands/collapses the content body

#### Scenario: Closed details are not rendered

- **WHEN** the item starts closed or is collapsed after opening
- **THEN** its Markdown body and attachment tiles are unmounted and its disclosure exposes `aria-expanded="false"`

#### Scenario: Stage with only attachments renders a collapsible button
- **WHEN** `stage.content` is undefined or empty and `stage.attachments` contains at least one entry
- **THEN** a button element is rendered and clicking it expands/collapses the content body

#### Scenario: A container with only children is expandable
- **WHEN** a stage has no content or attachments but has child nodes
- **THEN** its header is a disclosure button that reveals or hides its child list

#### Scenario: Own output and child stages coexist
- **WHEN** a parent has markdown, attachments and children and is expanded
- **THEN** its body shows markdown, then its attachment tiles, then a nested stage list
- **AND** child controls are outside the parent's header button and keep the host's attachment callback

### Requirement: Stage attachments render as attachment tiles inside the expanded content body

When a `StageItem`'s content body is expanded and `stage.attachments` contains entries, the component SHALL map each raw attachment to a display-only attachment model and render it as an attachment tile below any `stage.content`, in array order. Tiles SHALL be rendered in a `role="list"` region with one `role="listitem"` per tile. The component SHALL NOT render an attachment's `data` inline as visible markdown text — a tile is the only visible representation of a stage attachment. The mapped tile's content type (which drives its icon and type badge) SHALL come from the attachment's own declared `type` when present, not from a type inferred from `reference_url`'s path — a stage attachment's `reference_url` points at the source document a result was extracted from, not at the attachment's own content.

#### Scenario: Each attachment renders as its own tile
- **WHEN** the expanded stage has `attachments: [{ title: "[0.2] doc.csv", data: "Some markdown text" }]`
- **THEN** the expanded body shows one attachment tile whose accessible name is "[0.2] doc.csv"

#### Scenario: A tile's type badge reflects the attachment's own declared type, not its reference_url's extension
- **WHEN** an attachment has `type: "text/markdown"`, inline `data`, and `reference_url: "files/abc/uploads/glossary_terms.csv"`
- **THEN** the tile's content type is `"text/markdown"`, not a CSV type inferred from the `.csv` path in `reference_url`

#### Scenario: Multiple attachments render in order
- **WHEN** the expanded stage has two attachments at index 0 and 1
- **THEN** both render as separate tiles, in that order, below any `stage.content`

#### Scenario: A reference-only attachment (no inline data) still renders a tile
- **WHEN** an attachment has `reference_url: "files/abc/doc.csv"` and no `data`
- **THEN** the expanded body still shows one attachment tile for it

---

### Requirement: Clicking a stage attachment tile invokes a caller-supplied callback

`StageItem` SHALL accept an optional `onAttachmentClick: (attachment: DisplayAttachment) => void` callback, threaded unchanged through `StagesPanel` and `CollapsedGroup`. When a tile is clicked/activated, the component SHALL resolve the click back to the specific mapped display attachment and invoke `onAttachmentClick` with that object. The component SHALL NOT itself open any preview, canvas, or download — that is the caller's responsibility.

#### Scenario: Clicking a tile calls onAttachmentClick with the mapped attachment
- **WHEN** an attachment `{ title: "result.csv", data: "Some markdown text" }` is clicked and `onAttachmentClick` is supplied
- **THEN** `onAttachmentClick` is called once with an object whose `name` is `"result.csv"` and whose `data` is `"Some markdown text"`

#### Scenario: A tile still renders when no callback is supplied
- **WHEN** `onAttachmentClick` is omitted
- **THEN** the tile still renders and clicking it does not throw

---

### Requirement: Stage attachment previews resolve through caller-supplied URL resolvers

`StageItem` SHALL accept an optional `attachmentDisplayResolvers: AttachmentDisplayResolvers` prop (the type exported by `@epam/ai-dial-chat-shared`), threaded unchanged through `CollapsedGroup`, `StagesPanel` and every nesting level of the stage list, including the attempts of a `×N` group. `mapStageAttachmentsToDisplay` SHALL forward it to the shared mapper, so an image tile's `previewUrl` and an audio tile's `playUrl` come from the host's `resolvePreviewUrl` / `resolvePlayUrl`. The library SHALL NOT construct a download URL, endpoint path or any other host-owned URL itself; without resolvers a tile falls back to the attachment's raw `url`. A DIAL file id (`files/<bucket>/<path>`) is not a loadable image source on its own, so the host SHALL supply resolvers wherever stage attachments may be DIAL files.

#### Scenario: An image stage attachment previews through the host resolver
- **WHEN** an expanded stage has `attachments: [{ title: "render.png", type: "image/png", url: "files/bucket/appdata/app/render.png" }]` and `attachmentDisplayResolvers.resolvePreviewUrl` is supplied
- **THEN** the tile's image source is the value `resolvePreviewUrl` returned for that attachment, and the mapped attachment's `url` stays the raw file id

#### Scenario: Without resolvers the tile previews its raw url
- **WHEN** `attachmentDisplayResolvers` is omitted
- **THEN** the image tile's `previewUrl` is the attachment's own `url`

#### Scenario: Nested stages receive the same resolvers
- **WHEN** resolvers are passed to `CollapsedGroup` and an image attachment belongs to a grandchild stage or to one attempt of a `×N` group
- **THEN** that tile's preview is resolved by the same host resolver

---

### Requirement: `StagesPanel` renders a hierarchy of stages

`StagesPanel` SHALL accept `stages: Stage[]`, `isStreaming: boolean`, and optional `className`, `styles`, and `labels` props. It SHALL derive a hierarchy from `parent_stage_index` and render a root `<ul role="list">` with one `<li role="listitem">` per root row and nested lists for children. Root and sibling order SHALL follow input encounter order. Inputs without parent metadata SHALL retain the existing flat rendering and grouping behavior. Each normalized stage SHALL appear exactly once in the hierarchy, possibly within a repeated-attempt group. While `isStreaming` is `true`, every stage with `status === null` SHALL receive `isLive={true}` and show a running spinner. The arrival of a later unresolved stage MUST NOT change an earlier unresolved stage to a completed check. A collapsed repeated-stage row SHALL remain live while any attempt in that row has `status === null`.

#### Scenario: Panel renders all stage rows
- **WHEN** `StagesPanel` receives 3 root stages with distinct names
- **THEN** 3 list items are rendered

#### Scenario: Every null-status stage stays live during streaming
- **WHEN** `isStreaming` is `true` and stages 0 and 2 have `status: null`
- **THEN** stages 0 and 2 both receive `isLive={true}` and neither renders a completed check

#### Scenario: A stage becomes completed only after its status update
- **WHEN** stages 0 and 2 have `status: null`, then a later chunk changes only stage 0 to `status: 'completed'`
- **THEN** stage 0 renders a completed check and stage 2 continues to render a running spinner

#### Scenario: Repeated-stage group remains unresolved
- **WHEN** a collapsed repeated-stage row contains one completed attempt and one attempt with `status: null` while streaming
- **THEN** the group summary renders a running spinner until the unresolved attempt receives a terminal status

#### Scenario: No stage is live when not streaming
- **WHEN** `isStreaming` is `false`
- **THEN** no stage receives `isLive={true}` and an unresolved `status: null` stage does not render a completed check

#### Scenario: Multiple roots and three levels
- **WHEN** stages are parent 0, child 1 of 0, grandchild 2 of 1, and independent root 3
- **THEN** the root list contains 0 and 3, stage 1 is inside 0's body, and stage 2 is inside 1's body after their ancestors are expanded

#### Scenario: A completed parent has a live child
- **WHEN** parent 0 is completed, child 1 has `status: null`, and streaming continues
- **THEN** the parent keeps its completed icon and the expanded child shows a spinner

#### Scenario: Empty stage data
- **WHEN** `CollapsedGroup` receives an empty stage array
- **THEN** it renders no stage surface

### Requirement: `StagesPanel` is themed via CSS custom properties

When `styles.colors` is provided, `StagesPanel` SHALL apply its values as CSS custom properties on the root element using `buildCssVars`. Supported variables are `--cs-text`, `--cs-row-hover`, `--cs-button-bg`, `--cs-stage-text`, `--cs-failed-text`, `--cs-tag-text`, `--cs-count-text`, `--cs-duration-text`, `--cs-icon-secondary`, `--cs-icon-completed`, `--cs-icon-error`, `--cs-code-bg`, `--cs-code-border`, `--cs-code-text`, and `--cs-border`.

#### Scenario: Supplied colors become custom properties

- **WHEN** `StagesPanel` is rendered with a `styles.colors` object
- **THEN** its root element carries the corresponding `--cs-*` custom properties built via `buildCssVars`

#### Scenario: Omitted colors leave the root unstyled

- **WHEN** `StagesPanel` is rendered without `colors`
- **THEN** no `--cs-*` custom property is written onto the root element and the panel inherits the ambient theme

---

### Requirement: Stage summaries show no total execution time

Neither the `CollapsedGroup` summary line nor a collapsed repeated-stage (`×N`) row in `StagesPanel` SHALL show a total execution time computed from stage durations. Each individual stage row SHALL continue to show its own duration label when its name carries parseable duration metadata.

#### Scenario: The `CollapsedGroup` summary shows no total time

- **WHEN** a finished `CollapsedGroup` renders stages whose names carry parseable duration metadata
- **THEN** its summary line shows the step (and failure) counts only, with no total execution time across all stages

#### Scenario: A repeated-stage row shows no total time

- **WHEN** two finished attempts of one repeated stage each declare a duration of 40 seconds
- **THEN** the collapsed `×2` row shows the count only, with neither `40.0s` nor `1m 20s`

---

### Requirement: `CollapsedGroup` is rendered in assistant messages that have stages

In `ConversationMessageItem.tsx`, the `messageHasStages` utility (imported from `@epam/ai-dial-chat-hooks`, `libs/chat-hooks/src/conversation/message-utils.ts`) SHALL return `true` only when `message.role` is `MessageRole.Assistant` and `message.custom_content?.stages?.length > 0`. For each message where this returns `true`, a `CollapsedGroup` SHALL be rendered in the corresponding `MessageBubble`'s `afterContent`, receiving a memoized `mapStages(message.custom_content.stages)` result, including parent metadata and positional identities for complete unindexed arrays. The memo SHALL depend on the original stage-array reference. It SHALL NOT rewrite the stored message or alter other custom content. `ConversationMessageItem` remains the app adapter supplying translated labels, `onAttachmentClick`, and `attachmentDisplayResolvers` — the same resolvers from `apps/chat/src/utils/attachment-display-resolvers.ts` that message-level attachments use, so a stage image stored as a DIAL file previews through the file download endpoint; neither UI library nor mapper SHALL import app contexts, endpoint paths, SDK setup, routing or persistence. Its `isStreaming` prop SHALL come from `isStreamingMessage`, so it is `true` only for the last assistant message while `isAssistantTyping` is `true`.

#### Scenario: Assistant message with stages shows CollapsedGroup
- **WHEN** an assistant message has at least one entry in `custom_content.stages`
- **THEN** `CollapsedGroup` is rendered in the corresponding `MessageBubble` after-content area

#### Scenario: User message does not show CollapsedGroup
- **WHEN** a user message is rendered
- **THEN** no `CollapsedGroup` is present for that message

#### Scenario: Assistant message without stages does not show CollapsedGroup
- **WHEN** an assistant message has no stages
- **THEN** no `CollapsedGroup` is rendered for that message

#### Scenario: History and live input use the same rendering contract
- **WHEN** an assistant message is loaded from history, restored from a stream buffer, or updated by a new chunk
- **THEN** its stage renderers receive normalized `Stage[]` through the existing prop
- **AND** attachment activation continues to invoke the app-supplied callback
- **AND** stage image previews resolve through the app-supplied `attachmentDisplayResolvers`

### Requirement: Stage status rendering has unit tests

Tests SHALL be placed under the component-local `tests/` folders for `StageIcon`, `StageItem`, and `StagesPanel`. They MUST cover explicit completed and failed statuses, unresolved live and non-live states, multiple simultaneous `status: null` stages, the `null` to `completed` transition, and unresolved repeated-stage groups.

#### Scenario: Test suite covers icon mapping
- **WHEN** the conversation-stages test suite runs
- **THEN** it asserts that a completed check appears only for `StageStatus.Completed` and that adding a later stage does not complete an earlier `status: null` stage

### Requirement: Complete stage arrays normalize parent references and identities

`toStage` SHALL preserve a supplied non-null parent reference, including zero, and retain its existing single-item index-zero fallback. `mapStages` SHALL assign the array position only to entries whose index is absent/null and preserve explicit indexes, parent references, names, statuses, content, tags and attachments. It SHALL continue accepting raw arrays, `custom_content.stages`, and the existing `customContent.stages` fallback, returning `undefined` for empty input. This complete-array normalization SHALL NOT be applied to partial SSE deltas. It SHALL be pure and introduce no state or host-specific dependencies.

#### Scenario: Unindexed non-streaming snapshot
- **WHEN** an array contains `[{ name: "Plan" }, { name: "Search", parent_stage_index: 0 }, { name: "Read", parent_stage_index: 1 }]`
- **THEN** normalization supplies indexes 0, 1 and 2, keeps parents 0 and 1, and the renderer shows a three-level hierarchy

#### Scenario: Explicit identities differ from array positions
- **WHEN** the snapshot contains stages with indexes 4 and 9, with stage 9 referencing parent 4
- **THEN** normalization retains indexes 4 and 9 and resolves the parent by index rather than offset

#### Scenario: Nullish parent metadata denotes no relation
- **WHEN** raw input omits `parent_stage_index` or carries a nullish value
- **THEN** the normalized stage omits the parent field and renders as a root

### Requirement: Invalid parent links degrade to roots

A usable parent reference SHALL be a nonnegative integer resolving to another stage in the same message with an index smaller than the child's index. Unknown, self, forward, fractional, negative or otherwise malformed references SHALL render the affected stage at the root without dropping its output or blocking the rest of the message. Relationships SHALL NOT be inferred from labels, tags, statuses or another message. Tree construction SHALL preserve the flat source data and take O(n) time and auxiliary space.

#### Scenario: Unknown parent
- **WHEN** stage 3 references missing parent 1
- **THEN** stage 3 is rendered as a root with its content and attachments accessible

#### Scenario: Cyclic or malformed metadata
- **WHEN** input contains a self-reference, a two-stage cycle, or an invalid numeric parent value
- **THEN** unusable edges become roots, rendering terminates, and every stage remains accessible once

#### Scenario: A partial snapshot later gains its valid parent
- **WHEN** parent 0 is initially missing for child 2, then the next complete stage array includes parent 0
- **THEN** derived rendering places child 2 under parent 0 without modifying its stored parent reference

### Requirement: Repeated attempts group within one sibling list

The consecutive cleaned-name `×N` rule SHALL apply independently to root nodes and to each parent's child list. An attempt SHALL retain its own descendants and body. Group counts SHALL count the attempts in that sibling run only. Repeated-attempt status rules SHALL retain their existing meaning over those attempts.

#### Scenario: Equal names under different parents
- **WHEN** child 1 of parent 0 and child 3 of parent 2 have the same name
- **THEN** they remain separate children and do not share a `×2` group

#### Scenario: Consecutive sibling attempts
- **WHEN** two children of parent 0 have the same cleaned name, followed by a differently named child
- **THEN** the first two form a `×2` group under parent 0 and the third remains separate

#### Scenario: Repeated parents retain distinct subtrees
- **WHEN** roots 0 and 2 have the same name and each has a child in the interleaved flat array
- **THEN** the root attempt group contains two attempts, each revealing only its own child subtree

### Requirement: Nested disclosures keep local state and message-wide summaries

Stage and retry expansion SHALL be local to the panel/component subtree and keyed by stable stage identity, without a new context or persisted expansion metadata. Stage and retry disclosures SHALL initially be collapsed; the outer `CollapsedGroup` SHALL retain its streaming-open and finish-collapse policy. Updates to names/content/status and insertion of siblings SHALL preserve expansion choices for surviving stages, including when a second attempt introduces a group. Message-wide step/failure counts and live-stage selection SHALL operate over the flat input once.

#### Scenario: Streaming updates do not close a stage
- **GIVEN** a user expanded stage 1
- **WHEN** its content grows, a sibling appears, or its name/status changes
- **THEN** stage 1 remains expanded

#### Scenario: A second attempt creates a group
- **GIVEN** the first attempt's body was expanded
- **WHEN** another sibling with the same cleaned name arrives and forms `×2`
- **THEN** expanding the new retry group retains the first attempt's previous body expansion choice

#### Scenario: Summary includes children once
- **WHEN** a finished run has one completed parent and two children, one failed
- **THEN** the summary reports three steps and one failed stage, independent of disclosure state

### Requirement: Nested stage interaction is accessible, responsive and localized

Nested stages SHALL use semantic lists and independently operable disclosure buttons with accessible names, `aria-expanded`, and associated regions. Enter/Space SHALL toggle the focused control; collapsing an ancestor SHALL prevent keyboard focus entering hidden descendants using `inert` or unmounting. Existing polite message/progress announcements SHALL remain, without multiplying live regions per nesting level. The app SHALL provide localized existing label slots using `conversation.stages.running`, `.failed`, `.failedCount`, `.attempt`, `.copyContent`, and `.previewAttachment`, plus the existing `.executed` and `.step` keys. Libraries SHALL receive strings/functions as props and remain independent of i18n.

Nested layout SHALL use logical inline properties, inherit `dir`, and mirror only directional icons. Additional cumulative indentation SHALL stop after the third nesting level without hiding deeper nodes. At 360px, headers, bodies and attachment controls SHALL remain usable without page-level horizontal overflow, with mobile touch targets at least 44 by 44 CSS pixels. The same controls SHALL remain available at 900, 1280 and 1920px using the repository's named breakpoints. Existing styles/typography SHALL reach every level.

This capability SHALL have no additional feature/role gate, network request, persistence cache, telemetry event or metric. Memoized derivation SHALL refresh when the stage-array reference changes; no TTL applies.

#### Scenario: Keyboard collapse removes descendants from navigation
- **GIVEN** a parent with an interactive child and attachment is expanded
- **WHEN** the user collapses the parent with its keyboard-operated trigger
- **THEN** focus remains on that trigger, it reports collapsed, and Tab does not enter hidden descendants

#### Scenario: Arabic direction with deep nesting
- **WHEN** a hierarchy deeper than three levels is expanded under `dir="rtl"` at mobile width
- **THEN** indentation starts on the right, directional chevrons mirror, extra indentation is capped, and every descendant remains reachable

#### Scenario: Host labels and callbacks reach a grandchild
- **WHEN** localized labels, theme overrides and an attachment callback are provided to the group
- **THEN** a grandchild uses those labels/styles and its attachment invokes the same host callback exactly once

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
