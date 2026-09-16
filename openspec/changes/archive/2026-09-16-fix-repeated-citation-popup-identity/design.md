## Context

See `proposal.md` for motivation. This document records what was verified in
code, what remains a hypothesis, and the technical choices that follow.

### Finding inventory

Each finding below is marked **Confirmed** (read directly in source) or
**Hypothesis** (consistent with the reproduction but not yet proven here).

**F1 — Confirmed. Repeated markers share one popup owner.**
`useCitationMarkdownComponents.tsx:102-106` builds a
`Map<tagId, AnnotationGroup>`; the `cit` override
(`:136-146`) looks a group up by `data-id` and calls the same `renderGroup`
(`:108-121`) for every occurrence. Every resulting `CitationDropdown` reads
`citationCard.isOpen(group.groupKey)`
(`CitationDropdown.tsx:56`), and `useCitationCard.ts:10-13` holds a single
`openGroupKey`. So N occurrences of one `data-id` yield N dropdowns that all
evaluate `isOpen` to `true` at once — exactly the two identical side-by-side
cards in the issue screenshot.

**F2 — Confirmed by code trace; not yet reproduced in a test. Preview/Download
are swallowed by a sibling tooltip's outside-press.**
`CitationDropdown` renders the ui-kit `Tooltip`, whose `TooltipContext` calls
`useDismiss(context)` with no options. `@floating-ui/react@0.27.19` defaults
`outsidePressEvent` to `'pointerdown'`, bubble phase, on `document`, and
`useDismiss` is **not** gated on the controlled-`open` prop the way `useHover`
and `useFocus` are. The two open cards are unrelated floating contexts (no
`FloatingTree`), so a `pointerdown` inside card A is "outside" for card B →
B calls `onOpenChange(false)` → `handleOpenChange`
(`CitationDropdown.tsx:59-64`) calls the **shared** `citationCard.closePopup()`
→ `openGroupKey` becomes `null` → both cards unmount. The footer buttons are
plain `PrimaryButton`s with only `onClick` (`CitationCard.tsx:228-238`), so the
button is gone before `click` dispatches and the handler never runs. This is a
pointer-event ordering race, not a handler defect. **It must be confirmed by a
failing test before the fix lands** (task 1.2).

**F3 — Confirmed. The same class of collision exists for reference chips.**
`ConversationMessageItem.tsx:653` renders `CitationDropdown` for reference
chips inside the *same* `CitationCardProvider` as the inline markers. Those
groups come from `groupAnnotationsBySource`, so `groupKey === sourceUrl`; a
reference chip and an offset-based inline group citing one file collide on
`openGroupKey` too. Occurrence-scoped ownership fixes this without a second
code path.

**F4 — Confirmed non-issue. React keys are not the defect.**
`renderGroup` passes `key={`citation-${group.groupKey}`}`. In the `cit` path
the returned element is the lone child of the `cit` component instance, so
React reconciles by position and the key is redundant, not colliding. In the
sentinel path each group is injected exactly once
(`citation-injection.ts:26-42`), so two sentinels for one group cannot occur.
There is no duplicate-key bug to fix, and — as the issue brief states —
changing keys would not fix shared open state. Do not "fix" this.

**F5 — Confirmed. DOCX highlight positions are structural, never text-searched.**
`DocxRangeSelector` (`libs/chat-shared/src/models/annotation.ts:42-60`) carries
`story` + `path: number[]` + `start`/`end`. `resolveDocxRects`
(`libs/attachment-canvas/src/utils/ooxml-highlight-geometry.ts:550-580`) matches
`run.source.path` element-wise via `isSameNumberPath`, and the selector's `text`
is used only as a bail-out guard (`:494` — mismatch produces **zero**
rectangles). A repeated passage therefore *cannot* fan a single annotation out
to a second location by text matching. The issue title's "duplicate highlights"
cannot be caused this way.

**F6 — Confirmed defect, Hypothesis as cause of this issue. Highlight ids can
collide.** `annotationHighlightId` (`libs/quotations/src/utils/annotation.ts:152-155`)
returns `String(annotation.index ?? fallbackIndex)`, mixing a wire-supplied
`index` with an array position.
`annotationToOoxmlCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts:564-582`)
mints ids over `gatherSameSourceAnnotations`, which is a plain `filter` with no
dedup. Two entries collide when one carries `index: 1` and another has no
`index` at position 1, or when the wire repeats an `index`. On collision,
`OoxmlContent.tsx:563` marks **every** rect of **both** highlights
`data-selected` (two emphasised bands in different places), while the
navigation effect (`:471-474`) takes only the *first* `find` match, so the
scroll goes to one and the other is a stray selection. That the #8822 payload
actually collides is **unverified** — it requires the captured DOCX response
(task 4.1).

