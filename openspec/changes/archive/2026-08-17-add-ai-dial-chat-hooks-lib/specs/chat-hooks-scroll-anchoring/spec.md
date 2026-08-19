## ADDED Requirements

### Requirement: Library isolation
The `libs/ai-dial-chat-hooks` package SHALL declare `react` as its only runtime `peerDependency` and SHALL NOT import, at runtime or as a type dependency, any `@epam/ai-dial-*` package, any REST/API-client module, any application context/provider, any routing, storage, analytics, or i18n module. Hooks in this library SHALL accept all chat-domain data and behavior through function parameters (props/callbacks), never through implicit access to app-owned singletons or global state.

#### Scenario: Building the library without the host app
- **WHEN** `libs/ai-dial-chat-hooks` is built in isolation via its own Nx `build` target
- **THEN** the build succeeds without resolving any `@epam/ai-dial-ui-kit`, `@epam/chat-api-client`, `@epam/ai-dial-chat-shared`, or `apps/chat/**` module

#### Scenario: Module boundary lint passes
- **WHEN** `@nx/enforce-module-boundaries` lints `libs/ai-dial-chat-hooks`
- **THEN** no violation is reported for importing an app, a generated API client, or another `@epam/ai-dial-*` library beyond `react`

### Requirement: `useConversationScroll` public API
The library SHALL export a hook `useConversationScroll<T>(params: { messages: T[]; isAssistantTyping: boolean; conversationId: string }): result` where `T` is an unconstrained generic type parameter (the hook reads only `messages.length`, never message field values), and `result` SHALL contain exactly: `containerRef`, `contentRef`, `spacerRef` (each a `RefObject<HTMLDivElement | null>`), `setMessageRef: (index: number, el: HTMLDivElement | null) => void`, `isScrollButtonVisible: boolean`, `scrollToBottom: () => void`, and `armAnchor: (index: number) => void`. This signature SHALL be identical in shape and semantics to the current `apps/chat/src/hooks/conversation/useConversationScroll.ts` implementation, differing only in the generic message type.

#### Scenario: Consuming with a minimal message shape
- **WHEN** a consumer calls `useConversationScroll({ messages: [{ text: 'hi' }, { text: 'there' }], isAssistantTyping: false, conversationId: 'c1' })` where the message objects carry no `id` field
- **THEN** the hook compiles and runs without a TypeScript error and without accessing any property on the message objects

#### Scenario: Anchoring a new turn near the top
- **WHEN** a consumer calls `armAnchor(index)` for a given message index and then that message's DOM node is registered via `setMessageRef(index, el)` before the next render commits
- **THEN** the hook scrolls the container so that message's top aligns near the top of the viewport, reserving a temporary spacer if the content below the anchor is shorter than the remaining viewport height

#### Scenario: Scroll-to-bottom button visibility
- **WHEN** the distance between the bottom of the rendered content and the bottom of the visible container reaches at least 80 pixels
- **THEN** `isScrollButtonVisible` becomes `true`, and calling `scrollToBottom()` scrolls the container to the current bottom of the content and hides the button once within tolerance

#### Scenario: Preserving position while a response streams
- **WHEN** `isAssistantTyping` is `true` and the content inside `contentRef` grows (detected via `ResizeObserver`)
- **THEN** the hook does not force-scroll to the new bottom on every growth tick, and clamps any programmatic or user scroll so it cannot move past the maximum allowed scroll position implied by an active anchor spacer

### Requirement: Behavior parity with the extracted `apps/chat` hook
The extraction SHALL NOT change `apps/chat`'s observable scroll/anchor behavior. `apps/chat`'s conversation view SHALL consume `useConversationScroll` from `@epam/ai-dial-chat-hooks` instead of a local copy, passing its existing `Message[]` array directly (no adapter/mapping required).

#### Scenario: Existing apps/chat test suite still passes
- **WHEN** the test suite that previously lived at `apps/chat/src/hooks/conversation/tests/useConversationScroll.spec.tsx` is moved and adapted to import from `@epam/ai-dial-chat-hooks`
- **THEN** all its existing assertions (anchor scrolling, spacer clamping, scroll-button visibility, bottom-follow on non-streaming updates) pass unchanged against the extracted hook

#### Scenario: No duplicate implementation remains
- **WHEN** the extraction is complete
- **THEN** `apps/chat/src/hooks/conversation/useConversationScroll.ts` no longer exists, and exactly one implementation of this scroll-anchoring logic exists in the repository, inside `libs/ai-dial-chat-hooks`
