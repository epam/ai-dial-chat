### Cross-cutting notes

- **i18n**: No new user-visible strings. The scroll-to-bottom button keeps its existing aria-label key `ChatI18nKeys.ScrollToBottom`.
- **RTL**: Direction-agnostic. The scroll-to-bottom button stays horizontally centered (`left-1/2 -translate-x-1/2`, direction-agnostic per `.claude/rules/rtl.md`); near-top anchoring scrolls along the block (vertical) axis only and has no inline-direction dependency.
- **Feature flags**: Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — this is a default scroll-behavior fix, not an optional feature.
- **Memoization**: All scroll callbacks (`scrollToBottom`, `armAnchor`, `updateScrollButtonVisibility`, etc.) are `useCallback`-wrapped inside `useConversationScroll`; the effect that consumes an armed anchor / triggers a load-time scroll depends on `messages`/`isAssistantTyping`.
- **Accessibility**: The message list container already has `role="log"`, `aria-live="polite"`, `aria-relevant="additions"` — unchanged. The scroll-to-bottom button remains keyboard-reachable and announces via its existing `aria-label`.
- **Observability**: No new metrics/telemetry required; this is a client-side rendering behavior with no backend or analytics surface.

---

### Requirement: Sent Message Scrolls Near Top of Viewport

When the user sends a message, the conversation view SHALL scroll so the top of the newly sent user message is positioned near the top of the visible viewport, rather than scrolling the container to its absolute bottom.

State ownership: the scroll container ref, the target-message ref map, and the anchor-arming/consumption logic live in `useConversationScroll` (`apps/chat/src/hooks/conversation/useConversationScroll.ts`), driven by the `messages`/`isAssistantTyping` it's given. `ConversationView` calls the hook's `armAnchor(index)` from thin wrapper handlers (`handleSendWithAnchor`, `handleRegenerateMessageWithAnchor`, `handleEditMessageWithAnchor`) before delegating to the real `onSend`/`onRegenerateMessage`/`onEditMessage` — it owns which index to arm for each action, since that mapping is action-specific. The append action itself is owned by `handleSend` in `apps/chat/src/hooks/conversation/useConversationHandlers.ts` and requires no new state — it continues to append the user message and an empty assistant placeholder to conversation state as it does today.

