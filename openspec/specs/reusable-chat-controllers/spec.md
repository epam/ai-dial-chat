# Reusable chat controllers Specification

## Purpose

Define reusable chat controllers and utilities, their host integration boundaries, lifecycle guarantees and independent package-consumption contracts.

## Requirements

### Requirement: Public controller ownership and host isolation

The owning packages SHALL expose reusable implementations for all ten extracted controllers through documented public entries and export their reachable option/result types. `chat-hooks` SHALL contain only non-rendering code and SHALL NOT import app contexts, routing, auth/session/environment, translation engines, feature hooks or UI components. Hosts SHALL supply API callbacks, identity values, ID policy, URL resolvers, labels/events, storage ports and numeric layout policy. Existing package exports SHALL remain compatible.

No backend endpoint, generated-client change, new feature flag, telemetry event or persistent cache SHALL be introduced. Existing host feature gates, labels, keyboard/focus behavior, ARIA feedback and RTL layout SHALL remain unchanged. Hooks SHALL keep public callbacks stable where list refreshes do not require identity changes and SHALL invalidate asynchronous results on lifetime changes.

#### Scenario: Independent host uses controllers

- **WHEN** a host supplies structural data and callbacks without parent providers
- **THEN** the controllers execute without app imports, implicit client configuration, route knowledge or storage namespaces

### Requirement: Browser download operation

`chat-hooks/utils` SHALL export `triggerBrowserDownload(response, fallbackName, destination)`, preserving the operation currently exposed by `apps/chat/src/utils/file-download.ts`. The operation SHALL own no persistent state and SHALL return the saved filename. Response acquisition and picker opening SHALL remain host-owned.

#### Scenario: UTF-8 header filename

- **WHEN** a blob download has valid `filename*=UTF-8''...` and a plain filename fallback
- **THEN** the decoded extended filename wins, path separators are stripped, and a malformed extended value falls back to the plain filename or supplied fallback

#### Scenario: Stream and cancellation

- **WHEN** a prepared destination is cancelled, a stream, or a stream with no readable body
- **THEN** cancellation performs no download, a valid stream pipes to the supplied writable, and a missing body aborts the writable and rejects; stream writes use the prepared fallback name

### Requirement: Reusable scheduled-run grouping

`chat-hooks/conversation` SHALL export one-shot grouping and its two phases: `groupScheduledTaskConversations` and `applyActiveScheduledTaskRun`. Host callbacks SHALL determine group identity, collapsibility and ID equality; the library SHALL NOT assume an ID prefix or owner format. Grouping SHALL be an immutable display derivation, not provider state or a network operation. The parent adapter in `apps/chat/src/utils/collapse-scheduled-task-conversations.ts` SHALL preserve its existing API and grouping policy.

#### Scenario: Two resource ID conventions

- **WHEN** hosts group equivalent runs using resource-prefixed IDs or bucket-first IDs with their respective callbacks
- **THEN** each host gets one newest representative per owner/task, pinned/shared/published rows remain visible under the parent's eligibility policy, and tasks with equal schedule IDs but different owners stay separate

#### Scenario: Older active run and stable references

- **WHEN** an active run is older than its group's representative
- **THEN** the active run replaces that representative at its original relative position without mutating the input
- **AND** absent, unmatched or already-representative active IDs return the same collapsed array reference; newest ordering uses createdAt, updatedAt, then descending ID as in the parent

### Requirement: Bounded conversation discovery

`chat-hooks/conversation` SHALL export `useConversationDiscovery` with items, refresh, opaque session key, ID normalizer, error callback and retry policy inputs. Its hook instance SHALL own pending IDs, the timer and in-flight retry state. The provider SHALL retain ownership of the complete list and identity, adapting through `apps/chat/src/hooks/conversation/useConversationDiscovery.ts`. Defaults SHALL remain five additional retries, two seconds after each request settles.

#### Scenario: Duplicate callers and eventual discovery

- **WHEN** callers announce the same missing ID repeatedly and another missing ID concurrently
- **THEN** IDs are normalized and share one retry timer, duplicate calls do not reset budgets, retry requests do not overlap, and an ID stops retrying once listed or exhausted

#### Scenario: Session retirement and errors

- **WHEN** the session changes, the hook unmounts, or a retry refresh rejects
- **THEN** retired work cannot schedule another retry; retry errors are reported through the supplied callback without unhandled rejection and remain budget-bounded
- **AND** an initial refresh rejection remains observable to its caller, and refresh without expected IDs creates no retry loop