**F7 — Confirmed, pre-existing, out of scope. Touch-only devices render no
card at all.** The ui-kit `TooltipContent` returns `null` when `useHasHover()`
is false. Citation cards therefore do not appear on touch-only devices
regardless of this change. Per `.claude/rules/a11y.md`, a gap inside an
installed package is noted, not patched here.

**F8 — Confirmed. A stale comment.** `CitationDropdown.tsx:77-82` claims the
component "stays on the 1.0 tooltip" because it needs `bottom-end`. The
resolved `Tooltip` export in ui-kit 0.14.2 is the **2.0** component (1.0 is
`DialTooltip`), and the component passes no `placement` at all. The comment is
in a file this change edits, so it gets corrected here.

**F9 — Confirmed constraint. Reference identity is load-bearing.**
`annotationToOoxmlCanvasContent` selects the clicked highlight with
`entry === annotation`; `annotationToPdfCanvasContent` resolves its group with
`groups.find(g => g.annotations.includes(annotation))` and
`allAnnotations.indexOf(annotation)`. Any per-occurrence construct must keep
the original `Annotation` objects and the original group's `annotations` array —
cloning either silently breaks DOCX/PDF source-location selection.

## Goals / Non-Goals

**Goals:**

- Activating a marker opens exactly one card, anchored to that occurrence.
- Activating another occurrence transfers the card to it.
- Preview and Download each invoke the host callback exactly once, with the
  annotation the card currently displays.
- A dismissal originating from an inactive or previously active occurrence
  cannot close the newly opened card.
- Popup ownership survives ordinary rerenders, and the existing protection
  against remounting markdown subtrees on popup interaction is preserved.
- Regression tests that actually reproduce the issue before the fix.

**Non-Goals:**

- Removing, merging, or deduplicating citations. Repeated markers stay visible;
  distinct annotations that happen to share quote text or a source URL stay
  distinct.
- Dropping same-source background highlights from the document overlay.
- Any change to DOCX/PPTX/XLSX location resolution, scroll targeting, zoom, or
  resize handling.
- Moving host URL resolution or preview/download integration into
  `libs/quotations`.
- Making citation cards work on touch-only devices (F7).
- Restyling the card or marker.

## Decisions

### D1 — Occurrence-scoped popup owner, not a single shared anchored popup

**Chosen:** each rendered `CitationDropdown` instance derives its own stable
owner key and uses it for open state. The group keeps owning card *content*.

The issue brief asked for these two to be compared:

| | Occurrence-scoped owner (chosen) | One shared popup anchored to the active marker |
|---|---|---|
| Blast radius | `useCitationCard`, `CitationDropdown`; render sites unchanged | Lift the `Tooltip` out of `CitationDropdown` into a message-level portal; add ref registration per marker; rework both render sites |
| Anchoring | floating-ui anchors each card to its own trigger, unchanged | Needs manual anchor-ref plumbing and re-anchoring on transfer |
| Fixes F3 (reference chips) | Yes, same mechanism | Yes, but needs the chip site reworked too |
| Public API change | `closePopup` signature | `CitationDropdown` loses its popup; hosts rendering it directly break |
| Sibling outside-press race (F2) | Eliminated — only one card is ever mounted | Also eliminated |

The shared-popup design is the larger change for the same outcome, and it
breaks the direct-render contract `ConversationMessageItem.tsx:653` and the
README both rely on. Occurrence scoping is the smallest robust change.

### D2 — Owner identity comes from React `useId()`, inside `CitationDropdown`

**Chosen:** `const ownerKey = useId()` in `CitationDropdown`.

Rationale and alternatives:

- **A positional ordinal passed from the render site** cannot work for the
  `cit` family: the `cit` component override receives only `data-id`
  (`useCitationMarkdownComponents.tsx:137`) — react-markdown supplies no
  occurrence index.
- **A mutable counter inside the `useMemo`** is non-deterministic: the memo is
  not re-run per render, and StrictMode's double invocation would assign
  different ids to the same occurrence.
- **A caller-supplied `ownerKey` prop** pushes occurrence bookkeeping onto every
  host, including the reference-chip site, for no gain.
- `useId` is React's own per-instance stable identity primitive: stable across
  rerenders and across StrictMode's double render, distinct per instance,
  requires no positional information, and needs no new prop — so hosts
  rendering `CitationDropdown` directly are unaffected.

Stability depends on the instance not remounting. That is already guaranteed by
the existing `quotations-citation-markdown` memo-identity requirement:
`markdownComponents` depends only on `groups`, the three callbacks, and
`isCompactTypography` — never on popup state. This change must not add a
dependency to that memo. If the subtree *does* remount (e.g. the
streaming → finished transition), the popup closes, which is correct: no card
is open at that point.

### D3 — `closePopup` becomes owner-scoped

`closePopup(ownerKey)` clears state only when `ownerKey` is the current owner.

