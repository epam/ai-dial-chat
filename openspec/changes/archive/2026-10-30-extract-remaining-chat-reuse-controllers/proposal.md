## Why

### Problem

Reusable chat workflows are duplicated across hosts, making fixes harder to share. Extract generation, scheduled-task, title, preview and login controllers while preserving existing behavior.

The extraction also provides explicit audio MIME and reset-time compatibility policies.

## What Changes

### Solution

- Extract an instance-scoped generation registry and active scheduled-task classification/detail controller into `chat-hooks`, retaining the existing app providers.
- Extract title revision/cache reconciliation with callback-based transports: retain this host's streaming/viewport/fallback behavior and support a JSON-only consumer without copying the controller.
- Extract skill preview selection/revision/error/retry orchestration with host-supplied canvas operations and the existing shared request arbitration.
- Extract external-service OAuth/API-key/DIAL-native login orchestration over existing OAuth and offline-credentials primitives, including reserved popups and authoritative status rechecks.
- Extract deployment-change tracking that resets its baseline on conversation identity changes even without an intermediate unloaded render.
- Add a defensive annotation grouping hook to `quotations` and a distinctly named conversation transfer queue mapper to `chat-shared`.
- Provide explicit, backward-compatible options in existing shared transcription/reset-time utilities so hosts can select upload-MIME and DST semantics. Do not silently change defaults.
- Switch this repository's app adapters to the new APIs, prove published-artifact consumption using the existing reusable-workflows consumer fixture.

### Alternatives considered

| Option | Correctness and delivery | Security/performance | Migration and rollback |
| --- | --- | --- | --- |
| Keep local implementations | Lowest immediate effort; drift remains | Existing behavior retained; fixes must be ported twice | No migration, no durable reuse |
| Move entire providers/containers into libs | Large coupled change; imports host state and transport policy | Risks cross-host cache/session coupling and unnecessary rendering | Difficult to roll back individual behaviors |
| Extract narrow controllers and explicit compatibility policies (chosen) | More contract tests, but each slice is independently adoptable | Scoped state, unchanged transport ownership, preserved cancellation | Additive exports/options; thin app adapters and pinned packages permit slice rollback |

### Non-goals

No new backend endpoints, auth protocol, global provider, package/project, feature flag, UI surface, or translated string. No relocation of routing, API client configuration, session state, telemetry, storage schemas, catalog policies or notification translations. Do not repeat A1 or the previous ten extractions. Do not refactor the unrelated in-progress backend streaming-service change. Do not choose one host's DST semantics for the other or remove the audio workaround before equivalent upload behavior is available.

## Capabilities

### New Capabilities

- `remaining-chat-reuse-contract`: Public headless contracts and compatibility guarantees for B1–B8, A2 and D; scoped state ownership, parent adoption and installable-package verification.

### Modified Capabilities

- `usage-period-reset-times`: Make host-selected reset-time formatting policy explicit, retain current-offset behavior as the default, and offer reset-instant formatting as an opt-in. Clarify the existing contradictory wording that prohibits library interpretation while requiring a formatter in `chat-hooks`.

Other existing generation, skill-preview, external-auth, deployment-selection, voice, citation and transfer requirements retain their behavior. Direct conversation switching preserves the existing “restore is not a user change” rule.

## Impact

This is an architectural change across `libs/chat-hooks`, `libs/quotations`, `libs/chat-shared`, existing app providers/hooks and `tools/reusable-workflows-consumer-fixture`. Do not widen module boundaries to complete it. Follow the existing extracted-controller pattern in `libs/chat-hooks/src/conversation/useConversationDiscovery/useConversationDiscovery.ts:1` and the app's adapter/context patterns.

Evidence includes `apps/chat/src/context/GenerationContext.tsx:36`, `apps/chat/src/context/ActiveScheduledTaskContext.tsx:104`, `apps/chat/src/hooks/conversation/useConversationTitleEnrichment.ts:93` and `apps/chat/src/hooks/attachment/useSkillFilePreviewSync.ts:44`. Existing OAuth utilities, `skillFileToAttachment`, `groupAnnotationsByCitId`, `createDeploymentChangedMessage` and file-manager queue mapping must be reused, not reimplemented.

Host integration stays in `apps/chat/src/server-api` callbacks and app adapters. Title transports, identity scope, cache protection duration, canvas resource keys, credentials exchange, translation resolvers and timestamp policy enter libs explicitly. Providers remain app-owned and retain their lifetimes. No new state owner needs a new Context. i18n, RTL and accessibility: no new surface or strings; preserve existing labels, live announcements, keyboard behavior and host formatting.

### Acceptance criteria

1. All eight extracted algorithms have documented public exports, isolated unit tests and thin parent adapters; no duplicate parent algorithm remains.
2. JSON and streaming title adapters, direct conversation switches, resource-scoped preview races and reserved-popup flows pass regression tests.
3. Opt-in upload MIME normalization preserves file bytes/name/lastModified, and reset-time policy can preserve either host's semantics with unchanged legacy defaults.
4. The packed consumer fixture imports every new API from public exports without source aliases, private imports or package overrides, with two isolated controller instances where state is involved.
5. Library boundary checks, exact suites, one final full verification, affected build and documentation/spec validation pass.

### Backward compatibility and rollback

Add exports and optional settings; retain existing public signatures/default behavior. No storage or server migration. Keep app-facing adapter exports stable. Roll back one extraction by reverting its parent adapter and pinning the last compatible artifact; unused additive exports can remain. Do not publish packages as part of merely creating or applying planning artifacts.