### Requirement: Selected skill name resolution

`chat-hooks/scheduled-tasks` SHALL export `useScheduledTaskSkillDisplayNames` accepting selected URLs, listed metadata and a metadata loader with AbortSignal. It SHALL own only selection-scoped results; the adapter in `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskSkillDisplayNames.ts` SHALL provide contexts and API calls. There SHALL be no shared cache or TTL: results are invalidated by selection/listing changes or unmount.

#### Scenario: Partial metadata availability

- **WHEN** some selected URLs have listed names, some resolve remotely and others fail or cannot be parsed
- **THEN** results preserve selected order, prefer listed names, use successful metadata for missing names, and retain each unavailable URL as its fallback

#### Scenario: Selection changes while loading

- **WHEN** selection changes or the caller unmounts before metadata resolves
- **THEN** obsolete requests are aborted where supported and their results cannot update the current selection

### Requirement: Promise-based skill file selection

`chat-hooks/skill-editor` SHALL export a headless `useSkillFileSystemPicker` controller owning modal-open state, the pending selection promise and attempt lifetime. It SHALL accept file materialization and error callbacks, expose pick/attach/close operations, and never render a modal. The host adapter in `apps/chat/src/hooks/skills/useSkillFileSystemPicker.ts` SHALL keep download configuration, path/root-label resolution and notifications.

#### Scenario: Attach and failure

- **WHEN** the host attaches selected files and folders
- **THEN** only file items are materialized, successful entries resolve in selection order, and failure reports through the callback and settles the active selection without leaving a pending promise

#### Scenario: A stale download cannot complete a newer pick

- **WHEN** a new pick, close or unmount supersedes an attempt whose downloads are pending
- **THEN** the old selection resolves as cancelled, obsolete downloads are aborted where supported, and their later success or error cannot complete or notify on behalf of the new attempt

### Requirement: Canvas request coordination is scoped to the canvas

`attachment-canvas` SHALL provide `useLatestCanvasRequest` backed by its existing canvas-provider lifetime. All callers for one canvas SHALL share request ordering; independent canvas providers SHALL NOT invalidate each other. The app adapter in `apps/chat/src/hooks/attachment/useLatestCanvasRequest.ts` SHALL delegate to that implementation. A request guard SHALL be false after caller unmount or any newer request within its canvas.

#### Scenario: Cross-source ordering

- **WHEN** a source preview starts after a message preview under the same canvas and resolves first
- **THEN** the earlier message preview cannot replace the newer canvas content, including when the newer request opens synchronously

#### Scenario: Independent embedded canvases

- **WHEN** a second provider starts a preview while the first provider has a pending request
- **THEN** both requests remain eligible within their own provider lifetimes

### Requirement: File preview controller uses host canvas callbacks

`chat-hooks/file-manager-canvas` SHALL export `useDialFilePreview` accepting current tree/search results, bucket, extension policy and callbacks for attachment opening, unsupported fallback, URL resolution and request guards. It SHALL NOT call feature-library hooks. The app adapter in `apps/chat/src/hooks/files/useDialFilePreview.ts` SHALL compose feature hooks and API resolvers. List refreshes SHALL update callback-observed data without unnecessarily changing preview callback identity.

#### Scenario: Search hit and unsupported file

- **WHEN** a preview target is found only in search results, or conversion/opening cannot render it
- **THEN** the controller uses the current file, ignores folders/missing paths, and opens the existing unsupported state with a resolved download URL when available
- **AND** a superseded or unmounted request cannot open a fallback or preview

### Requirement: Entity preselection is a headless state machine

`chat-hooks/conversation` SHALL export `useEntityPreselection`. The hook SHALL own arrival-snapshot and per-source transition state, accept parsed IDs, route-state precedence flags, enabled/disabled values, listings/loading/errors, loaders and application sinks, and return deployment-pending/override state. Typed consumption/outcome callbacks SHALL leave query cleanup and notifications to the host. The adapter in `apps/chat/src/hooks/useUrlEntityPreselection/useUrlEntityPreselection.ts` SHALL preserve existing URL preselection requirements.

#### Scenario: Sources wait and apply once

- **WHEN** deployment, skill and prompt IDs arrive before their data and router state supplies one of those sources
- **THEN** router state wins for that source, remaining sources wait for resolution and apply at most once, parameterized prompts use the supplied popup sink, and the pending deployment blocks default selection until settled

