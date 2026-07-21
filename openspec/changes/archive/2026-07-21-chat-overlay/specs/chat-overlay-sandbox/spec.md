## ADDED Requirements

### Requirement: Sandbox is a React + Vite Nx app, not a ported Next.js app

`apps/chat-overlay-sandbox` SHALL be an Nx application generated with this repo's standard React + Vite application generator (matching `apps/chat`'s toolchain: Vite 8, React 19, Vitest for tests), NOT a Next.js app. It SHALL depend on `@epam/ai-dial-chat-overlay` via the workspace package name, not by importing `libs/chat-overlay/src` directly from application source. In workspace dev/build, the sandbox bundler MAY resolve that package name to the current workspace source so local sandbox runs cannot load stale package output.

#### Scenario: Sandbox imports the package path

- **WHEN** `apps/chat-overlay-sandbox/src/**` is inspected for its `ChatOverlay`/`ChatOverlayManager` imports
- **THEN** it imports from `@epam/ai-dial-chat-overlay`, not a relative path into `libs/chat-overlay/src`

#### Scenario: Sandbox resolves the current workspace overlay source

- **WHEN** the sandbox is served or built inside this Nx workspace
- **THEN** the bundler resolves `@epam/ai-dial-chat-overlay` to the current workspace source rather than a stale local `dist` artifact
- **AND** the sandbox source files still import `@epam/ai-dial-chat-overlay` by package name

#### Scenario: Sandbox builds and serves via Nx

- **WHEN** `npm exec nx serve chat-overlay-sandbox` is run
- **THEN** a Vite dev server starts serving the sandbox app

### Requirement: Sandbox host URL is configured via a Vite-prefixed env var

The sandbox SHALL read the chat app's overlay host URL from `import.meta.env.VITE_CHAT_OVERLAY_HOST`, documented in an `apps/chat-overlay-sandbox/.env.development` (or equivalent) file, since only `VITE_`-prefixed variables are exposed to client-side Vite code in this repo's toolchain.

#### Scenario: Missing env var fails fast with a clear message

- **WHEN** `VITE_CHAT_OVERLAY_HOST` is unset and the sandbox attempts to construct a `ChatOverlay`
- **THEN** the sandbox surfaces a visible message naming the missing env var, rather than silently constructing an iframe with an empty `src`

### Requirement: Sandbox exercises both ChatOverlay and ChatOverlayManager

The sandbox SHALL provide at least one case using `ChatOverlay` directly and at least one case using `ChatOverlayManager`, each demonstrating: `ready()` -> `getMessages()` -> `sendMessage()`; a `setOverlayOptions` call changing `theme` and `modelId` after initial load; `setInputContent`; `setSystemPrompt`; `setTemperature`; a `loaderHideEvent` override; and subscription to `GPT_START_GENERATING`/`GPT_END_GENERATING`/`STOP_GENERATING`/`SELECTED_CONVERSATION_LOADED`/`CONVERSATIONS_UPDATED`. The `ChatOverlayManager` case SHALL additionally demonstrate `position`, `showOverlay`/`hideOverlay`, `removeOverlay`, and fullscreen open (when `allowFullscreen` is set).

#### Scenario: Direct ChatOverlay case demonstrates the v1 method surface

- **WHEN** the direct-overlay sandbox case is opened and its "Send message" and "Get messages" actions are used after `ready()` resolves
- **THEN** the sent message appears in the conversation and the retrieved messages include it

#### Scenario: ChatOverlayManager case demonstrates show/hide/remove

- **WHEN** the manager sandbox case's show, hide, and remove controls are used in sequence
- **THEN** the overlay becomes visible, then hidden, then its DOM is removed and its toggle button disappears

#### Scenario: Deferred methods are not presented as available

- **WHEN** the sandbox's case list is inspected
- **THEN** it does not present a case for conversation create/rename/delete/select, playback, import/export, or custom message buttons - these remain out of scope for this change

### Requirement: Case wiring is covered by automated component tests

Each sandbox case wrapper component SHALL have a Vitest component test (co-located `tests/` folder, matching this repo's component-test convention) asserting that it constructs `ChatOverlay`/`ChatOverlayManager` with the expected options for that case, using a mocked/faked iframe (no real network or real chat backend). Deeper protocol behavior (handshake, timeouts, origin checks) is covered by `libs/chat-overlay`'s own unit tests (`chat-overlay-protocol`) and is not re-tested here - this capability's automated coverage verifies wiring/configuration, not protocol correctness. Real end-to-end browser verification against a live `apps/chat` instance is not established by this change (no existing e2e harness in this repo) and is out of scope.

#### Scenario: Case wrapper test asserts constructed options

- **WHEN** the Vitest test for the "model/theme update" case runs
- **THEN** it asserts a `ChatOverlay` (or manager) instance was constructed/updated with the case's documented `theme`/`modelId` values, via a mocked constructor

#### Scenario: No new e2e harness is introduced

- **WHEN** the change's affected-projects list is reviewed
- **THEN** it does not add a Playwright (or other browser e2e) configuration as part of this change
