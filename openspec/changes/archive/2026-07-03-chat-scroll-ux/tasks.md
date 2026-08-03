## 0. Fix pre-existing scroll-container CSS bug

- [x] 0.1 Remove `overflow-x-hidden` from the message-list content div (`contentRef`) in `ConversationView.tsx` — it was implicitly promoting its own `overflow-y` to `auto` per the CSS Overflow spec, making it an independent scroll container that absorbed all vertical overflow and left `containerRef` (the intended `role="log"` scroll owner) with `scrollHeight === clientHeight` always, i.e. never actually scrollable. Found via live browser debugging with the user (console diagnostics: `scrollHeight`/`clientHeight` equality up the DOM chain, `scrollTop` staying `0` after manual scroll, and a capture-phase `scroll` listener identifying the true event target). This bug predates this change and explains why the original report ("message gets lost, no auto-scroll") happened at all — `containerRef`'s own `overflow-x-hidden` already clips horizontally, so no behavior is lost.

## 1. Scroll-to-top-on-send anchoring

- [x] 1.1 In `ConversationView.tsx`, add a way to reference the DOM node of a specific message by index (e.g. a `messageRefs` map/callback ref set on each `ConversationMessageItem` wrapper), scoped to what's needed to scroll a given index into view.
- [x] 1.2 Generalize the existing `scrollToBottom` helper into a small internal scroll utility that also supports "scroll element to top of container" (reusing the same `isProgrammaticRef` guard and `scrollend`/timeout fallback), so both scroll targets share one code path.
- [x] 1.3 In the message-count-changed effect (`ConversationView.tsx:386-400`), replace the non-streaming `scrollToBottom(false)` branch with "scroll the newly-appended user message to near the top of the viewport" when the length change corresponds to a freshly sent message.
- [x] 1.4 Set `userScrolledRef` to `true` at the moment of this new anchoring (not `false`) — treating the deliberate near-top position the same as a manual scroll-away, so the very next streamed token doesn't force-scroll back to the bottom. `applyNearBottomState` self-corrects it back to `false` if the conversation is short enough that the anchor position is already within the near-bottom threshold.

## 2. Regenerate anchoring

- [x] 2.1 Identify, from `handleRegenerateMessage` (`useConversationHandlers.ts`), how the regenerated turn's message-count/content change is distinguishable from a plain streaming update, and apply the same near-top anchoring used in 1.3 to the associated user message.
- [x] 2.2 Verify initial conversation load (opening from history) is unaffected and still scrolls to the bottom, not near-top (no anchoring target exists for that case).

## 3. Streaming and scroll-button behavior (verify, adjust if needed)

- [x] 3.1 Verify the existing pinned-to-bottom auto-follow during streaming (`scrollToBottom(true)` gated by `userScrolledRef`) still behaves correctly immediately after the new near-top anchoring on send — i.e. the first streamed token doesn't yank the view back to the container bottom before the user has seen the near-top-anchored message.
- [x] 3.2 Verify `isScrollButtonVisible` / `NEAR_BOTTOM_THRESHOLD` logic continues to correctly show/hide `FabButton` given the new anchoring behavior (e.g. right after sending, when the assistant placeholder is short, the user is now intentionally not at the bottom — confirm the button correctly appears if there is streamed content below the fold).
- [x] 3.3 Verify `handleScrollToBottom` (button click) still resets `userScrolledRef` and smooth-scrolls to the true bottom, resuming auto-follow.

## 4. Quality gates

- [x] 4.1 `npm exec nx affected --target=lint --base=origin/development-1.0`
- [x] 4.2 `npm exec nx affected --target=test --base=origin/development-1.0`
- [x] 4.3 `npm exec nx affected --target=build --base=origin/development-1.0`
- [x] 4.4 Run the five-axis code review (`.claude/skills/code-review-and-quality/SKILL.md`) before merge.

## 5. Revision after live user feedback (round 2)

Live testing after round 1 surfaced two real problems and one requested refactor; see `design.md` Decisions 2, 5 (removed), and 6 for the full rationale.

