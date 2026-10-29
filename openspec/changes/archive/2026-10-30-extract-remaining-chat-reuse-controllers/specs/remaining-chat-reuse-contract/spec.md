## ADDED Requirements

### Requirement: Public controllers preserve application boundaries

The reusable contracts SHALL be provided by existing `chat-hooks`, `quotations` and `chat-shared` packages. The app SHALL retain providers, routes, feature flags, translation, client configuration and external-system adapters. Libraries SHALL accept resolved data and typed callbacks, SHALL NOT read app contexts, and SHALL NOT create global mutable controller instances. `chat-hooks` SHALL NOT render components or invoke feature-library hooks. Existing public exports and call signatures SHALL remain compatible.

No new HTTP endpoints, OpenAPI operations, telemetry clients or feature flags SHALL be introduced. Existing enabled/role decisions SHALL be passed by the host. All new contracts are headless: no new i18n keys or direction-dependent UI; existing keyboard behavior, ARIA labels and live announcements SHALL be preserved by adapters. Stable callbacks, memoized grouping and memoized context values SHALL avoid invalidating consumers on unrelated renders.

#### Scenario: Two hosts compose the same controller

- **WHEN** independent hosts pass different identity scopes, routes, clients and translation callbacks
- **THEN** each instance operates only on its supplied values and neither reads or changes the other's state

### Requirement: Generation registry is instance-scoped and navigation-safe

A public `createGenerationRegistry` SHALL own entries keyed by exact opaque conversation paths and expose startGeneration, completeGeneration, getGeneration and hasActiveGeneration. Starting on a path SHALL abort its prior active controller only. Completion SHALL affect an entry only if generationId matches. `GenerationProvider` in `apps/chat/src/context/GenerationContext.tsx` SHALL retain one factory result in a ref above routed conversations; registry updates SHALL NOT cause reactive renders. No automatic abort on route unmount or effect replay SHALL be added.

#### Scenario: An obsolete completion cannot finish a replacement

- **WHEN** a second generation replaces an active first generation on the same path and the first completes later
- **THEN** only the first controller was aborted and the second entry remains active

#### Scenario: Independent registries and paths

- **WHEN** two registries use the same path and one starts a replacement, or one registry starts on a different path
- **THEN** unrelated controllers remain untouched and active generation queries remain instance-local

### Requirement: Active-task classification and detail loading are reusable

A pure resolver SHALL accept host-supplied route identity, list/loading state, enabled flag and ID matcher and return resolving, not-a-task or task metadata. A shared details hook SHALL own idle/loading/success/unavailable/error state, task, error and retry, taking scheduleId and a task-loading callback with cancellation. A 404 SHALL yield unavailable; other failures SHALL yield error. `ActiveScheduledTaskProvider` in `apps/chat/src/context/ActiveScheduledTaskContext.tsx` SHALL compose this with existing run history once for all consumers. Route traversal validation and feature gating remain host-owned.

#### Scenario: Navigation supersedes detail loading

- **WHEN** task A is loading and the host switches to task B, disables the feature, or unmounts
- **THEN** late A completion is ignored even if the callback did not honor abort

#### Scenario: Run changes and retry

- **WHEN** runId changes under the same scheduleId
- **THEN** task details are not fetched again
- **WHEN** the host explicitly retries an unavailable or failed task
- **THEN** exactly one new detail attempt starts for the current scheduleId

### Requirement: Title reconciliation supports JSON and incremental transports

The shared title controller SHALL own revisions, known titles, protection deadlines, deletion tombstones and pending deletions. The app adapter in `apps/chat/src/hooks/conversation/useConversationTitleEnrichment.ts` SHALL supply identity scope, exact IDs, transport callbacks, list sink, clock and scheduling policy. JSON-only transport SHALL work without a streaming dependency; the parent SHALL retain its current incremental transport, visible-first ordering, bounded buffering and unsupported-stream fallback. Wire parsing and endpoint knowledge SHALL remain in the app.

The cache SHALL be in-memory per instance and identity scope, keyed by exact resource ID; no external cache key or persisted storage is introduced. Local-write protection SHALL expire after the supplied duration (the parent supplies 315000 ms). Noncurrent rows SHALL be pruned, identity change SHALL clear all caches and cancel requests, and unmount SHALL retire requests. Pending deletions SHALL survive older snapshots; restore SHALL remove the tombstone. IDs SHALL NOT be decoded or conflated. Snapshot application and incremental emissions SHALL use the same revision guard.

