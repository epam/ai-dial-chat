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

### Requirement: Sandbox controls use the shared UI Kit and Tailwind

All sandbox-owned buttons SHALL use button components exported by `@epam/ai-dial-ui-kit`. Text inputs and selectors SHALL use `Input` and `SelectField` so the developer playground exercises the same controls as the main application. Sandbox layout and presentation SHALL be authored with mobile-first Tailwind utility classes, using the workspace `mobile`/`desktop` breakpoints and logical direction utilities. A CSS entry file MAY remain solely to load the Tailwind layers and the UI Kit's published stylesheet; it SHALL NOT contain sandbox-specific selector rules.

#### Scenario: No native sandbox controls remain

- **WHEN** the sandbox source components are inspected
- **THEN** they contain no native `<button>`, `<input>`, or `<select>` elements owned by the sandbox
- **AND** actions use UI Kit button components while text and selection fields use `Input` and `SelectField`

#### Scenario: Presentation is colocated as Tailwind utilities

- **WHEN** sandbox-specific layout and visual styling is inspected
- **THEN** it is expressed through Tailwind utility classes in the React components
- **AND** the Tailwind entry stylesheet contains no custom selectors

#### Scenario: Controls remain usable across viewport sizes and directions

- **WHEN** a case is rendered on mobile, desktop, or under an RTL document direction
- **THEN** controls retain at least a 44px touch target, responsive layouts use the named `desktop` breakpoint, and directional positioning uses logical start/end utilities

### Requirement: Sandbox host URL is configured via a Vite-prefixed env var

The sandbox SHALL read the chat app's overlay host URL from `import.meta.env.VITE_CHAT_OVERLAY_HOST`, documented in an `apps/chat-overlay-sandbox/.env.development` (or equivalent) file, since only `VITE_`-prefixed variables are exposed to client-side Vite code in this repo's toolchain.

#### Scenario: Missing env var fails fast with a clear message

- **WHEN** `VITE_CHAT_OVERLAY_HOST` is unset and the sandbox attempts to construct a `ChatOverlay`
- **THEN** the sandbox surfaces a visible message naming the missing env var, rather than silently constructing an iframe with an empty `src`

### Requirement: Sandbox exercises both ChatOverlay and ChatOverlayManager

The sandbox SHALL provide at least one case using `ChatOverlay` directly and at least one case using `ChatOverlayManager`, each demonstrating: `ready()` -> `getMessages()` -> `sendMessage()`; a `setOverlayOptions` call changing `theme` and `modelId` after initial load; `setInputContent`; `setSystemPrompt`; `setTemperature`; a `loaderHideEvent` override; and subscription to `GPT_START_GENERATING`/`GPT_END_GENERATING`/`STOP_GENERATING`/`SELECTED_CONVERSATION_LOADED`/`CONVERSATIONS_UPDATED`. The `ChatOverlayManager` case SHALL additionally demonstrate `position`, `showOverlay`/`hideOverlay`, `removeOverlay`, and fullscreen open (when `allowFullscreen` is set). The conversation-list methods (`getConversations`, `getSelectedConversations`, `selectConversation`, `createConversation`, `createLocalConversation`, `deleteConversation`, `renameConversation`) are demonstrated by the dedicated case added by this change (see below), not by these two existing cases — they stay chat-method-only.

#### Scenario: Direct ChatOverlay case demonstrates the v1 method surface

- **WHEN** the direct-overlay sandbox case is opened and its "Send message" and "Get messages" actions are used after `ready()` resolves
- **THEN** the sent message appears in the conversation and the retrieved messages include it

#### Scenario: ChatOverlayManager case demonstrates show/hide/remove

- **WHEN** the manager sandbox case's show, hide, and remove controls are used in sequence
- **THEN** the overlay becomes visible, then hidden, then its DOM is removed and its toggle button disappears

#### Scenario: Still-deferred methods are not presented anywhere in the sandbox

- **WHEN** the sandbox's case list and every case's controls are inspected
- **THEN** none of them presents an action for playback conversations, import/export, or custom message buttons — these remain out of scope for this change

### Requirement: Direct and Manager request failures are observable