- [x] 5.1 Remove the pinned-to-bottom auto-follow during streaming entirely (`scrollToBottom(true)` on token arrival, and the `userScrolledRef`/`isProgrammaticRef`/`scrollend`-guard mechanism that gated it) — it was self-correcting back to "follow" within the first couple of streamed tokens after every anchor, which both defeated the near-top anchor (message ended up pinned near the bottom again almost immediately) and reintroduced the literal "auto-scroll line-by-line" behavior the spec explicitly forbids.
- [x] 5.2 Replace the removed mechanism's button-visibility role with a plain `updateScrollButtonVisibility()` that only reads current scroll position vs. content size — no streaming-state gating, no user-scrolled-away flag.
- [x] 5.3 Extract the entire scroll subsystem into a new hook, `useConversationScroll` (`apps/chat/src/hooks/conversation/useConversationScroll.ts`): `containerRef`, `contentRef`, `setMessageRef`, `isScrollButtonVisible`, `scrollToBottom()`, `armAnchor(index)`. `ConversationView` now only computes which index to arm for each of send/regenerate/edit and calls `armAnchor` from its thin wrapper handlers.
- [x] 5.4 Fix `handleEditMessageWithAnchor` to guard with `isMessageChanged` (`apps/chat/src/utils/message-utils.ts`) before arming, matching `handleEditMessage`'s own no-op condition — arming unconditionally left a stale anchor index that could later fire on an unrelated `messages` update (e.g. a delete or rating change) when the edit itself was a no-op.
- [x] 5.5 Re-run quality gates: `nx run @epam/chat:typecheck`, `nx run chat:lint`, `nx run chat:test` (760/760), `nx affected --target=build --base=origin/development-1.0` — all pass.
- [x] 5.6 Update `design.md` and `specs/chat-scroll-behavior/spec.md` to reflect the revised behavior (no auto-follow at all during streaming; scroll-to-bottom button click is a one-time catch-up, not a persistent follow toggle; new no-op edit scenario).

## 6. Fix anchor clamping to the container's current max scroll (round 3)

Live testing after round 2 found the near-top anchor still landing near the bottom in a long conversation — see `design.md` Decision 7.

- [x] 6.1 Add a `spacerHeight` state to `useConversationScroll`, kept in sync with `containerRef`'s own `clientHeight` via a `ResizeObserver`, and render it as a fixed-height, `shrink-0` sibling of `contentRef` inside `containerRef` in `ConversationView.tsx` — guarantees the container always has at least one viewport's worth of scroll room past the end of real content, so `container.scrollTo` is never clamped below the computed anchor target. **Superseded in round 4 (section 7)** — this always-present version was a real UX regression (permanent empty gap), replaced with a temporary, self-shrinking spacer.
- [x] 6.2 Change `scrollToBottom()` and `updateScrollButtonVisibility()` to measure against `contentRef`'s own `getBoundingClientRect()` (the real end of message content) instead of `container.scrollHeight`/`scrollTop`, so neither is thrown off by the now-present spacer.
- [x] 6.3 Re-run quality gates: `nx run @epam/chat:typecheck`, `nx run chat:lint`, `nx run chat:test` (760/760), `nx affected --target=build --base=origin/development-1.0` — all pass.
- [x] 6.4 Update `design.md` (Decision 7, new risk entry) and `specs/chat-scroll-behavior/spec.md` (new scenario, bottom-spacer note) to reflect the fix.

## 7. Make the spacer temporary and fix scrollbar width (round 4)

Live testing after round 3 flagged two issues: a permanent empty gap below the last message, and the scrollbar moving from the message column to the full panel edge. See `design.md` Decisions 7 (revised) and 8.