#### Scenario: Local rename or deletion overtakes remote results

- **WHEN** a title response or list snapshot started before a local rename/delete arrives later
- **THEN** it neither replaces the protected local title nor resurrects a deleted row
- **WHEN** deletion is rolled back or local protection expires
- **THEN** restore or a newer authoritative update can be applied according to the current revision

#### Scenario: JSON-only consumer

- **WHEN** a host supplies only the JSON transport with batch size 25
- **THEN** exact resource IDs are fetched in sequential bounded batches and an attempt stops after failure instead of sending every remaining batch

#### Scenario: Parent streaming remains bounded

- **WHEN** visible IDs are registered and the stream emits many title updates or reports unsupported transport
- **THEN** configured count/byte/flush bounds and visible-first scheduling are retained, JSON fallback uses the same reconciliation guards, and stale streams cannot update a newer scope

### Requirement: Preview synchronization respects resource and canvas ownership

A shared skill-preview controller SHALL accept selected file/content, content revision, resource-scoped opaque canvas key, canvas snapshot and open/close/request-guard callbacks. It SHALL expose presentation state and explicit retry. The app adapter in `apps/chat/src/hooks/attachment/useSkillFilePreviewSync.ts` SHALL invoke feature hooks and resolve manifest/folder selection; the shared controller SHALL reuse existing attachment conversion and SHALL NOT fetch file bytes.

Each open SHALL use the supplied provider-scoped arbitration predicate plus local selection/mount validity. Failed selection SHALL remain failed without automatic reopen until retry or a new selection/revision. Closing on empty selection or cleanup SHALL occur only while this controller owns the canvas; another caller's newer preview SHALL remain open.

#### Scenario: Replaced bytes and repeated paths

- **WHEN** contentRevision changes for the selected file, or the same relative path belongs to another resource key
- **THEN** the current bytes are opened for that resource rather than reusing an unrelated preview

#### Scenario: Late completion and ownership transfer

- **WHEN** A→B→A selection or another canvas caller supersedes an open, followed by a late completion or unmount
- **THEN** the stale operation cannot commit content, record a current failure or close the new owner's canvas

#### Scenario: Retry settles a failure

- **WHEN** open rejects or reports unsupported content
- **THEN** the controller exposes error without a reopen loop
- **WHEN** the host requests retry
- **THEN** one new attempt is made for the current selection

### Requirement: External-service login reuses the existing OAuth protocol

The public external-service login hook SHALL compose typed service get/sign-in/sign-out, offline status/login and callbackPath inputs. It SHALL support OAuth, API key and DIAL-native authentication, preserve credentials level and offline consent, and accept a reserved popup. Without a reserved popup, it SHALL open one synchronously before awaiting service metadata. It SHALL reuse existing popup correlation and handshake primitives rather than introduce a second protocol. Credentials SHALL NOT be logged or persisted by the new controller.

Stale logout SHALL be best-effort. An ambiguous popup cancellation SHALL be rechecked against authoritative service status. DIAL-native login SHALL check app consent before and after offline login. API keys SHALL be trimmed. Outcomes SHALL preserve success/failure/cancelled/popup-blocked/admin-consent-required/offline-unavailable behavior; timeout SHALL NOT become success absent successful authoritative verification. Failed preconditions and exceptions SHALL close the owned popup.

Code exchange SHALL remain in `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx` and dispatch by resource kind. The parent adapter SHALL continue to call the external-service exchange for ExternalService rather than the toolset exchange.

#### Scenario: Reserved popup and stale credentials

- **WHEN** a host supplies a popup opened during a gesture and stale logout fails
- **THEN** the same popup is used, no second popup is opened and login can proceed

#### Scenario: Ambiguous cancel and consent changes

- **WHEN** popup tracking reports cancellation but a fresh status reports signed in
- **THEN** login can succeed from that authoritative status
- **WHEN** app consent is missing before or after DIAL-native login
- **THEN** the corresponding non-success outcome is returned without claiming login success

#### Scenario: Correct callback exchange

- **WHEN** an ExternalService OAuth callback completes
- **THEN** the app dispatches the code to its external-service adapter with the preserved scope, credentials level and consent, not to the toolset adapter

### Requirement: Deployment tracking distinguishes restoration from user changes

