## MODIFIED Requirements

### Requirement: Progressive conversation titles

The app SHALL render the metadata list before resolving pending display titles. `ConversationsContext` in `apps/chat/src/context/ConversationsContext.tsx` SHALL own history state, and `useConversationTitleEnrichment` in `apps/chat/src/hooks/conversation/useConversationTitleEnrichment.ts` SHALL own snapshot-scoped attempts, title revisions and stream scheduling. No new global provider SHALL be introduced.

The hook SHALL consume the finite title stream through `apps/chat/src/server-api/conversations.api.ts`, merge successful titles by exact stable identity without changing ordering or pin/unread state, and stop obsolete work when the list snapshot or authenticated identity changes or the provider unmounts. Valid title events SHALL be applied before unrelated slow reads finish, with rendering updates coalesced at most until the next animation frame or a 100 ms fallback timer. Deleted items SHALL not be recreated. Newer manual or opened-conversation titles, existing protection intervals, deletion tombstones and failed-delete rollback SHALL retain precedence over stale events.

Requests SHALL respect both ID-count and serialized-byte limits and run one stream at a time per attempt. A size boundary or progress-making budget terminal SHALL continue with unattempted IDs. Failed/missing item outcomes SHALL retain existing fallback titles and SHALL not retry in that attempt. A fatal error, malformed protocol, missing terminal event or connection failure SHALL stop the attempt, preserve valid delivered titles and settle progress without an automatic retry loop. A later list refresh SHALL allow unresolved titles to be retried. An initial pre-stream 404/405 SHALL select the existing 25-ID JSON path for the identity session; other failures SHALL NOT trigger that fallback.

The app adapter SHALL validate typed SSE frames across arbitrary UTF-8/network boundaries, CRLF and multi-line data, skip comments, cap each frame at 64 KiB, require truthful terminal counts, and cancel/release readers on exit. Non-requested or duplicate item IDs SHALL not mutate state. `isUpdatingTitles` SHALL describe active work, not whether every title was successfully resolved.

The shared panel SHALL receive only updating state, translated labels and optional host-agnostic viewport callbacks; API calls, auth, scheduling and lifecycle state SHALL remain in the app. The behavior SHALL be identical in the desktop sidebar and mobile drawer and SHALL preserve RTL layout, focus and existing search retention/highlighting. A polite status message using the existing `conversationPanel.updatingTitles` translation SHALL be available to assistive technology without hiding the list or announcing every incoming title. No new user-visible strings or feature flag SHALL be introduced.

#### Scenario: List is usable before titles finish

- **WHEN** a title read remains unresolved after metadata has loaded
- **THEN** conversations remain visible and interactive while independently resolved titles are applied and title progress is shown

#### Scenario: Changed identity or newer edit

- **WHEN** a prior stream delivers after the user changes identity, renames or deletes a conversation
- **THEN** it cannot overwrite the new identity's list, replace the newer title or restore the deleted row

#### Scenario: Background failure

- **WHEN** a stream fails after delivering some valid titles
- **THEN** existing rows and those valid titles remain usable, pending rendering updates are flushed, and progress settles without an infinite retry loop

#### Scenario: Frames span network chunks

- **WHEN** a UTF-8 character or event frame is split across reads, with comments and CRLF delimiters present
- **THEN** the adapter produces the intended typed events exactly once and ignores comment payloads

#### Scenario: Large history or budget continuation

- **WHEN** the history exceeds a request limit or a progress-making stream ends with a budget terminal
- **THEN** the next request contains remaining unattempted IDs only, and IDs with settled unavailable/error outcomes do not loop

#### Scenario: Older backend fallback is bounded

- **WHEN** the new endpoint returns HTTP 404/405 before opening SSE
- **THEN** the attempt uses the existing JSON title batches and remembers that capability result for the current identity session
- **AND** HTTP 401/403/5xx or mid-stream errors do not trigger an additional history-wide fallback

## ADDED Requirements

### Requirement: Visible conversation IDs guide initial enrichment priority

`ConversationList` in `libs/conversation-panel/src/components/ConversationList/ConversationList.tsx` and its public `ConversationListSection`/`ConversationPanel` containers SHALL support optional `onVisibleConversationIdsChange(ids: string[]): void`. It SHALL report distinct conversation IDs in actual visible virtual-row order, excluding group headers and overscan-only rows, and report an empty set when no rows are visible. Stable callbacks and memoized ID sequences SHALL prevent notifications when the sequence is unchanged.

`ConversationPanelView` SHALL register each mounted view's IDs through the existing app context and clear its registration on hide/unmount. The app SHALL merge active registrations and order pending work with visible IDs first, then remaining metadata order. It SHALL allow at most one animation frame or 100 ms for initial viewport reporting, proceeding with normal history order when no report exists. It SHALL resample before each new stream request; scrolling alone SHALL NOT restart accepted work. The library SHALL contain no API, auth, route, context, cache, telemetry or feature-flag integration.

Hidden/collapsed/filtered-out conversations and older scheduled runs SHALL remain eligible for background enrichment so current search results can converge. Closing a mobile drawer SHALL clear viewport priority without discarding useful snapshot work. This callback SHALL introduce no directional layout or icon changes and SHALL work identically in LTR and RTL.

#### Scenario: Viewport contains pinned rows and group headers

- **WHEN** the virtual list reports a range containing group headers and pinned conversation rows
- **THEN** the callback reports the actual visible conversation IDs only and the app schedules their pending titles before background items

#### Scenario: Scroll changes the visible set

- **WHEN** the visible ID sequence changes during an active stream
- **THEN** the new sequence affects the next request's priority without aborting the current stream

#### Scenario: No visible match or closed drawer

- **WHEN** provisional search has no visible rows or the mobile drawer closes
- **THEN** the app continues bounded background enrichment and does not wait indefinitely for a viewport report

#### Scenario: Two views register priority

- **WHEN** two mounted views register visible IDs and one is hidden or unmounted
- **THEN** only that view's registration is removed and the other view's priority remains
