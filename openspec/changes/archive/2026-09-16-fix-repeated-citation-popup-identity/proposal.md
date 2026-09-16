## Why

When one assistant message repeats the same `<cit data-id="X"></cit>` marker
more than once, clicking a single marker opens **every** occurrence's card at
the same time, and the cards' Preview/Download buttons stop responding
([issue #8822](https://github.com/epam/ai-dial-chat/issues/8822)). The
reproduction in the issue is a DOCX whose cited passage appears identically for
several individuals, with a prompt that explicitly asks the model for one
citation per sentence — so the model emits the same citation id repeatedly.

The root cause is that popup ownership is keyed on *citation data identity*
(`AnnotationGroup.groupKey`) while the user is interacting with a *rendered
marker occurrence*. Two occurrences of one citation are two buttons and must
be two independent popup owners, even though they show the same annotation.

## What Changes

**Popup ownership is separated from citation data identity.**

- `CitationDropdown` acquires a stable per-instance occurrence identity (React
  `useId()`) and uses it as the popup owner key, instead of
  `group.groupKey`. Two rendered occurrences of one group therefore never
  share open state. The group continues to own the card's *content*
  (annotations, source, switcher).
- `useCitationCard` state is re-keyed: `openGroupKey` becomes an owner key, and
  `closePopup` becomes **owner-scoped** — `closePopup(ownerKey)` clears the
  popup only when `ownerKey` currently owns it. A dismissal arriving from an
  inactive or previously active occurrence can no longer close the card the
  user just opened. **BREAKING** for the exported `CitationCardHook` type:
  `closePopup` gains a required argument.
- `activeIndexByGroup` stays keyed by `groupKey`. The switcher index indexes
  into `group.annotations`, which is group data, and only one occurrence is
  ever open — recorded as a deliberate assumption in `design.md`.
- No change to `AnnotationGroup`, to grouping, or to the annotation objects
  themselves. Annotation and group object references must stay intact, because
  `annotationToOoxmlCanvasContent` and `annotationToPdfCanvasContent` identify
  the clicked annotation by reference identity.

**Document-highlight identity is made collision-free (evidence-gated, see
below).**

- `annotationHighlightId(entry, i)` returns `String(entry.index ?? i)`, mixing
  wire-supplied `index` with array position. Two same-source annotations can
  therefore mint the *same* id, which makes `OoxmlContent` mark every rect of
  both highlights `data-selected` at two different places in the document while
  scrolling to only the first. Highlight ids become unique within the gathered
  list.
- This item ships **only if** the issue's DOCX reproduction shows colliding
  ids. It is scoped and justified separately in `design.md`, because it changes
  highlight identity rather than popup behaviour.

**Explicitly not changing:**

- Legitimate repeated markers stay visible. No citation is removed and no two
  distinct annotations are merged because their quote text or source URL match.
- Same-source background highlights continue to be collected. The selected
  target stays distinguished from them on two visual channels.
- DOCX source-location selection, scroll, zoom, and resize behaviour, including
  the deliberate decoupling of navigation from geometry recomputation.
- Host URL resolution and preview/download integration stay in `apps/chat` and
  `libs/chat-hooks`; nothing about them moves into `libs/quotations`.

## Capabilities

### New Capabilities

None. This change modifies the behaviour of existing capabilities only.

### Modified Capabilities

- `citation-card`: popup open state is keyed by rendered-occurrence identity
  rather than `AnnotationGroup.groupKey`; `closePopup` becomes owner-scoped so
  a stale occurrence cannot dismiss the active card.
- `quotations-citation-markdown`: repeated markers resolving to one group each
  render an independently owned popup; exactly one card is open at a time and
  its action callbacks fire once with the annotation that card displays.
- `citation-marker`: a repeated `<cit data-id="X"></cit>` renders a marker at
  every occurrence, and activating one transfers the card to it.
- `office-annotation-highlighting`: highlight ids are unique within the gathered
  same-source list, so exactly one highlight can be selected (evidence-gated —
  see `design.md`).

## Impact

**Confirmed by code reading** (file paths and the verification status of each
finding are itemised in `design.md`):

- `libs/quotations/src/utils/useCitationCard.ts` — state shape and the
  `closePopup` signature.
- `libs/quotations/src/context/CitationCardContext.tsx` — the exported
  `CitationCardHook` type changes shape.
- `libs/quotations/src/components/CitationDropdown/CitationDropdown.tsx` —
  occurrence identity, dismissal guard, and a stale code comment claiming it
  uses the 1.0 tooltip for `bottom-end` placement (the resolved import is the
  2.0 `Tooltip` and no `placement` is passed).
- `libs/quotations/src/hooks/useCitationMarkdownComponents/useCitationMarkdownComponents.tsx`
  — must keep its memo identity so occurrence ids survive rerenders.
- `libs/quotations/README.md` — documents `useCitationCard`; `closePopup`'s new
  signature must be updated in the same change (`npm run validate:docs`).
- `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` — the
  only production `useCitationCard` consumer; also renders `CitationDropdown`
  directly for reference chips inside the same provider, which the same fix
  covers.
- `libs/chat-hooks/src/files/attachment-canvas.ts` and
  `libs/quotations/src/utils/annotation.ts` — highlight id minting, for the
  evidence-gated second item only.

**Not impacted:** no API, DTO, backend, dependency, environment variable, or
feature flag changes. `apps/chat-api` is untouched.

**Test debt this change closes:** no existing test anywhere renders the same
`data-id` twice, asserts how many cards are open simultaneously, or asserts a
preview/download callback fires exactly once. The nearest existing cases use
*distinct* ids, which is precisely the scenario that already works.