Every promise-returning overlay request action exposed by the Direct ChatOverlay and ChatOverlayManager cases (`getMessages`, `sendMessage`, `setOverlayOptions`, `setInputContent`, `setSystemPrompt`, and `setTemperature`) SHALL handle a rejected promise without producing an unhandled-promise error. The case SHALL write one diagnostic containing the action name and the original error message to both `console.error` and its `EventLog`. Structured `ChatOverlayRequestError` details, including codes such as `ACTIVE_CONVERSATION_UNAVAILABLE`, SHALL remain visible in that diagnostic.

#### Scenario: Empty-composer error appears immediately in Event log

- **WHEN** the Direct case is ready on the empty composer and the user selects "Get messages"
- **AND** the library rejects with `ChatOverlayRequestError` code `ACTIVE_CONVERSATION_UNAVAILABLE`
- **THEN** the Event log receives an entry containing `getMessages`, `ACTIVE_CONVERSATION_UNAVAILABLE`, and the explanatory message
- **AND** no unhandled promise rejection is emitted

#### Scenario: Manager action reports the same diagnostic

- **WHEN** a request action in the ChatOverlayManager case rejects
- **THEN** the action name and original error message are written to that case's Event log and to `console.error`

#### Scenario: Rejection logging is covered by a component test

- **WHEN** the Direct case component test mocks `getMessages()` to reject and invokes its control
- **THEN** the test observes the error in both the Event log and `console.error`

### Requirement: Case wiring is covered by automated component tests