This is what makes "a dismissal from a stale occurrence cannot close the new
card" true **by construction** rather than by event ordering. It matters even
after D1: when occurrence A is open and the user presses occurrence B's marker,
A's `useDismiss` fires on `pointerdown` (before B's `click` opens). Today's
ordering happens to work, but an unguarded shared `closePopup` means any
reordering — a `click`-based dismissal, a synthetic event in a test, the
`IntersectionObserver` auto-close path both tooltip generations install — closes
the wrong card. A guard makes the invariant independent of event order.

`CitationDropdown.handlePreview` closes with its own owner key for the same
reason.

**Alternative considered:** guard only inside `CitationDropdown`
(`if (!nextOpen && isOpen) closePopup()`). Rejected: it leaves the hook's
exported contract able to close someone else's card, and the hook is public API.

### D4 — The switcher index stays keyed by `groupKey`

`activeIndexByGroup` continues to key on `group.groupKey`, so the hook
deliberately carries two key spaces: openness is per occurrence, switcher
position is per group. This is an honest split — the index indexes into
`group.annotations`, which is group data — and it preserves the existing
`citation-card` requirement and the app-level reload test that navigates with
Next before previewing.

**Consequence, accepted:** if the user advances the switcher on occurrence A,
closes it, and opens occurrence B of the same group, B opens at A's index.
Only one card is open at a time, both show the same annotation list, and no
requirement in the issue calls for a per-occurrence index. Re-keying the index
per occurrence is the alternative; it is a larger change with no user-visible
benefit identified, so it is recorded here rather than implemented.

### D5 — Collision-free highlight ids are evidence-gated and separately justified

The issue brief requires that a change to document-highlight semantics be
documented separately and justified from the reproduction. F6 is a real code
defect, but whether it is *this* issue's second symptom is unverified.

Therefore: task 4.1 inspects the #8822 DOCX payload first.

- **If ids collide**, make ids unique within the gathered same-source list
  (keeping `annotation.index` as the id whenever it is unambiguous, so ids stay
  stable and comparable with `annotationsToPdfHighlights`, as the existing
  `office-annotation-highlighting` requirement demands), so at most one
  highlight can ever be selected.
- **If they do not**, skip the code change, keep the delta spec requirement that
  forbids a collision (it is a correct invariant regardless), and record the
  finding in the change.

Either way, `gatherSameSourceAnnotations` keeps returning all same-source
annotations, background highlights keep rendering, and the selected target keeps
its two-channel distinction (`OoxmlContent.module.scss`: border weight +
opacity). Nothing is removed to fix duplicate cards.

**Not a defect, documented for the implementer:** one annotation carrying an
*array* of selectors legitimately resolves to several locations under one id,
all emphasised, with navigation targeting `locations.at(0)`. That is the
existing, tested contract for a passage that spans pieces — leave it alone.

## Risks / Trade-offs

- **F2 is a code trace, not an observation** → Write the failing test first
  (task 1.2). If the mechanism turns out to be different, the fix for F1 stands
  on its own and the investigation is re-scoped rather than the diagnosis
  assumed.
- **`useId` stability regresses if someone later adds popup state to the
  `markdownComponents` memo** → Keep the existing memo-identity test, and add a
  test that opens a card, forces a rerender, and asserts it is still open
  (task 2.4).
- **`closePopup`'s new required argument breaks external callers** →
  `CitationCardHook` is exported from `libs/quotations`. The only in-repo caller
  is `CitationDropdown`. It is a breaking type change on a `0.x` lib, so it
  ships as such, is flagged in the proposal, and is reflected in the README in
  the same change.
- **A per-occurrence construct could clone groups or annotations** → F9. The
  design puts the owner key inside `CitationDropdown` precisely so no group or
  annotation object is ever rebuilt. Task 3.2 asserts the annotation passed to
  `onPreview` is reference-identical to the one in `citationGroups`.
- **Two key spaces in one hook invite mis-keyed call sites** → D4's split is
  documented in the hook's JSDoc, the README, and the delta spec, and the
  parameter names say which space they belong to.
- **Changing highlight id minting could disturb the PDF path** → D5 keeps
  `annotation.index` as the id wherever it is unambiguous and the change is
  gated on evidence. `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts`
  and the PDF-side suites run as the guard.

## Migration Plan

Not applicable — no persisted data, no API contract, no stored state. The
change is a frontend behaviour fix, revertible by reverting the commit.

## Open Questions

1. **Does the #8822 payload actually mint colliding highlight ids?** Resolved
   by task 4.1 against the issue's DOCX reproduction. Gates D5.
2. **Does DIAL Core repeat one `cit` id across sentences, or emit distinct ids
   whose annotations share a quote?** F1 reproduces only on a repeated id. The
   spec covers both shapes, and tasks 3.3–3.4 pin the distinct-id case as a
   non-regression, so the fix is correct either way — but the payload should be
   recorded in the PR so the reproduction is not guessed at later.
3. **Should the switcher index be per occurrence?** D4 says no for now. Revisit
   only if a user-visible requirement appears.
