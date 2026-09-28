## Context

Today's single-skill mechanism (`libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx`):

- Holds one `selectedSkillId: string | null`.
- Renders it as a `ChatSkill` element (`selectedSkillElement`) passed to `ConversationInput`/`EditMessageInput`'s `inlineStartSlot` prop.
- `inlineStartSlot` is **not** embedded inside the `<textarea>` — it cannot be; a native textarea only ever contains a plain string. `Input.tsx` renders `inlineStartSlot` as an absolutely-positioned sibling measured via `ResizeObserver`, and pads the textarea's text so it visually starts after the slot (`Input.tsx:138-279,663`). The typed message string itself never contains anything about the skill.
- On send, the host builds `custom_content.skills` from `selectedSkills` (`[{ url: selectedSkillId }]` or `undefined`) — a value derived entirely from hook state, never from the message text — and calls `removeSelectedSkill()` after a successful send (`ConversationRoute.tsx:381`, `ConversationView.tsx:679-688`).
- History rendering (`ConversationMessageItem.tsx`, `renderHistorySkills`) renders one `ChatSkill` per `custom_content.skills` entry, all together in the single `beforeContent` slot, positioned before the message bubble's first text line (`UserMessageBubble.tsx:151`, `AssistantMessageBubble.tsx:137-166` — the assistant bubble overlays it via `useInlineStartIndent` since its text is markdown-rendered).
- Four call sites wire the same hook output the same way: `NewConversationComposer.tsx` (new conversation), `ConversationView.tsx` (existing conversation, both the live composer and `EditMessageInput` for editing a historical message), and `AppsEditor/AppPreviewChat.tsx` (Quick Apps preview chat) — all pass `inlineStartSlot`/`onInlineStartRemove` straight through to `ConversationInput`/`EditMessageInput`.
- `useCommandMenu` (`libs/conversation-input/src/hooks/useCommandMenu/useCommandMenu.ts`) is the `/`-trigger state machine behind the Skills slash menu. It only opens over an **empty** textarea, and only for the shape `prefix + query` with no whitespace and no second prefix character (`isCommandValue`). A `dismiss()` call sets a latch (`isDismissed`) that is only cleared once the value **stops** matching that shape — which never happens while backspacing from `/sdf` down to `/`, since every intermediate value (`/sdf`, `/sd`, `/s`, `/`) is itself a valid command-value shape. That is the reported reopen bug.

This change has to reconcile two constraints that don't shift:

1. **The wire format cannot change.** `RequestSkill` is `{ url: string }` and DIAL Core's merged schema (Core PR #1956, cited in the base spec) validates exactly that shape in an array. No position/offset field can ride along. This is independently confirmed by the consuming agent side: `ai-dial-quickapps-backend` PR #574 (`docs/skill-invocation.md`, approved design, no code yet) designs QuickApps' skill-invocation feature against exactly this array-of-`{url}`-per-user-message shape, explicitly treats `content` as opaque (it never parses `/name` out of the text — the chip array is the only invocation signal it reads), and already anticipates more than one chip per message (`SKILL_INVOCATION_MAX_PER_MESSAGE`, default 5). Nothing in that doc requires a wire-contract change on the chat side.
2. **A native `<textarea>` cannot host an embedded interactive widget at an arbitrary offset.** `ConversationInput`/`EditMessageInput`/`Input` are built on a real `<textarea>` (not a contentEditable rich editor) for IME, native undo, mobile keyboard, and selection behavior that a rich editor would have to reimplement. Rewriting the editing surface to a contentEditable/rich-text model is out of scope for this change — it would touch attachment handling, paste conversion, voice input, and every existing `Input.tsx` test.

The design below works within both constraints.

## Decision 1 — Skill mentions are `/{name}` substrings in the plain message text

When a skill is selected (from the `/` command menu or the Skills add-menu), the composer inserts the literal text `` `/${name} ` `` at the caret (or, for the slash-menu path, replacing the just-typed `/query`), instead of clearing the query and rendering a chip outside the text. The message a user types and the message a host would print to a log both read `/{name}` at the point of insertion — the mention **is** the content, per the proposal.

