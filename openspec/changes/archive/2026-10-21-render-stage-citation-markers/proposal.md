## Why

Agents that retrieve sources inside a stage (Deep Research's clarification/plan step, Web RAG,
file RAG tool-result stages) write `<cit data-id="…"></cit>` markers into
`custom_content.stages[*].content`, but the chat renders those markers as the literal text
`<cit data-id="…"></cit>` instead of a citation pill, because
`libs/conversation-stages/src/components/StageMarkdownContent/StageMarkdownContent.tsx` uses the
plain `MarkdownRenderer`, whose default `cit` override serializes the element back to text
(`defaultMarkdownComponents` in `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`).
Issue #9257.

## Problem

- A stage marker never becomes a pill, card or preview; the user sees raw markup.
- The annotations those markers refer to already reach the client: the producing application
  sends them on the **message** (`delta.custom_content.annotations`), never on a stage. This is
  the documented contract of statgpt-backend (`statgpt/app/utils/dial_annotations.py`:
  *"Annotations belong to a message, so they are always sent to a choice and never to a stage"*;
  `OpenAiToDialStreamer._process_annotations` relays to the choice even when the content target
  is a stage, and `_process_stage` does not forward any stage-level `annotations`).
- So the only gap is on the rendering side: stage content is never given a `cit` renderer that
  can resolve against the message's annotation groups.

## Solution

Resolve stage markers against the message-level annotations (issue's **Option B**):

- `@epam/ai-dial-quotations` exposes a host-agnostic way to get **only** the `cit`-element
  renderer (no `p`/`li` overrides, no offset sentinels) plus the same content preparation the
  message body uses (hide complete markers while streaming, escape unsupported `cit` shapes).
- `@epam/ai-dial-conversation-stages` accepts an optional, typed `renderCitation` callback on
  `CollapsedGroup` / `StagesPanel`, threads it down to `StageMarkdownContent`, and uses it as the
  `cit` component override. Without the callback the current literal-text behavior is kept.
- `apps/chat` (`ConversationMessageItem`) builds that callback from the message's own
  `citationGroups` with `fallbackCitationGroups` (the conversation pool), the same
  `citationCallbacks` the body uses, and prepares each stage's `content` before passing the
  stages down. Stage pills share the message's `CitationCardProvider`, so one card is open at a
  time across body and stages.

### Alternatives considered

| Option | Verdict |
| --- | --- |
| **A — `annotations` field on each stage** (`StageDto`, OpenAPI client, `RawStage`/`Stage`/`toStage`, both `mergeStages`) | Rejected: no producer sends it — statgpt-backend explicitly routes annotations to the message and drops stage-level ones — so it would add contract surface for data that never arrives. Can be added later, additively, if DIAL Core defines stage annotations. |
| **B — reuse message-level annotations** (chosen) | Matches the producer contract; no backend, OpenAPI or stream-merge change. The issue's downside ("message groups include stage-only citations") already holds today, because those annotations already arrive on the message; this change only makes them visible where they are cited. |
| Pass the message's whole `markdownComponents` map into stages | Rejected: its `p`/`li` overrides replace stage typography with message-body classes and inject offset sentinels computed against the **message** text. |
| Lib imports `@epam/ai-dial-quotations` directly | Rejected: violates library isolation and the issue's acceptance criterion 4. |

## Non-goals

- No stage-level annotation contract (Option A), no change to `StageDto`, `RawStage`, `Stage`,
  `toStage`, `mergeStages` (client or server) or the generated OpenAPI client.
- No offset-based (`text_character_range`, `pdf_bbox`, …) citation injection into stage text —
  only `<cit data-id>` elements; offset selectors refer to positions in the message text.
- No change to sources/citation lists outside the stages (sources panel, references).
- No pills inside stage content while the message is still streaming (parity with the body).

## What Changes

- `libs/quotations`: new exported cit-only renderer hook and a content-preparation helper;
  `useCitationMarkdownComponents` reuses the same cit rendering internally (no behavior change).
- `libs/conversation-stages`: new optional `renderCitation` prop on `CollapsedGroupProps` and
  `StagesPanelProps`, threaded through `StageList` → `StageItem` → `StageMarkdownContent`.
- `apps/chat`: `ConversationMessageItem` wires the renderer and prepared stage content into
  `CollapsedGroup`.
- READMEs of both libs and the `stage-visualization` / `quotations-citation-markdown` specs.
- Not breaking: all new props are optional and default to today's behavior.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `stage-visualization`: stage content renders `<cit data-id>` markers through an optional
  host-supplied renderer; the host wires it from the message's annotation groups.
- `quotations-citation-markdown`: the package exposes a cit-only renderer and the shared content
  preparation, for markdown surfaces other than the message body.

## Impact

- Code: `libs/quotations/src/hooks/`, `libs/quotations/src/utils/citation-injection.ts`,
  `libs/quotations/src/index.ts`; `libs/conversation-stages/src/models/stages-props.ts`,
  `libs/conversation-stages/src/models/collapsed-group.ts`, `CollapsedGroup`, `StagesPanel`,
  `StageList`, `StageItem`, `StageMarkdownContent`;
  `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`.
- Library isolation: `conversation-stages` gains only a typed callback
  (`(dataId, children) => ReactNode`); annotation lookup, i18n labels, preview/canvas and
  open-in-browser stay in `apps/chat`. No new package dependency for either lib.
- i18n: no new strings — markers reuse `buildCitationLabels` (`citations.*`, `buttons.*` keys).
- Backend / API: none. The temporary `[#9257]` debug logging added to `apps/chat-api` during the
  investigation is not part of this change and must not be merged.
- Rollback: revert the commit; with the prop absent, stages fall back to literal-text markers.

## Acceptance criteria

1. A `<cit data-id="x"></cit>` in a finished message's stage content renders the same pill,
   card, preview and open-in-browser behavior as in the message body, when `x` is claimed by the
   message's annotations or by the conversation annotation pool.
2. While the message streams, complete stage markers are hidden and partial/unsupported `cit`
   markup is shown as literal text — identical to the body; pills appear once streaming ends.
3. An id no annotation claims renders as literal `<cit data-id="x"></cit>`, as in the body.
4. `libs/conversation-stages` has no import of `@epam/ai-dial-quotations`; without
   `renderCitation` it renders exactly as today.
5. Stage typography (`StageTypography`) is unchanged for cited and uncited stage text.