Each sandbox case wrapper component SHALL have a Vitest component test (co-located `tests/` folder, matching this repo's component-test convention) asserting that it constructs `ChatOverlay`/`ChatOverlayManager` with the expected options for that case, using a mocked/faked iframe (no real network or real chat backend). Deeper protocol behavior (handshake, timeouts, origin checks) is covered by `libs/chat-overlay`'s own unit tests (`chat-overlay-protocol`) and is not re-tested here - this capability's automated coverage verifies wiring/configuration, not protocol correctness. Real end-to-end browser verification against a live `apps/chat` instance is not established by this change (no existing e2e harness in this repo) and is out of scope.

#### Scenario: Case wrapper test asserts constructed options

- **WHEN** the Vitest test for the "model/theme update" case runs
- **THEN** it asserts a `ChatOverlay` (or manager) instance was constructed/updated with the case's documented `theme`/`modelId` values, via a mocked constructor

#### Scenario: No new e2e harness is introduced

- **WHEN** the change's affected-projects list is reviewed
- **THEN** it does not add a Playwright (or other browser e2e) configuration as part of this change

### Requirement: A dedicated case exercises all seven conversation-list methods

The sandbox SHALL provide a case (or case section) — reachable from the case index alongside the existing "Direct ChatOverlay case" and "ChatOverlayManager case" entries — demonstrating all seven conversation-list methods through both a direct `ChatOverlay` instance and a `ChatOverlayManager`-managed overlay. At minimum it SHALL provide:

- A "Get conversations" action that logs the JSON response.
- A "Get selected conversations" action that logs the JSON response.
- A "Create conversation" action with an optional deployment-id input and an optional first-message input, calling `createConversation({ deploymentId, firstMessage })` with either field omitted when left blank — demonstrating both the persist-immediately path (first message provided) and the composer-opening path (first message left blank).
- A "Create local conversation" action calling `createLocalConversation()` with no inputs.
- A conversation-id input, populated/selectable from the most recent "Get conversations" result, used by the select/rename/delete actions below.
- A "Select conversation by id" action.
- A "Rename conversation by id" action with a new-name text input.
- A "Delete conversation by id" action.
- A "Refresh list" action that re-runs "Get conversations" and updates the sandbox's own local id list/selector.
- An event/response log using the existing `EventLog` component pattern, logging every request's JSON response including `error` fields when present.

Imports SHALL come from `@epam/ai-dial-chat-overlay`, matching the existing two cases — not a relative path into `libs/chat-overlay/src`.

#### Scenario: Case is reachable from the sandbox index

- **WHEN** the sandbox's landing page (`apps/chat-overlay-sandbox/src/app/app.tsx`) is inspected
- **THEN** it lists a case for conversation-list methods alongside "Direct ChatOverlay case" and "ChatOverlayManager case"

#### Scenario: Create with a first message persists and appears in a subsequent Get conversations call

- **WHEN** the case's "Create conversation" action is used with a first-message value filled in, followed by "Refresh list"
- **THEN** the newly created conversation appears in the refreshed list

#### Scenario: Create with no first message opens the composer without appearing in the list

- **WHEN** the case's "Create conversation" action is used with the first-message input left blank, followed by "Refresh list"
- **THEN** the embedded app navigates to its composer view, the response log shows `{ conversation: null }`, and the refreshed list is unchanged

#### Scenario: Delete/rename error responses are visible in the log

- **WHEN** "Delete conversation by id" or "Rename conversation by id" is used with an id that the case's own state no longer has access to (e.g. already deleted)
- **THEN** the event log shows the response's `error` field rather than the case silently doing nothing

#### Scenario: Both direct and manager paths are exercised

- **WHEN** the conversation-list case's Direct and Manager sections are each used to call `getConversations()`
- **THEN** both the plain `ChatOverlay` instance and the `ChatOverlayManager`-managed instance return a response, verifying the manager's `overlayId`-forwarding for all seven new methods

### Requirement: Case wiring for the new case is covered by automated component tests

The conversation-list case wrapper component(s) SHALL have a Vitest component test (co-located `tests/` folder) asserting that each of the seven actions invokes the corresponding `ChatOverlay`/`ChatOverlayManager` method with the expected arguments, using a mocked/faked overlay instance (no real iframe/network) — following the same pattern the existing `DirectOverlayCase`/`ManagerOverlayCase` tests already use for the v1 methods.

#### Scenario: Test asserts the create-with-firstMessage call shape

- **WHEN** the conversation-list case's Vitest test simulates filling in a first message and clicking "Create conversation"
- **THEN** it asserts the mocked `createConversation` was called with `{ deploymentId: ..., firstMessage: '...' }` matching the form's current values

### Requirement: A dedicated case exercises enabledFeatures through both ChatOverlay and ChatOverlayManager

The sandbox SHALL provide a case (or case section) — reachable from the case index alongside the existing cases — demonstrating `enabledFeatures` replacement through both a direct `ChatOverlay` instance and a `ChatOverlayManager`-managed overlay. At minimum it SHALL provide:

- A set of preset buttons for common combinations (e.g. "All defaults", "Header + sharing only", "Empty set") that call `setOverlayOptions({ enabledFeatures: [...] })` with a fixed array.
- A free-text/checkbox input for a custom comma-separated or multi-select list of feature keys, normalized to an array before calling `setOverlayOptions`.
- A response log (the existing `EventLog` component pattern) showing the `SetOverlayOptionsResponse` (`applied`) for each call.
- At least one preset that intentionally includes an unrecognized value, to demonstrate the "filtered with a warning, still applied" behavior from `ui-feature-toggles`.

Imports SHALL come from `@epam/ai-dial-chat-overlay`, matching the existing cases.

#### Scenario: Case is reachable from the sandbox index

- **WHEN** the sandbox's landing page (`apps/chat-overlay-sandbox/src/app/app.tsx`) is inspected
- **THEN** it lists a case for `enabledFeatures` alongside the existing cases

#### Scenario: Preset replaces the effective feature set

- **WHEN** the "Header + sharing only" preset is used
- **THEN** the embedded app's visible UI reflects only the header and sharing-related surfaces enabled by that preset, and the response log shows `{ applied: true }`

#### Scenario: Preset with an unrecognized value still applies the recognized subset

- **WHEN** the preset containing an intentionally-invalid feature key is used
- **THEN** the response log shows `{ applied: true }`, and the embedded app's visible UI reflects only the recognized keys from that preset

#### Scenario: Both direct and manager paths are exercised

- **WHEN** the `enabledFeatures` case's Direct and Manager sections are each used to apply the same preset
- **THEN** both the plain `ChatOverlay` instance and the `ChatOverlayManager`-managed instance reflect the change, verifying the manager's forwarding of the expanded `setOverlayOptions` shape

### Requirement: Case wiring for the enabledFeatures case is covered by automated component tests

The `enabledFeatures` case wrapper component(s) SHALL have a Vitest component test (co-located `tests/` folder) asserting that each preset and the custom-input path calls the mocked `ChatOverlay`/`ChatOverlayManager` `setOverlayOptions` with the expected `enabledFeatures` array, using a mocked/faked overlay instance (no real iframe/network) — following the same pattern as the existing case tests.

#### Scenario: Test asserts the preset call shape

- **WHEN** the `enabledFeatures` case's Vitest test simulates clicking the "Header + sharing only" preset
- **THEN** it asserts the mocked `setOverlayOptions` was called with `{ enabledFeatures: [...] }` matching that preset's documented array