- [x] 7.1 Replace the always-on `spacerHeight` state with an imperatively-managed `spacerRef` in `useConversationScroll`: sized to `container.clientHeight` synchronously in the same pass as `scrollMessageToTop` (before it runs, so the forced layout flush from its `getBoundingClientRect()` calls picks up the new spacer size and `scrollTo` isn't clamped), then shrunk via `shrinkSpacerForGrowth()` (called from the existing `contentRef` `ResizeObserver`) by however much real content has grown since the anchor, down to `0`. **Superseded in round 5 (section 8)** — this two-step JS shrink caused a visible scroll jump.
- [x] 7.2 Force the spacer back to `0` immediately when `isAssistantTyping` transitions to `false`, so a short response that never "grows into" the reserved space doesn't leave a residual gap.
- [x] 7.3 Move `max-w-[760px] mx-auto` from `contentRef` to `containerRef` in `ConversationView.tsx`, so the scroll container itself (and therefore its native scrollbar) is constrained to the message-column width instead of the full chat panel.
- [x] 7.4 Re-run quality gates: `nx run @epam/chat:typecheck`, `nx run chat:lint`, `nx run chat:test` (760/760), `nx affected --target=build --base=origin/development-1.0` — all pass.
- [x] 7.5 Update `design.md` (Decision 7 rewritten, Decision 8 added, risk entries) and `specs/chat-scroll-behavior/spec.md` (spacer scenarios) to reflect the final behavior.

## 8. Fix scroll-jump mid-stream by moving the shrink into CSS layout (round 5)

Live testing after round 4 found the anchored message visibly jumping down mid-stream (not always to the bottom, but noticeably away from the top) shortly after the first chunk of the response rendered. Root cause: the round-4 spacer shrink (`shrinkSpacerForGrowth`) ran in a `ResizeObserver` callback — asynchronous relative to the DOM mutation that grew the content — creating a two-step "content grows, then spacer shrinks" sequence. In between those steps, `scrollHeight` transiently exceeded, then dropped below, the already-applied `scrollTop`, and the browser clamped `scrollTop` down in response every time. See `design.md` Decision 7 (rewritten again).

- [x] 8.1 Remove `spacerRef`, `requiredSpacerRef`, `contentHeightAtAnchorRef`, `applySpacerHeight`, and `shrinkSpacerForGrowth` from `useConversationScroll` entirely.
- [x] 8.2 Add `wrapperRef`, wrapping `contentRef` as its sole child, both nested inside `containerRef` (`containerRef` → `wrapperRef` → `contentRef` → messages) in `ConversationView.tsx`. Move the `flex min-w-0 flex-1 flex-col` sizing classes from `contentRef` to `wrapperRef`; `contentRef` keeps `flex flex-1 flex-col gap-[26px] px-6 pt-7`. **Superseded in round 6 (section 9)** — `contentRef` was left with a stray `flex-1` that stretched it to fill the reserved space, corrupting its own measured height, and the underlying CSS min-height+flex-grow resolution proved unreliable to reason about for this shape in general.
- [x] 8.3 At anchor-consumption time, set `wrapperRef.current.style.minHeight` imperatively to `contentRef`'s current height + `container.clientHeight`, before calling `scrollMessageToTop` (whose `getBoundingClientRect()` calls force the layout flush that makes the new min-height take effect before `scrollTo` runs). Clear it (`''`) in the existing `isAssistantTyping → false` effect. No JS-driven shrink step — the blank space inside `wrapperRef`'s frozen minimum shrinks automatically, in the same layout pass, as `contentRef` (a normal flex-item sibling of nothing else inside the min-height'd wrapper) grows.
- [x] 8.4 Re-run quality gates: `nx run @epam/chat:typecheck`, `nx run chat:lint`, `nx run chat:test` (760/760), `nx affected --target=build --base=origin/development-1.0` — all pass.
- [x] 8.5 Update `design.md` (Decision 7 rewritten a second time, risk entries) and `specs/chat-scroll-behavior/spec.md` (scenario wording) to reflect the final, race-free mechanism.

## 9. Fix the remaining jump by dropping CSS auto-sizing for a synchronous, explicit-height spacer (round 6)

Live testing after round 5 found the anchored message still jumping down, this time after roughly one viewport's worth of streamed text (~15-20 lines) rather than immediately. Root cause: `contentRef` had been left with a stray `flex-1` class from before the anchoring feature existed; combined with `wrapperRef`'s frozen `min-height` and being its only child, this stretched `contentRef` to fill the reserved space rather than sizing to its own real content — and CSS's resolution for an auto-height flex container with `min-height` plus a single `flex-grow` child whose content need can exceed that minimum isn't reliably predictable enough across engines to keep debugging blind. See `design.md` Decision 7 (final rewrite).

- [x] 9.1 Remove `wrapperRef` from `useConversationScroll` and `ConversationView.tsx` entirely; go back to a flat `containerRef` → `contentRef` + `spacerRef` (siblings) structure. Remove `flex-1` from `contentRef`'s classes — it must size to its own real content only.
- [x] 9.2 Track `requiredTotalRef` (real content height + viewport height, frozen at anchor time; `0` means no active reservation) instead of a delta-based "required spacer" value.
- [x] 9.3 Convert the anchor-consuming effect from `useEffect` to `useLayoutEffect`, and fold the spacer recomputation into the *same* effect (on every `messages` update, if `requiredTotalRef.current > 0`, recompute the spacer's explicit height as `max(requiredTotalRef.current - contentRef's current real height, 0)`), rather than a separate `ResizeObserver`-driven callback. `useLayoutEffect` runs synchronously, before paint, in the same commit that rendered the content growth — eliminating the window where the browser could observe an inconsistent intermediate size and clamp `scrollTop`.
- [x] 9.4 Convert the `isAssistantTyping → false` reset effect to `useLayoutEffect` too, for the same before-paint guarantee.
- [x] 9.5 Re-run quality gates: `nx run @epam/chat:typecheck`, `nx run chat:lint`, `nx run chat:test` (760/760), `nx affected --target=build --base=origin/development-1.0` — all pass.
- [x] 9.6 Update `design.md` (Decision 7, final rewrite; risk entries) and `specs/chat-scroll-behavior/spec.md` (scenario wording) to reflect the final mechanism. **Shipped with a regression, fixed in round 7 (section 10)** — the spacer lacked `flex-shrink: 0`, so `containerRef` being a flex column collapsed it to `0` regardless of its explicit height, the moment real content (as normal for a long conversation) exceeded the container's own height.

## 10. Fix spacer flex-shrink collapse (round 7)

Live testing after round 6 found the anchor broken again (message at the bottom, no reserved space at all) — worse than round 5. Root cause, found via a real isolated reproduction with a temporary route mounting the actual hook (a simplified same-round test harness that omitted `display: flex` on the container passed cleanly and gave false confidence — see `design.md` Decision 7's process note): `containerRef` is `flex flex-col`, and the spacer had no explicit `flex-shrink`, defaulting to `flex: 0 1 auto`. Since `contentRef`'s real content routinely (and correctly) exceeds `containerRef`'s own height for a long conversation, and `contentRef` is protected from shrinking by its own content, 100% of the flexbox shrink deficit landed on the spacer — collapsing its rendered height to `0` regardless of its explicit inline `style.height`. Confirmed directly: the inline style read back correctly, but `getComputedStyle`/`getBoundingClientRect` both showed `0`.

- [x] 10.1 Add `shrink-0` to the spacer div in `ConversationView.tsx`.
- [x] 10.2 Add `shrink-0` to `contentRef`'s div too, making its shrink-protection explicit rather than relying solely on its content-based automatic minimum.
- [x] 10.3 Re-verify live via the same isolated-hook reproduction technique (temporary unauthenticated route mounting the real hook with fake data, this time mirroring `containerRef`'s actual `display: flex` structure): confirmed the spacer's actual rendered height now matches its inline style through the full anchor → shrink → fully-consumed → reset lifecycle, and `scrollTop` never moves on its own at any point. Removed the temporary route/component/launch config completely afterward.
- [x] 10.4 Re-run quality gates: `nx run @epam/chat:typecheck`, `nx run chat:lint`, `nx run chat:test` (760/760), `nx affected --target=build --base=origin/development-1.0` — all pass.
- [x] 10.5 Update `design.md` (Decision 7, fourth-attempt + final entries, new risk entry, process note) to reflect the fix and the lesson about isolated-repro fidelity.