Since the browser clamps a scroll target to the container's current maximum scrollable position, and right after sending there usually isn't yet a full viewport of content after the newly anchored message, the message list reserves scroll room at the moment of anchoring (an explicit-height spacer sibling of the real message content, sized to one viewport's height). This reservation SHALL stay fixed for the entire turn — it is not recomputed or shrunk as the response streams in — and is cleared entirely, in one step, once the turn completes. An idle, fully-scrolled conversation SHALL NOT show a permanent empty gap below the last message, and the reserved room SHALL NOT cause the scroll position to jump at any point while the response is actively streaming.

A progressively-shrinking reservation (recomputed as content grows, so the trailing gap visibly closes during the stream instead of only at the end) was tried and reverted: shrinking requires measuring the rendered message content's actual height, but that height can grow from more than one source — new `messages` content and, independently, the streamed-markdown "typewriter" reveal's own `requestAnimationFrame` schedule (`useStreamedMarkdownContent`) — and the two aren't synchronized. A shrink computed off one source could remove more reserved room than the other source had actually grown by, transiently shrinking total scroll height and getting the scroll position clamped — a visible downward jump partway through streaming. A fixed-for-the-turn reservation has nothing left to race, at the cost of a brief, fixed-size empty gap below a still-short response instead of a gap that closes gradually.

The streamed-markdown renderer MAY reveal appended plain text gradually while `isStreaming` is true, but it SHALL synchronously render the full final `content` when `isStreaming` becomes false. The scroll hook uses `isAssistantTyping === false` as the turn-complete signal and clears the reserved spacer in a layout effect; therefore, no renderer-level `requestAnimationFrame` catch-up may continue growing the assistant message after that signal.

#### Scenario: User sends a short message with empty history above
- **WHEN** the user submits a message and the assistant placeholder is appended
- **THEN** the view scrolls so the newly sent user message's top edge is near the top of the viewport, with the (initially empty) assistant placeholder visible below it

#### Scenario: User sends a message near the end of a long conversation
- **WHEN** the user submits a message and the assistant placeholder (still empty) is appended, such that the real content after the new message is shorter than one viewport
- **THEN** the view still scrolls the new message's top edge to near the top of the viewport (not the bottom), using reserved scroll room below the message rather than being clamped to the container's current content height

#### Scenario: User sends a long, multi-line message
- **WHEN** the user submits a message long enough that scrolling to the container's absolute bottom would previously have hidden the start of the message
- **THEN** the view still scrolls so the top of the new message is near the top of the viewport, so the beginning of the message is visible

#### Scenario: Reserved scroll space stays fixed while the response streams in, without moving the scroll position
- **WHEN** a response is actively streaming after an anchor, and its rendered content grows (including growth well past one full viewport's worth of text)
- **THEN** the reserved bottom scroll space stays at its initial size (it is not shrunk mid-stream), and the scroll position does not jump or shift at any point during the stream

#### Scenario: Reserved scroll space is gone once the turn completes
- **WHEN** the assistant response finishes streaming (regardless of whether it grew enough to fully consume the reserved scroll space on its own)
- **AND** any buffered streamed-markdown text has already been flushed to the DOM
- **THEN** no reserved space remains — scrolling to the end of the conversation reaches the actual last message, not empty space

#### Scenario: User regenerates a response
- **WHEN** the user triggers regenerate on an assistant message and the response starts re-streaming
- **THEN** the view anchors the same way as on send — the associated user message's top is positioned near the top of the viewport

#### Scenario: User edits and resubmits a message
- **WHEN** the user edits a previous user message and resubmits it, and the assistant response starts re-streaming
- **THEN** the view anchors the same way as on send — the edited message's top is positioned near the top of the viewport

#### Scenario: Regenerate or edit triggered while another generation is in flight
- **WHEN** the user triggers regenerate or edit-resubmit while a different generation for the conversation is already streaming (a no-op for that action)
- **THEN** no anchor is armed, so a later, unrelated message update is not mis-anchored to a stale index

#### Scenario: Edit-and-resubmit with unchanged text
- **WHEN** the user opens edit mode on a message, does not change its text or attachments, and resubmits (a no-op for that action)
- **THEN** no anchor is armed, so a later, unrelated message update (e.g. a delete or a rating change) is not mis-anchored to a stale index

#### Scenario: Conversation loaded from history
- **WHEN** an existing conversation is opened (not as a result of the current user just sending, regenerating, or editing a message)
- **THEN** the view scrolls to the bottom of the conversation as it does today; no near-top anchoring is applied since there is no just-acted-on message to anchor to

---

### Requirement: Streaming Never Forces the Scroll Position

While an assistant response is streaming, the conversation view SHALL NOT move the scroll position on its own, regardless of where the user is currently scrolled. The only scroll changes during a turn are the one-time near-top anchor on send/regenerate/edit and any scroll the user performs themselves (manually, or via the scroll-to-bottom button).

This is a literal implementation of "does not auto-scroll line-by-line": there is no conditional or pinned auto-follow — a prior implementation that auto-followed only while the user was "already at the bottom" was found (via live testing) to resume within the first couple of streamed tokens every time, since the still-short response initially measures as near-bottom by the visibility threshold. Removing conditional auto-follow entirely was simpler and matches the literal requirement.

#### Scenario: Response streams while anchored near the top
- **WHEN** the assistant response is streaming after the view anchored the sent/regenerated/edited message near the top
- **THEN** the scroll position stays exactly where the anchor left it for the entire stream, even as the response grows past the visible fold

#### Scenario: User manually scrolls during a stream
- **WHEN** the user manually scrolls (up or down) while a response is streaming
- **THEN** the view respects the manual scroll and does not snap back to any other position on the next streamed token

---

### Requirement: Scroll-To-Bottom Button Visibility

The conversation view SHALL show a scroll-to-bottom button whenever the user is not at the bottom of the conversation and there is content below the current viewport (including content still streaming in). The button SHALL be hidden once the user is at (or returns to) the bottom.

#### Scenario: Button appears when scrolled away with content below
- **WHEN** the user is scrolled more than the near-bottom threshold away from the bottom of the conversation and there is message content (including in-progress streamed content) below the visible viewport
- **THEN** a scroll-to-bottom button is shown

#### Scenario: Button hidden at the bottom
- **WHEN** the user is at or within the near-bottom threshold of the bottom of the conversation
- **THEN** the scroll-to-bottom button is not shown

#### Scenario: Clicking the button scrolls to the latest content
- **WHEN** the user clicks the scroll-to-bottom button
- **THEN** the view smoothly scrolls to the current bottom of the conversation and the button is hidden; this is a one-time catch-up, not a persistent follow mode — if the response keeps streaming and grows past the fold again, the button reappears