A shared tracking hook SHALL accept conversation identity, loaded state, selected deployment and a stable change callback. It SHALL reset the baseline when identity changes or the conversation unloads, including a direct loaded-to-loaded switch. Initial restoration, equal selections and null selection SHALL not emit a user-change message. The host SHALL retain context lookup, `createDeploymentChangedMessage` integration and persistence through its existing `apps/chat/src/hooks/useDeploymentChangeEffect.ts` adapter.

#### Scenario: Direct conversation switch

- **WHEN** a loaded conversation A switches directly to loaded B with a different restored deployment
- **THEN** no model-change message is emitted for the restoration
- **WHEN** the user subsequently selects another deployment in B
- **THEN** one change notification contains the correct previous and next IDs

### Requirement: Annotation grouping accepts unknown input without persisted-schema knowledge

`quotations` SHALL export a memoized html-tag annotation grouping hook accepting unknown input. It SHALL reject non-arrays and invalid entries, retain supported html_tag selectors and call existing groupAnnotationsByCitId. Empty results SHALL use a stable shared empty reference; unchanged input SHALL preserve result identity. The app adapter in `apps/chat/src/hooks/conversation/useConversationAnnotationPool.ts` SHALL extract persisted customViewState annotations and handle a missing conversation before delegation.

#### Scenario: Malformed persisted annotations

- **WHEN** input is absent, non-array, contains nulls or contains non-html-tag selectors
- **THEN** invalid entries are ignored without throwing, and supported entries are grouped normally

#### Scenario: Memoization across unrelated renders

- **WHEN** input identity remains unchanged or no valid annotation exists
- **THEN** the returned grouping reference remains stable

### Requirement: Conversation transfer rows have a distinct mapper

`chat-shared` SHALL publicly export toConversationTransferQueueItems for readonly conversation transfer jobs and error/warning message resolvers. It SHALL preserve job ID, file name, mapped status and percent without mutation; only failed rows call the error resolver and only warning rows call the warning resolver with warningNames. App translation-key selection remains in `apps/chat/src/utils/conversation-transfer.ts`. Existing file-manager toTransferQueueItems semantics SHALL remain unchanged and public names SHALL NOT collide.

#### Scenario: Every transfer outcome

- **WHEN** in-progress, successful, cancelled, failed and warning conversation jobs are mapped
- **THEN** each row retains its identity/progress and only the appropriate error or warning resolver is called, including for missing codes

### Requirement: Transcription exposes optional upload MIME normalization

The existing shared useTranscribeAudio SHALL accept an optional uploadMimeTypePolicy with preserve as the default and normalize as opt-in. In preserve mode the uploaded File SHALL remain unchanged. In normalize mode MIME parameters SHALL be removed using existing normalizeMimeType; bytes, name and lastModified SHALL be preserved and already-normalized files SHALL not require reconstruction. Both modes SHALL continue to normalize transcription metadata, enforce abort/size checks before upload, upload once and reuse the URL for recognition retries. Host ASR selection and error translation remain local.

#### Scenario: Normalized upload without content loss

- **WHEN** a host opts into normalize for a File of type audio/webm;codecs=opus
- **THEN** upload and transcription metadata use audio/webm while bytes, name and lastModified are unchanged

#### Scenario: Existing caller stays compatible

- **WHEN** an existing caller omits the new option
- **THEN** upload uses the original File and existing normalized transcription metadata behavior is retained

### Requirement: Parent adoption and artifact consumption prove extraction

Each B1–B8 algorithm SHALL have one shared implementation used by the parent app through public exports. `tools/reusable-workflows-consumer-fixture/scripts/run.mjs` SHALL install packed artifacts and their declared transitive closure outside the workspace and exercise all new APIs plus the compatibility options. The fixture SHALL use no source aliases, private module imports, workspace ancestor node_modules fallback or dependency overrides. Instance isolation, cancellation-sensitive operations and both title transports SHALL have executable coverage; library/unit suites can supply deterministic transport fakes.

READMEs SHALL describe host callbacks, state ownership, default/opt-in policies. A1 SHALL not be reimplemented.

#### Scenario: Published export rather than source alias

- **WHEN** the isolated consumer imports the new root/subpath APIs, typechecks and bundles
- **THEN** resolution succeeds solely from installed package exports/declarations and declared dependencies

#### Scenario: Host compatibility recipe

- **WHEN** a host follows the documented JSON-only title, resource-key preview, normalized-upload and reset-instant recipes
- **THEN** the public contracts support those choices without copying parent controller algorithms or changing parent defaults