#### Scenario: Disabled or failed preselection

- **WHEN** preselection is disabled, a source is unknown, or loading fails
- **THEN** disabled mode has no application/notification/cleanup side effects; an enabled failed source emits the appropriate typed outcome and consumption event without retrying on every render
- **AND** host cleanup preserves unrelated query parameters, hash and router state, and stale async work cannot affect a new lifetime

#### Scenario: StrictMode replays prompt resolution effects

- **WHEN** React StrictMode replays effects for a requested prompt while prompts are unavailable
- **THEN** the unavailable outcome and prompt consumption event each occur once
- **AND** when prompts are available, aborting the replayed request does not prevent its replacement request from resolving and applying once

### Requirement: Attachment-result state is reusable

`chat-hooks/file-manager` SHALL export `useFileAttachmentModalState` accepting bucket and preview URL resolution. The hook SHALL own open/close state and pending attachments, converting selected files/folder paths with existing shared mappers. It SHALL remain separate from browsing state in `useFileAttachmentPicker`. The adapter in `apps/chat/src/hooks/files/useDialFileManagerState.ts` SHALL retain its signature.

#### Scenario: Consume and reopen

- **WHEN** a selection contains files and folders, then the composer consumes it and reopens the modal
- **THEN** attach closes the modal and exposes mapped pending attachments, the explicit clear operation removes them, and reopening does not restore consumed attachments

### Requirement: Canvas width derives from supplied policy

`chat-hooks/viewport-layout` SHALL export a pure `resolveCanvasWidth` with a named mode, viewport/mobile inputs, maximum width and numeric layout policy. It SHALL NOT know routes, app layout constants or sidebar state. The adapter in `apps/chat/src/utils/canvas-width.ts` SHALL preserve current route and breakpoint selection and provide those constants.

#### Scenario: Existing layout formulas

- **WHEN** a host provides the parent's existing numeric policy
- **THEN** mobile default width equals viewport width; bounded-panel default width is the rounded viewport share clamped to its policy range and maximum available width; conversation default width is round((maximum width + minimum-content budget) / 2), capped by maximum width
- **AND** minimum width is the supplied bounded-panel minimum in that mode and undefined in conversation mode

### Requirement: Persisted state uses a host storage port

`chat-hooks/utils` SHALL export `usePersistedState` with injected read/write behavior, key, codec and initial value. It SHALL own in-memory state, tolerate read/parse/write failures, and never select localStorage/sessionStorage or a user namespace. The adapter in `apps/chat/src/hooks/useLocalStorage.ts` SHALL preserve its existing contract and default export.

#### Scenario: Unavailable storage

- **WHEN** reading/parsing fails at mount or writing fails after a setter call
- **THEN** initial state falls back to the supplied default and later state updates remain usable in memory without throwing storage errors into UI

#### Scenario: Key changes retain mount initialization

- **WHEN** key or codec inputs change without remounting
- **THEN** the in-memory value is not automatically reloaded and subsequent writes use current inputs; a remount initializes from the new inputs

### Requirement: Parent adoption and packed artifacts prove the extraction

Each extracted item SHALL be called through a public export by the parent; adapters SHALL retain integration only. Existing named app paths SHALL remain valid where existing specs require them. Behavioral tests SHALL use injected callbacks, and independent packed-consumer fixtures SHALL separately verify JavaScript, declarations and dependency closure without workspace aliases. Utility entries SHALL preserve lazy feature-engine boundaries.

#### Scenario: Complete parent implementation

- **WHEN** all implementation tasks are marked complete
- **THEN** every one of the ten items has one active library implementation used by the parent, both ID adapters and async lifecycle scenarios are tested, and a real TypeScript check plus production bundle succeed against the packed public entries

### Requirement: Host integration guidance

`docs/reusable-chat-workflows.md` SHALL document the ten reusable controllers, their owning imports, required host adapters, aligned package dependencies and automated verification. It SHALL also describe the existing offline-login, usage-reset and conversation-source APIs. Package publication is outside this change.

#### Scenario: A host integrates the public APIs

- **WHEN** a host integrates the controllers from compatible package versions
- **THEN** the guide explains ID-policy injection, provider-scoped canvas coordination, storage codecs and async lifecycle boundaries
- **AND** existing APIs document OAuth object results and timeout handling, as well as the usage formatter's timezone policy, without treating them as new extractions
