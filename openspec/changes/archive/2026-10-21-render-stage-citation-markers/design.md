## Context

How a `<cit data-id>` marker renders today:

- **Message body.** `ConversationMessageItem`
  (`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`) calls
  `useAnnotations(msg, isStreaming)` → `groupAnnotations` → `citationGroups`, plus
  `fallbackCitationGroups` from the conversation pool
  (`apps/chat/src/hooks/conversation/useConversationAnnotationPool.ts`), and passes both with
  `citationCallbacks` to `useCitationMarkdownComponents`
  (`libs/quotations/src/hooks/useCitationMarkdownComponents/useCitationMarkdownComponents.tsx`).
  That hook returns `processedContent` (sentinels + `escapeUnsupportedCitTags`, or
  `stripCitTagsWhileStreaming` while streaming) and a `Components` map with `cit`, `p` and `li`.
- **Stages.** The same item renders `<CollapsedGroup stages isStreaming labels
  onAttachmentClick attachmentDisplayResolvers />` inside the same `CitationCardProvider`.
  `CollapsedGroup` → `StagesPanel` → `StageList` → `StageItem` → `StageMarkdownContent`, which
  renders `MarkdownRenderer` with stage `classNames` and a `code` override only. The default `cit`
  override (`defaultMarkdownComponents` in
  `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`) prints the element back
  as literal text.
- **Producer contract (statgpt-backend).** Annotations are always sent on the choice as
  `delta.custom_content.annotations` with `html_tag` selectors; content carrying markers may be
  appended to a stage (Deep Research clarification/plan, Web RAG, debug stages); stage-level
  `annotations` are not relayed. Annotations may arrive before or after the text, and are
  expected to resolve only after the message finishes streaming.

So the data is already on the message; only the stage renderer lacks a `cit` override.

The closest existing pattern is `attachmentDisplayResolvers` (#9512): an optional host-owned
value on `CollapsedGroupProps`/`StagesPanelProps`, forwarded unchanged through `StageList` to
every `StageItem`, including nested children.

## Goals / Non-Goals

**Goals:**

- Stage `<cit data-id>` elements render as the same `CitationDropdown` the body renders,
  resolved from the message's `citationGroups` then `fallbackCitationGroups`.
- Same streaming and fallback semantics as the body.
- `libs/conversation-stages` stays free of quotations, i18n and canvas knowledge.

**Non-Goals:**

- Stage-level annotations in any DTO or model (Option A).
- Offset-based citation injection into stage text.
- Restyling markers for stages (see Open Questions).

## Decisions

### D1 — Resolve stage markers against message-level annotations (Option B)

Producers put the annotations on the message, so message groups + the conversation pool are the
complete set. No backend, OpenAPI or stream-merge change. Option A is additive and can follow if
DIAL Core ever defines stage annotations; nothing here blocks it.

### D2 — The lib takes a narrow `renderCitation` callback, not a `Components` map

`libs/conversation-stages` adds:

```ts
/** Renders a `<cit data-id="…">` element found in stage content. */
export type StageCitationRenderer = (
  dataId: string | undefined,
  children: ReactNode,
) => ReactNode;
```

as optional `renderCitation` on `StagesPanelProps` and `CollapsedGroupProps`, forwarded by
`CollapsedGroup` → `StagesPanel` → `StageList` → `StageItem` → `StageMarkdownContent`, exactly
like `attachmentDisplayResolvers`. `StageMarkdownContent` adds a `cit` entry to its own
`components` map only when the callback is present: `cit: (props) =>
renderCitation(props['data-id'], props.children)`. Without it, `defaultMarkdownComponents` keeps
rendering literal text.

Alternatives: a `markdownComponents?: Components` prop would let a host override `p`/`li` and
break `StageTypography`, and would make `react-markdown` a direct dependency of the lib (it is
not one today — the lib depends on `@epam/ai-dial-chat-shared`, which owns the renderer). A
render-prop for the whole stage body is wider than needed.

Memoization: `StageMarkdownContent` builds its `components` map with `useMemo` keyed on
`renderCitation` and the typography/label inputs, so a stable callback does not re-create the map.

### D3 — Quotations exposes a cit-only renderer and a content-preparation helper

- `useCitationTagRenderer(groups, callbacks, fallbackGroups?)` returns a memoized
  `(dataId, children) => ReactNode`: looks `dataId` up via `buildCitGroupsByTagId(groups,
  fallbackGroups)` and renders the group's `CitationDropdown`, or the literal text for no match.
  Its return type is structurally a `StageCitationRenderer`, with no type import either way.
- `prepareCitationContent(content, isStreaming)` returns `stripCitTagsWhileStreaming(content)`
  while streaming, otherwise `escapeUnsupportedCitTags(content)` — the body's preparation minus
  sentinel injection.
- `useCitationMarkdownComponents` reuses the same internal group renderer, so body and stage
  pills cannot drift. Its public behavior and spec scenarios are unchanged.

Alternative: export `buildCitGroupsByTagId`/`escapeUnsupportedCitTags` and let the host rebuild
the dropdown — duplicates `CitationDropdown` wiring and labels in the app.

### D4 — The host prepares stage content and owns the callback

In `ConversationMessageItem`:

- `renderStageCitation = useCitationTagRenderer(citationGroups, citationCallbacks,
  fallbackCitationGroups)` — the same inputs the body uses, so preview, open-in-browser,
  `isPreviewOpen`, `previewFilesOnMarkerClick` and labels are identical.
- `displayStages = useMemo(() => prepareStageCitations(stages, isStreaming), [stages,
  isStreaming])`, a helper in `apps/chat/src/components/ConversationView/utils/` that maps each
  stage whose `content` contains `<cit` through `prepareCitationContent` and returns other stages
  by reference (keeps `StageItem` memo hits).
- `CollapsedGroup` receives `stages={displayStages}` and `renderCitation={renderStageCitation}`.

`useAnnotations` already returns `[]` while streaming, and prepared content has no complete
markers then, so pills appear on completion — the body's behavior.

## Risks / Trade-offs

- [Card clipped by the stage scroll box — `StageItem` wraps content in
  `max-h-[300px] overflow-y-auto`] → the card is a kit `Dropdown` overlay; verify in
  `StageItem.spec.tsx` that the overlay renders outside the scroll container (portal). If it does
  not, stop and raise it rather than changing the scroll container.
- [Same id cited in body and stage] → each `CitationDropdown` owns its key via `useId` in the
  shared `CitationCardContext`; one card opens at a time. Covered by a host test.
- [Callback identity changes when `isCanvasOpen` or groups change, re-parsing every expanded
  stage] → same cost profile as the body today; only expanded stages render markdown.
- [Content preparation runs per stage per chunk while streaming] → skipped for stages without
  `<cit`; identity preserved for them.
- [Stage-only citations already appear in message-level source lists] → existing behavior, not
  introduced here; recorded so it is not re-reported as a regression.

## Migration Plan

No data or API migration. All new props are optional. Rollback = revert; stages return to
literal-text markers.

## Open Questions

- Should markers in stages use a compact marker label to match `dial-tiny-text` stage text? The
  first iteration reuses the body marker unchanged; revisit after design review.
