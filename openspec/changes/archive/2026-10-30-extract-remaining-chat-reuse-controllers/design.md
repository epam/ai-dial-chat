## Context

This change supplies reusable APIs and integrates them into the application.

The closest pattern is the extracted `useConversationDiscovery` controller and its host adapter. Existing generation and active-task contexts remain state owners at the application composition level. Shared controllers own their internal instances. `AGENTS.md` Library isolation and `.claude/rules/libs.md` apply; no library-specific AGENTS.md was found under the three affected libraries. No module-boundary exception is requested.

## Goals / Non-Goals

**Goals:** Remove all B1–B8 algorithm copies from this app, preserve existing semantics, support public-artifact consumption, and provide reusable compatibility settings for A2/D.

**Non-Goals:** New providers/packages/backend endpoints; app-container relocation; changing permissions, auth exchange protocol, deployment routing, notification wording, UI layout or release automation. A1 is complete. No new strings, RTL changes or telemetry. Preserve existing feature gating at each adapter.

## Decisions

### 1. Add contracts to existing libraries and retain thin app adapters

Keep each app-facing export stable. Follow the original context lifetime, with a memoized context value and stable controller callbacks. Pure functions and non-rendering hooks go in `chat-hooks`; presentation-domain grouping/mapping goes in the feature/shared library that already owns its types. Reject a generic “application controller” or new global Context: those would couple independent lifecycles and increase rollback scope.

| Audit | Public API (proposed name) | Entry point | Host boundary |
| --- | --- | --- | --- |
| B1 | `createGenerationRegistry` | `chat-hooks/conversation` | `GenerationContext` stores one instance in a ref |
| B2 | `resolveActiveScheduledTask`, `useActiveScheduledTaskDetails` | `chat-hooks/scheduled-tasks` | Route parsing, ID matcher, enabled flag, client callback and history composition |
| B3 | `useConversationTitleEnrichmentController` | `chat-hooks/conversation` | Identity token, transport callbacks, viewport input, cache/batch/byte policy |
| B4 | `useSkillFilePreviewSyncController` | `chat-hooks/skill-editor` | Selection/node/bytes, resource key, canvas snapshot and open/close/guard callbacks |
| B5 | `useExternalServiceLogin` | new `chat-hooks/external-services` subpath | Callback path and get/sign-in/sign-out/offline operations |
| B6 | `useDeploymentChangeTracking` | `chat-hooks/conversation` | Selected id, conversation identity, loaded flag, status-message sink |
| B7 | `useHtmlTagAnnotationGroups` | `quotations` root | Extract persisted annotations before calling the hook |
| B8 | `toConversationTransferQueueItems` | `chat-shared` root | Translated error/warning resolvers |
| A2 | `uploadMimeTypePolicy` option | existing `useTranscribeAudio` | Host chooses preserve or normalize |
| D | `offsetPolicy` option | existing `formatUsageResetTime` | Host chooses current-offset or reset-instant |

B8 uses the existing root export rather than inventing a new subpath for one helper. It MUST NOT collide with the file-manager `toTransferQueueItems`. B5's subpath must be wired through package exports, build entry configuration and declarations; it is not a new Nx project. New source imports remain extensionless; bundler resolution is unchanged.

### 2. Generation registry has no implicit teardown

Move Map operations, entry type and status enum from `apps/chat/src/context/GenerationContext.tsx` into a factory. Keep public methods `startGeneration`, `completeGeneration`, `getGeneration`, `hasActiveGeneration` to minimize adapter churn. Path is opaque. Start aborts only the prior active entry on the same path; completion is generationId-guarded. Two registry instances never share entries. No persistence, timer, backend stop or automatic abort-on-unmount is introduced. The existing provider retains its ref above routes, so navigation and StrictMode effect replay do not cancel a generation. Do not replace the registry with reactive state.

### 3. Active-task details are separate from run-history ownership