`custom_content.skills` becomes `RequestSkill[]` with one entry per mention, **in left-to-right reading order** of the mentions in the final text. Order is the only disambiguator between two mentions that render the same `/{name}` label but resolve to different `url`s (two skills can share a display name).

## Decision 2 — Live mention tracking while composing (the authoritative source while editing)

While a message is being actively composed or edited, the ordered list of mentions is **not** re-derived from the text on every keystroke. It is tracked incrementally as a list of anchors, each an authoritative fact about the current draft:

```ts
/** A skill mention's location within the current plain-text draft. */
interface SkillMentionAnchor {
  /** The mentioned skill's resource URL — the value sent as this entry's `{ url }`. */
  url: string;
  /** Display name at the time of insertion (`/${name}` is what actually sits in the text). */
  name: string;
  /** Character offset of the leading `/` in the current draft string. */
  start: number;
  /** Length of the `/{name}` run, `1 + name.length`. */
  length: number;
}
```

A new hook, `useSkillMentions` (`libs/skills/src/hooks/useSkillMentions/useSkillMentions.ts`), owns an ordered `SkillMentionAnchor[]` plus the draft text, replacing `useSkillSelectorOverlay`'s single `selectedSkillId` state:

- **Insertion** (`insertMention(url, name, atIndex)`): splices `` `/${name} ` `` into the text at the caret, pushes a new anchor at the caret's position, and shifts every anchor whose `start` is `>= atIndex` by the inserted length. Called from the command-menu's `onSelect` (in place of today's `close({ consumeQuery: true }); selectSkill(item.id)`) and from the Skills add-menu's `onSelect` (in place of today's plain `selectSkill(item.id)`).
- **Reconciliation on every text change** (`onDraftChange(nextValue)`): computes the edited region via a common-prefix/common-suffix diff against the previous value (cheap, O(n), correct for the single-cursor edits a textarea actually produces — typing, deleting, pasting, cutting, undo/redo). Anchors entirely before the edited region are untouched; anchors entirely after are shifted by the length delta; an anchor that **overlaps** the edited region is dropped — the user edited into the middle of a mention, so it reverts to plain text and is no longer tracked (and no longer contributes a `custom_content.skills` entry). This is a generalization of today's implicit "the chip has no remove control of its own" rule: previously the *only* removal path was the input's `onInlineStartRemove` gesture; now any edit that lands inside a mention's character range removes just that mention, and the wholesale keyboard gesture below removes it in one keystroke instead of char-by-char.
- **Whole-mention Backspace** (`onBackspaceAtCaret(caretPosition)`): a **pure lookup**, not a mutator — it returns the anchor whose run ends exactly at `caretPosition` (immediately after a mention), or `undefined`. The hook itself never performs the deletion: mutating `draft`/`anchors` directly from React state would bypass the textarea's native editing pipeline and break native undo. Instead, `Input.tsx` (the caller) is responsible for: on a match, `preventDefault()` the browser's default single-character deletion, delete the whole `anchor.start..anchor.start+anchor.length` range through the same native-editing-pipeline technique already used elsewhere in `Input.tsx` for the single-skill remove gesture (so native undo still reverts it), and then report the resulting value through `onDraftChange` as usual — whose existing overlap-drop reconciliation removes the anchor, since the deleted range exactly equals it. This is the direct generalization of `onInlineStartRemove`, now keyed to whichever mention's boundary the caret sits at rather than always "position 0."
- **`orderedSkills`**: `anchors.map(a => ({ url: a.url }))`, memoized on the anchors array — the value sent as `custom_content.skills` (or `undefined` when empty, unchanged omission behavior).
- **Reset after send**: clears both the draft's mention anchors and (via the existing `onSend`/`removeSelectedSkill`-equivalent) is called by every composer host after a successful send, matching today's per-message-selection-clears semantics.

This keeps every character-range computation local to the current editing session; nothing about ranges is persisted or sent.

## Decision 3 — Live-composing render: highlighted text runs, not full chips

A native `<textarea>`'s text cannot be partially replaced by a React node without changing which characters are actually in the value (breaking the "mention is part of content" requirement) or losing native caret/selection/IME/undo behavior (breaking why this is a `<textarea>` at all). The chosen technique, scoped to `Input.tsx`:

- The `<textarea>` itself is unchanged in every respect except one CSS property: its text becomes transparent (`color: transparent`, `caret-color` kept at the normal color) so it still owns the caret, selection, and all native editing.
- A new non-interactive sibling (`pointer-events: none`), absolutely positioned and sized identically to the textarea (same font, line-height, padding, width — the same mirroring technique `Input.tsx` already uses for `inlineStartSlot`'s `ResizeObserver`-measured sizing), renders the **same text**, with each tracked anchor's `/{name}` run wrapped in a `<span>` carrying a mention-highlight style (background/text color drawn from the same palette `ChatSkill`'s chip uses, exposed as a small shared style token, `SKILL_MENTION_HIGHLIGHT_CLASS_NAME`, in `libs/chat-shared` — not `libs/skills`, since `libs/skills` depends on `libs/conversation-input` and a skills-owned token would create a cycle — so the two stay visually consistent) instead of a full `ChatSkill` component. Because the highlighted run keeps the exact same characters and font as the real text underneath it, no width mismatch is possible — this sidesteps the classic hard problem with textarea-mention-highlighting techniques (a full differently-sized chip widget cannot be pixel-aligned to arbitrary text underneath it; a same-text, same-font color overlay can).
- Consequence, stated explicitly: a mention has no hover tooltip and no "View details" while actively composing — a plain highlighted run is not a mounted `ChatSkill` component, so it cannot host `InteractiveTooltip`. This is disclosed as an accepted limitation of building on a native textarea rather than a rich editor. The full interactive `ChatSkill` chip (tooltip + "View details") is reserved for read-only contexts (Decision 5), where the text is real React markup, not a textarea's opaque string buffer.
- `EditMessageInput` reuses the exact same `Input.tsx` mechanism (it renders `Input` internally per today's `inlineStartSlot`/`onInlineStartRemove` forwarding), so nothing separate is needed for the edit surface's live-composing render.

### Decision 3a — `ChatSkill`'s composer trigger is a styled span, not a button

The live-composing mirror (above) ended up rendering the actual `ChatSkill` component for each mention (via a `render` callback passed down as part of `HighlightedTextRange`, so the composer stays hoverable/copyable/tooltip-bearing instead of a plain color run) rather than the bare highlighted span originally described. That upgrade constrains `ChatSkill`'s own markup:

- **Span, not `<button>`.** `Input.tsx` overlays `ChatSkill` directly on top of the real (invisible) textarea text it mirrors, so the element's own box must advance the line by exactly the width of its plain `/{name}` text. A `<button>`'s own border/box model, or any real padding, makes the chip wider than the invisible text underneath it, throwing off where the native caret and selection visually land. The trigger is a plain, focusable, selectable text `<span tabIndex={0}>` — keyboard-focusable and tooltip-triggering without being a `<button>`.
- **Net-zero-width padding.** `ps-1 pe-1` plus the equal, opposite `-ms-1 -me-1` gives the painted background a small horizontal inset while the padding and the negative margin cancel out in the inline layout, for zero net extra width.
- **4px inset, not the design's 8px.** The inset paints *outside* the element's own box, into whatever sits next to it in the message text; a mention is never surrounded by more than a single space character, so a wider inset visibly bleeds onto the neighboring word instead of just the space. 8px was tried together with widening the mirror container itself (`inset-inline`/`padding-inline`) to make room for the bleed without clipping, but that widening shifted `HTMLElement.offsetLeft`/`offsetTop` readings the command-menu popup anchor depends on (both are measured from the offsetParent's *padding* edge), reintroducing caret/popup positioning bugs. 4px is the accepted, smaller-than-spec fallback until a fix that doesn't disturb offset-based measurements is found.
- **Mirror and textarea both carry `ps-1 pe-1`, and their shared ancestor bleeds by the same amount.** A mention at the very start (or end) of a line has no preceding (or following) character for its negative-margin bleed to land on, so the bleed reached the mirror box's own edge and got clipped by an ancestor's `overflow-hidden` outside this lib (a host layout container in `Input.tsx`'s case, or `UserMessageBubble`'s collapsible-text clamp in the history rendering). Reserving 4px of real padding on the mirror and the real `<textarea>` gives the bleed room to land inside the box. This is safe now, unlike the abandoned 8px attempt above: Decision 3b already moved the caret-marker and popup-anchor measurements off `offsetLeft`/`offsetTop` onto `getBoundingClientRect()` diffs against `textareaAreaRef`, so matched padding on both overlaid elements changes nothing about that measurement's correctness. Adding real padding shrinks the usable width inside that box by 8px and shifts its content 4px in, though, so their common ancestor (`textareaAreaRef` in `Input.tsx`; the collapsible-text div itself in `UserMessageBubble`) also gets `w-[calc(100%+8px)]` with `-ms-1 -me-1`: it bleeds 4px past its own previous edges while its margin box keeps its original footprint in the surrounding flex/flow layout, so ordinary (non-mention) text keeps the exact same on-screen start position as before this change, and only mentions gain the extra bleed room.
- **`inline-block`, no vertical padding, no border.** `inline-block` keeps the chip's background from splitting across a line wrap. No vertical padding, because — unlike a plain inline element — `inline-block` padding *does* grow the line box, which would make that row taller in the mirror than the matching row in the real textarea. No border, even transparent: a border adds real width the invisible text doesn't have.
- **Hover/focus-only background**, except the error state, which stays on unconditionally so an unsupported mention reads as an error at a glance rather than only on hover.
- **`/` split into its own out-of-flow span, measured rather than assumed.** To style the `/` glyph independently (matching the reference chip pattern other DIAL surfaces use, without necessarily sharing its exact styling) without perturbing the pixel-exact overlay, the `/` is rendered `absolute` at the label's start and the visible name text gets `paddingInlineStart` set, in JS, to the `/` span's own measured `getBoundingClientRect().width` (via `useLayoutEffect`, re-measured when `labelClassName` changes). A static Tailwind padding could not stand in for this: it would need to equal the exact rendered width of `/` in the active font, which varies by typography class. Because the `/` span carries no width of its own once absolutely positioned, and the padding it's replaced by is measured off that same glyph, the label's total flow width still equals the invisible `/{name}` text's width — the constraint from the point above holds. Both the `/` and name spans are `aria-hidden`; the accessible name moves to `aria-label` on the outer span.

### Decision 3b — Command-menu popup anchor: measurement and reference sizing

The command menu (Decision 6/7) can open with its trigger word anywhere in the message, not only at the textarea's start, so its popup is positioned at a pixel anchor measured off a zero-size marker `<span>` spliced into the highlight mirror at the trigger word's offset (`mirrorInsertions` in `Input.tsx`), rather than a fixed corner. Two bugs surfaced getting this right:

- **Measuring the marker's position.** `marker.offsetLeft`/`offsetTop` are relative to `offsetParent` — the marker's nearest *positioned* ancestor, which is the mirror div itself (`position: absolute`), not the separate `relative`-positioned wrapper the popup's own anchor div is positioned against. Any future padding/border difference between the two (this exact regression already happened once, with a widened mirror container) silently throws the popup off by that amount. The fix measures both elements' `getBoundingClientRect()` and diffs them, sidestepping `offsetParent` entirely — the same technique `updateSelectionRects` (Decision on Ctrl+A selection, `Input.tsx`) already uses for the identical reason.
- **The marker's own box must span a full line, not a point.** A completely empty inline element has zero height, and its top coincides with the line's baseline, not its visual top — positioning the popup's preferred `top-start` placement at that point would land it a line's ascent too low. `display: inline-block` (a real box) plus `align-text-top` (top edge at the line's text-top, not the baseline) fixes the *top* edge. But a zero-height box's *bottom* edge is identical to its top, and `Dropdown`'s `flip` middleware anchors a flipped `bottom-start` placement (chosen automatically when there isn't room above for `top-start`) to the reference's bottom edge — so with a zero-height reference, flipping open downward starts right at the current line's top, rendering the menu directly over the line it was triggered from instead of clearing past it. The fix: both the caret marker and floating-ui's actual reference element (the empty `<span>` `Dropdown` wraps its `children` in) get `h-[1lh] w-0` (Tailwind arbitrary value for the CSS `1lh` unit — one line-height, matching the shared typography class each renders under), so their measured box spans the full line and both `top-start` and the flipped `bottom-start` read a correct opposite edge.

## Decision 4 — Reconstructing mentions for history display and edit-mode seeding (no position on the wire)

After a reload, only the message's plain `content` string and its ordered `custom_content.skills: { url: string }[]` are available — no character ranges. A shared utility, `matchSkillMentions` (`libs/skills/src/utils/skill-mention-matching.ts`), reconstructs anchors deterministically:

```ts
/** One resolved mention location, or `undefined` for a skill whose text mention could not be found. */
interface ResolvedSkillMention {
  skillIndex: number; // index into the input `skills` array
  start: number;
  length: number;
}

/**
 * Matches each entry of `skills` (in array order) to the next available
 * `/{name}` occurrence in `text`, where `name` is that entry's display name
 * resolved via `resolveName(url)` — the current listing name, falling back to
 * the url's last path segment (existing `getSkillFallbackName`). Scans left
 * to right, consuming text as it goes, so two skills with the same resolved
 * name are still matched to distinct, successive occurrences in the text.
 * A skill whose exact `/{name}` cannot be found at or after the current scan
 * position (e.g. the user's later edit broke the mention) is omitted from the
 * result — it still counts as a real `custom_content.skills` entry for
 * sending, it simply renders nowhere in particular.
 */
declare const matchSkillMentions: (
  text: string,
  skills: RequestSkill[],
  resolveName: (url: string) => string,
) => ResolvedSkillMention[];
```

Matching rule per entry, in order: search forward from the current scan cursor (starting at 0) for the next occurrence of `/` immediately followed by the entry's exact resolved name, with a word boundary at the end (end of string, whitespace, or another `/`). On a match, record it and advance the scan cursor past it; on no match before the end of the string, that entry (and, deliberately, **only** that entry — later entries still get their own independent forward search from the same unmoved cursor) is omitted from the render but not from the underlying data.

This is a documented heuristic, not a perfect inverse of Decision 2's live tracking (which is exact, because it never re-derives from text). Its one accepted false-positive: a user-typed, non-mention `/word` that happens to exactly equal a real skill's *current* display name, positioned before a genuine mention of that same skill in the reading order, can consume that slot instead of the real mention. This is narrow (requires an exact name collision with a skill already present in the message's own `custom_content.skills`, at a specific position) and benign in outcome (it renders a real, correct, clickable chip for that skill — not a broken UI) — accepted rather than solved, because solving it fully would require carrying position metadata DIAL Core does not accept.

Two consumers of `matchSkillMentions`:

- **History rendering** (Decision 5): resolve-and-render, read-only, every time the message renders.
- **Entering edit mode**: `useSkillMentions` seeds its initial `SkillMentionAnchor[]` by running `matchSkillMentions` once against the message's `content`/`custom_content.skills` at the moment edit mode opens, then behaves exactly as during composing (Decision 2) for every further edit in that session. A mention `matchSkillMentions` could not locate is simply not seeded as an anchor — consistent with "edit restores the skill" only for mentions the text still actually contains.

## Decision 5 — History rendering: user bubble gets real inline segments, assistant bubble keeps its single slot

**User messages** (`UserMessageBubble.tsx`): text is already rendered as a plain, non-markdown string (`<p>{text}</p>`, `whitespace-pre-wrap`). `beforeContent` (today: one slot before all text) is replaced by a `renderContent`-shaped prop that receives the pre-split segments and renders an array of `{ text-node | ChatSkill }` in place, using `matchSkillMentions` at the host layer (`renderHistorySkills`, reworked to return segments instead of a flat list — see Decision 6) to slice `text` into runs. Because the text is plain (not markdown), splicing React nodes into the middle of it in reading order is direct — no parser integration needed. Concretely, `UserMessageBubbleProps.beforeContent: ReactNode` (a single slot) becomes `UserMessageBubbleProps.textSegments?: ReactNode[]` (the full ordered content — text runs and `ChatSkill` elements interleaved — with `text` becoming the fallback plain-string path used when the host has no segments to offer, e.g. a message with no skills, keeping the "byte-identical to today" scenario in the base spec intact for that case).

**Assistant messages** (`AssistantMessageBubble.tsx`): unchanged structurally. The base spec already allows an assistant message to carry `custom_content.skills` (echoed metadata, not text the assistant wrote), and today's `beforeContent` slot already accepts an arbitrary `ReactNode` — `renderHistorySkills`'s existing `entries.map(...)` already produces an array of `ChatSkill` elements when there is more than one entry, so multiple assistant-side skills already render correctly in the one leading slot with no code change beyond removing the base spec's now-inaccurate "at most one today" parenthetical. Assistant text is model-generated markdown and is not expected to literally contain `/{name}` tokens at meaningful positions, so there is no text-position reconstruction to do for it — it keeps the leading-group treatment.

## Decision 6 — `useSkillSelectorOverlay` → ordered mentions, and the app-level wiring shape

`UseSkillSelectorOverlayResult` changes shape (all four `apps/chat` call sites consume this one hook output, so the blast radius is one hook plus three thin call sites plus history rendering — not four independent reimplementations):

- `selectedSkillElement: ReactNode` (single chip) → **removed**. Its replacement, the live-composing highlighted-text render, is owned by `Input.tsx` directly from the mention anchors (Decision 3), not handed to the host as a pre-built element — the host no longer needs to build a "the one selected skill" node at all.
- `selectedSkillPath: string | null` → **removed** (no longer meaningful with N mentions).
- `selectedSkills: RequestSkill[] | undefined` → **kept**, now derived from `orderedSkills` (Decision 2) instead of a single id — this is the prop every send-path call site (`ConversationRoute.tsx`, `ConversationView.tsx`) already threads through unchanged.
- `selectSkill(skillId)` → replaced by `insertMention(url, name, atCaretIndex)` (Decision 2), called from the same two selection sites (`commandMenu`'s `onSelect`, `skillMenuOverlay`'s `onSelect`) with the resolved skill's `name` alongside its `url` (both already available at the selection call site from `SkillListingEntry`), and a caret position: `0` for the slash-menu path (it only ever opens over an empty textarea), and the second argument `Input`/`MenuOverlayConfig.renderOverlay` now hands the host directly for the add-menu path (see the implementation note below — `renderOverlay(onClose, caretPosition)` gained that second parameter precisely for this).
- `removeSelectedSkill()` → replaced by `onBackspaceAtCaret`/the mention-clearing reset called after send; the input-level `onInlineStartRemove` prop is retired from `ConversationInput`/`EditMessageInput`'s public API (superseded by the caret-aware Backspace handling inside `Input.tsx` itself, Decision 2) — the three `apps/chat` call sites that pass `onInlineStartRemove={removeSelectedSkill}` drop that prop entirely rather than swapping in a new callback.
- `inlineStartSlot` prop on `ConversationInput`/`EditMessageInput`/`Input` → retired for the skills use case. `Input.tsx` now owns mention rendering directly against its own draft text + an `activeMentions: HighlightedTextRange[]` prop (`HighlightedTextRange = { start, length }`, a small type defined locally in `libs/conversation-input` — not `SkillMentionAnchor` from `libs/skills`, since `libs/skills` depends on `libs/conversation-input` and the reverse import would cycle; `Input` doesn't need the mention's `url`/`name`, only its range) — owned by the new `useSkillMentions` hook's `anchors`, mapped down instead of a pre-rendered slot node. `menuOverlays`/`commandMenu` stay the injection points for *opening* the picker; the picker's selection callback is what calls `insertMention`, then pushes the result down through `message`/`messageRevision`/`caretPositionOverride` (all three now also present on `ConversationInput`/`EditMessageInput`) — see `tasks.md` block 2's "Task 2.4" note for the exact, as-implemented call sequence.
- `renderHistorySkills(skills)` → returns the ordered **segments** described in Decision 5 (an array of `{ text | ChatSkill }`) built via `matchSkillMentions`, given the message's `content` string alongside its `custom_content.skills` (it needs both now, not just the skills array — call sites already have both available on `msg`).

`apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx` (the host wiring) changes only its pass-through: same feature flag, same listings/favorites/labels wiring, forwarding the reshaped result. `NewConversationComposer.tsx`, `ConversationView.tsx`, and `AppsEditor/AppPreviewChat.tsx` each drop their `inlineStartSlot`/`onInlineStartRemove` props for the skills flow and instead pass through whatever new `activeMentions`/mention-related prop `ConversationInput`/`EditMessageInput` expose — the exact same one prop shape at all three call sites, since all three already share the identical wiring pattern today.

## Decision 7 — Command-menu backspace-to-bare-trigger reopen fix

In `useCommandMenu.ts`, `handleValueChange`'s gate currently requires the **previous** value to be `''` before it will ever open the menu (`message !== ''` short-circuits everything, including the paste branch). That gate blocks reopening via backspace, because backspacing from `/sdf` to `/` never passes through an empty string. The fix narrows the empty-previous-value requirement to just the paste branch and adds an unconditional bare-trigger check ahead of it:

```ts
const handleValueChange = useCallback(
  (nextValue: string, isComposing: boolean, inputType?: string) => {
    if (config == null || isComposing) return;

    const isBarePrefix = nextValue === config.triggerPrefix;

    // Reopens on reaching the bare trigger character, whether by typing it
    // into an empty box (message === '') or by deleting back down to it
    // after a prior dismissal (isDismissed) — never mid-query, since this
    // only matches the exact single-character value.
    if (isBarePrefix && (message === '' || isDismissed)) {
      setIsMenuOpen(true);
      setIsDismissed(false);
      return;
    }

    if (message !== '' || isDismissed) return;

    const isPastedCommand =
      inputType === 'insertFromPaste' &&
      isCommandValue(nextValue, config.triggerPrefix);
    if (isPastedCommand) {
      setIsMenuOpen(true);
    }
  },
  [config, message, isDismissed],
);
```

Why this doesn't spuriously reopen while typing forward: the new branch only matches when `nextValue` is **exactly** the trigger character (length 1) — any further character typed after the trigger (`/s`, `/sd`, ...) fails `isBarePrefix` and falls through unchanged. Paste behavior is unchanged (still requires an empty previous value and no prior dismissal, matching today). The existing `useEffect` that clears `isMenuOpen`/`isDismissed` when the value stops matching the command shape is untouched and still governs every closing transition.

## Non-goals

- No change to the editing surface's underlying technology (`<textarea>` stays a `<textarea>`) — Decision 3 is the deliberate, disclosed compromise instead of a contentEditable rewrite.
- No change to `RequestSkill`'s wire shape, to DIAL Core's contract, or to any generated OpenAPI client.
- No new interactive affordance (tooltip/"View details") while actively composing — only in read-only history/edit-restored-but-unedited-yet display. (Edit-restored anchors seeded via `matchSkillMentions` render as the same highlighted-run treatment as live composing, per Decision 3/6, the moment edit mode is entered — "restored" does not mean "shown as a full chip while still editable.")
- No i18n additions beyond what the base spec already requires (`ChatSkillLabels`); the highlighted-run style needs no new label, only a shared style token.