`resolveActiveScheduledTask` receives route id, loaded/list state, enabled flag, candidate items and an ID-match callback; it returns resolving/not-task/task metadata without reading routing or config. `useActiveScheduledTaskDetails` accepts scheduleId and a stable `getTask(id, signal)` adapter and returns idle/loading/success/unavailable/error, task, error and retry. Classify 404 using a passed status resolver or the existing library error utility. Ignore completions after schedule change/unmount even when an adapter does not honor abort. Retry changes only a request token. RunId changes do not reload task details. Keep one controller in `ActiveScheduledTaskProvider`; banner and sources share it. Existing run-history pagination is composed unchanged.

### 4. Title reconciliation is shared; transport mechanics remain adapters

Move knownTitles, titleRevisions, tombstones/pending deletions, protection deadlines and revision-aware snapshot merging from `apps/chat/src/hooks/conversation/useConversationTitleEnrichment.ts`. Inputs include a caller-provided identity scope, list update sink, `now`, local protection duration and transport policy. Public methods preserve remember/forget/restore/apply/getRevision; visible-id registration is optional and uses opaque view keys.

Use a narrow title transport that receives IDs, AbortSignal and an incremental `onTitles` callback and returns a discriminated completion/fallback result. The host wraps existing JSON or streaming APIs; the controller applies every emission through the same revision guard. Keep batching, cancellation, visible-first ordering and bounded buffering as transport-neutral scheduling with explicit count/byte/flush bounds. JSON-only hosts do not construct a stream callback and use batches of 25. Parent supplies its current stream limits and fallback behavior; unsupported-stream detection and wire parsing stay in `apps/chat/src/server-api/conversation-title-stream.ts` and `conversations.api.ts`.

Cache is instance-local: logically `(identityScope, exactResourceId)`, represented by scoped Maps, with no storage-key format exposed to a backend. It has no blanket persistence TTL. Local-title protection expires after the configured interval (parent supplies 315000 ms); old-list rows are pruned, pending-delete tombstones survive stale snapshots, restore removes the tombstone, and identity change/unmount cancels requests and clears state. Do not decode IDs. New requests supersede old ones; an old response cannot overwrite a local write or resurrect a deleted row. Do not retry every remaining batch after an outage. Keep the existing bounded stream update behavior and avoid one render per token/title event when batching is active.

Reject moving the BFF stream parser into the library or forcing streaming on every host: those are unnecessary backend and host contracts. Reuse one reconciliation path for both transports rather than keeping parallel algorithms.

### 5. Preview controller uses one shared canvas arbitration authority

Parent's richer controller is the behavior baseline: resource-scoped identity, content revision, idle/loading/ready/error state, explicit retry, and protection from A→B→A late completion. The caller resolves manifest/folder to no selection and passes file node/bytes without a request. `skillFileToAttachment` is already shared.

Host invokes feature hooks (`useAttachmentCanvas`, `useOpenAttachmentCanvas`, `useLatestCanvasRequest`) and passes stable operations and snapshots. The controller MUST NOT import a feature hook into `chat-hooks`. Capture a shared request token/commit predicate for each open; combine it with local selection revision and mounted state to retire requests. A stale completion cannot commit content or failure. A failure is stable until selection/revision changes or explicit retry; it cannot create an automatic reopen loop.

Cleanup must only close the canvas still owned by this controller's request. If another consumer opens a new canvas before cleanup or completion, do not close it. Resource key construction stays in the app, never in the controller. Preserve existing parent UI states, retry labels and accessibility.

### 6. External-service login composes existing protocols

Move orchestration from `apps/chat/src/hooks/externalServices/useExternalServiceLogin.ts`, preserving an optional reserved popup. Dependencies are typed callbacks for service lookup, sign-in/sign-out, offline status/login and the host callbackPath. Use existing correlation-id and OAuth primitives. No new transport, channel, storage schema or client instance.

Reserve a popup synchronously before the first await if one was not supplied. OAuth passes scope/level/consent through the existing handshake; stale logout is best-effort; ambiguous cancellation performs authoritative getService verification. API key is trimmed and never logged. DIAL-native checks app consent, offline availability, offline outcome, then app consent again. Return the existing typed external-service outcome vocabulary. Map offline `{ type }` explicitly; preserve distinctions available in each public contract, do not reinterpret timeout or failure as success without a successful authoritative recheck. Close the popup on failed preconditions and exceptions as in current behavior.

Keep code exchange in `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx`. Parent already has an ExternalService dispatch branch; preserve and test it.

### 7. Small controllers preserve identity and untrusted-input behavior

Deployment tracking accepts conversationId, selectedDeploymentId, isLoaded and onChange. Reset the baseline on either identity change or unloaded state; initial restoration and null selection emit nothing. A loaded A→B switch without an unloaded render must not produce a user-change message. Keep `createDeploymentChangedMessage` and persistence at the adapter boundary.

Annotation grouping accepts `unknown`, checks array/entry/selector shape, filters html_tag entries and delegates grouping to existing `groupAnnotationsByCitId`. Stable empty output and memoization by input identity preserve message-render performance. Host extracts `customViewState.annotations`, so persisted schema knowledge stays outside `quotations`.

Transfer mapping accepts readonly conversation jobs and translated resolvers. Preserve job id/fileName/status/percent, invoke only the error or warning resolver appropriate to the row, pass warningNames, and never mutate inputs. Keep translation-key tables local. This is distinct from upload/download file-manager batch mapping.

### 8. Compatibility options eliminate copies without choosing new product defaults

Audio: add optional `uploadMimeTypePolicy: 'preserve' | 'normalize'`, default preserve. Transcription metadata remains normalized in both modes. Normalize creates a File only when needed, preserving bytes, name and lastModified; size/abort validation still occurs before upload, upload remains once, retries reuse its URL. Default mode preserves the original File's upload behavior. This explicit option is chosen over unconditional normalization because the audit proves the hosts currently send different upload MIME values; no unverified claim about server acceptance is needed.

Usage: add an optional fourth options argument with `offsetPolicy: 'current-offset' | 'reset-instant'`, default current-offset. Current-offset uses the formatting-time zone offset/name; reset-instant formats the actual reset instant in that zone. Keep the original ISO value and epoch boundary identical. Tests freeze time on both sides of spring/autumn DST; errors still return undefined. Host locale and translation callback remain injected. No change to existing parent labels or shortened formatters' default behavior.

Existing `usage-period-reset-times` has contradictory prose (“never in a hand-authored library”) immediately before requiring `chat-hooks`' formatter. Its delta explicitly separates host policy from shared formatting mechanics, preserving every existing default requirement. This is an additive compatibility decision, not a product decision to switch the parent to reset-instant.

## Risks / Trade-offs

- Broad scope → independent vertical slices, public exports and exact regression tests per slice; do not mix unrelated cleanup.
- Late async writes/cross-user cache leakage → identity-scoped instances, cancellation plus request/revision checks and two-instance tests.
- Canvas cleanup stealing another consumer's preview → shared token ownership and an explicit cross-caller cleanup test.
- Stream extraction changing performance → retain byte/count/flush limits and visible-first behavior; test JSON fallback and batched application.
- Export tests passing only via workspace aliases → packed fixture outside the workspace, transitive dependency/peer closure, actual installed types/runtime.
- More explicit options → two small compatibility policies are preferable to hidden default changes or duplicated algorithms.

## Migration Plan

1. Add contract tests and APIs in vertical slices, then switch parent adapters in the same slice. Keep app-facing names and parent behavior stable.
2. Extend `tools/reusable-workflows-consumer-fixture/scripts/run.mjs` and the existing `libs/chat-hooks/e2e-fixtures/harness.mjs`; pack all touched roots and transitive dependencies. Verify root/subpath exports, typecheck, Vite build and behavior in an isolated install.
3. Document exports/options and the B1–B8/A2/D adoption matrix in library READMEs and fixture README. Show a JSON title transport, resource-scoped preview, normalized upload and reset-instant formatter recipe. Gate A1 stays unchanged.
4. Run exact suites per task, `verify:changed` per completed slice and one final `verify:full`; build because package entry points/bundles change. Validate docs/specs and packed consumption.
5. Release coordinated artifacts through the normal process.

Rollback: revert the affected adapter to the prior implementation and pin the prior package set; no backend or data migration. Unused additive APIs need not be removed during rollback.

## Open Questions

No product choice blocks this plan: each host's behavior is retained through explicit inputs/options. Whether upload MIME normalization should become a universal default, or both hosts should eventually agree on one DST display policy, remains separate follow-up work. This change does not answer either by changing defaults.
