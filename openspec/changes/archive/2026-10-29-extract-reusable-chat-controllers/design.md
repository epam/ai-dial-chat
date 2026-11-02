## Context

Existing reusable workflows cover skill archive import, prompt selection, attachment browsing and conversation drafts. The remaining app-owned computations and async controllers can be reused by injecting their host dependencies.

Grounding sources are the current app modules listed below, existing behavior specs (especially scheduled-task grouping/unread tracking, file-manager preview and URL entity preselection), `docs/reusable-chat-workflows.md`, `AGENTS.md` Library isolation and `.claude/rules/libs.md`. Those existing behavior contracts remain in force. App-level wrappers keep their existing signatures; new library APIs use explicit options.

## Goals / Non-Goals

**Goals:** extract the ten controllers, use them in apps/chat, preserve public behavior, verify independent npm consumption, and document host integration.

**Non-goals:** publish packages, redesign auth, change backend endpoints, centralize all app state, add product UI, migrate already-shared workflows again, or change timezone policy.

## Decisions

### 1. Existing packages and explicit state ownership

Use `chat-hooks` for non-rendering controllers and pure utilities. Put canvas request coordination in `attachment-canvas`, scoped to its existing provider, because feature libraries cannot depend on `chat-hooks`. No new package or global application context is necessary. Do not widen module-boundary lint rules.

The exports below are additive public APIs. Export their option/result types at the same public entry and from the owning package root. Use existing thematic entries, preserving lazy engine loading; do not introduce private deep-import requirements.

| Item | Public API / owner                                                                                                       | Existing parent adapter                                                                                       | Injected host inputs / state owner                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1     | `triggerBrowserDownload`, `chat-hooks/utils`                                                                                      | `apps/chat/src/utils/file-download.ts`                                                                        | Response, fallback name, prepared destination; no persistent state                                               |
| 2     | `groupScheduledTaskConversations`, `applyActiveScheduledTaskRun`, `collapseScheduledTaskConversations`, `chat-hooks/conversation` | `apps/chat/src/utils/collapse-scheduled-task-conversations.ts`                                                | Group key, identity comparator and eligibility; immutable derivation                                             |
| 3     | `useConversationDiscovery`, `chat-hooks/conversation`                                                                             | `apps/chat/src/hooks/conversation/useConversationDiscovery.ts`                                                | Items, refresh, sessionKey, normalizeId, retry policy, onError; hook owns session/timer                          |
| 4     | `useScheduledTaskSkillDisplayNames`, `chat-hooks/scheduled-tasks`                                                                 | `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskSkillDisplayNames.ts`                                    | URLs, listed skills and metadata callback accepting AbortSignal; hook owns selection-scoped results              |
| 5     | `useSkillFileSystemPicker`, `chat-hooks/skill-editor`                                                                             | `apps/chat/src/hooks/skills/useSkillFileSystemPicker.ts`                                                      | File materialization callback and onError; hook owns open state and pending selection                            |
| 6     | `useLatestCanvasRequest`, `attachment-canvas`; `useDialFilePreview`, `chat-hooks/file-manager-canvas`                             | `apps/chat/src/hooks/attachment/useLatestCanvasRequest.ts`, `apps/chat/src/hooks/files/useDialFilePreview.ts` | Provider owns request generation; preview receives open/unsupported/URL/startRequest callbacks and file listings |
| 7     | `useEntityPreselection`, `chat-hooks/conversation`                                                                                | `apps/chat/src/hooks/useUrlEntityPreselection/useUrlEntityPreselection.ts`                                    | Parsed snapshot, flags, lists, load callbacks, sinks and outcome callbacks; hook owns transition state           |
| 8     | `useFileAttachmentModalState`, `chat-hooks/file-manager`                                                                          | `apps/chat/src/hooks/files/useDialFileManagerState.ts`                                                        | Bucket and preview URL resolver; hook owns open state and pending attachments                                    |
| 9     | `resolveCanvasWidth`, `chat-hooks/viewport-layout`                                                                                | `apps/chat/src/utils/canvas-width.ts`                                                                         | Mode and numeric layout policy; pure function                                                                    |
| 10    | `usePersistedState`, `chat-hooks/utils`                                                                                           | `apps/chat/src/hooks/useLocalStorage.ts`                                                                      | Read/write callbacks or storage port, key, codec and initial value; hook owns in-memory value                    |

Keep attachment-result state separate from `useFileAttachmentPicker`: browsing/selection and composer pending-result consumption have distinct lifetimes. Reusing the existing picker for result delivery would couple modal visibility to an unrelated grid controller.

### 2. Preserve host policies instead of importing them

Grouping takes `getGroupKey(item)`, `conversationIdsMatch` and `isCollapsible(item)` callbacks. The parent adapter supplies bucket-aware key parsing and excludes pinned/shared/published runs; fixtures also exercise bucket-first keys. Using a small structural item contract avoids importing a product-specific DTO-to-display policy. Existing newest ordering and stable references remain the library algorithm. The provider retains the complete list.

The skill-file picker receives `materializeFile(file, signal)` instead of importing `downloadFile` or translating the root label. The app callback performs the existing resource-path resolution/download/File conversion. The controller handles item filtering, selection lifecycle and results, not URLs or credentials.

Preview receives callbacks from the host that invokes `useAttachmentCanvas` / `useOpenAttachmentCanvas`; `chat-hooks` never invokes a feature-package hook or imports a rendering component. The host retains API resolvers and passes one supported-extension policy aligned with the canvas; avoid a second disconnected format registry.

Preselection gets an arrival snapshot and typed outcomes; it never reads `window.location` or calls a router. The adapter preserves unrelated query/hash and router state, formats notifications and translates prompts. Existing feature flags and overlay disablement become input booleans. Parameterized prompts return structural data, not a type imported from the app's prompt-selector component.

Width mode uses an exported string enum (bounded file panel / conversation share); the app resolves route and breakpoint. Numeric values come from its current layout constants. `getNavigationSidebarWidth` remains app-owned. Persistence callbacks own serialization, keys and storage selection; no library access to auth/session or a hard-coded storage namespace.

### 3. Async lifecycles and compatibility

- Discovery preserves five additional retries two seconds after settlement, de-duplicates pending IDs without resetting budgets, and uses one retry timer with no overlapping retry requests. Initial refresh rejection is observable by its caller; retry rejection invokes an injected error callback and remains bounded, without an unhandled rejected promise. Existing providers can pass their already-handled refresh callback. Reset retires the old session and prevents it scheduling further work.
- Metadata resolution keeps listing names authoritative, preserves unknown URLs and selected order, aborts/invalidates on selection changes and unmount, and never commits stale results. Results are component-local, not a cross-user cache.
- A picker attempt has a generation token and AbortController. New pick, close or unmount settles the previous promise as cancelled and invalidates its downloads. A stale completion cannot resolve a newer pick or report its error as the newer attempt's error.
- Canvas request generation is provider-scoped rather than a module singleton. All sources/messages/file previews under the parent's single provider share one coordinator; two embedded providers are independent. Mounted guards remain per caller. No additional global app context is introduced.
- Persisted state deliberately retains current mount-initialization behavior. Changing key/codec does not reload state; subsequent writes use current inputs. Hosts that need a fresh read remount/re-key explicitly. No cross-tab synchronization is added.

Retain app wrappers so existing specification paths and consumer signatures remain valid. Compatibility wrappers must delegate, not contain a second implementation.

### 4. Package and verification contracts

Extend existing `libs/chat-hooks/e2e-fixtures` and the existing reusable-workflow consumer harness. Exercise root and documented subpath exports, reachable option/result types, real TypeScript checking and production bundling against packed packages outside workspace aliases. Follow `.claude/rules/libs.md` for dependency ownership; no undeclared peers or dependency cycles. Keep heavy file-manager/editor/canvas engines out of utility-only entry bundles.

Behavior suites use injected data/callbacks and fake timers where appropriate. Parent suites verify wiring, labels, routing, identity and supported formats. Packed consumption verifies installation and public declarations; behavioral suites verify controller execution and host wiring.

### 5. Existing related APIs

The integration guide also documents existing public APIs without extracting them again:

- Offline credentials use `chat-hooks/offline-credentials`, `{ callbackPath }` options and a `{ type }` result including `TimedOut`. Hosts retain popup reservation and status refetch.
- `formatUsageResetTime` is a root export. Its current-offset policy is unchanged; hosts must choose timezone semantics explicitly before adopting it.
- `getConversationSource` is available from `chat-hooks/conversation`.

## Risks / Trade-offs

### Public dependency closure

Preserve package
specifiers in skill-editor declarations instead of rewriting source aliases.
Canvas owns the MCP host-context contract: import its original ext-apps type
directly, and have mcp-apps/chat-hooks derive that same type from canvas's public
content contract. Canvas declares Zod 4 so ext-apps declarations resolve against
their compatible schema API without a consumer override or skipLibCheck.

Chat-shared's root already exports File Manager types and the narrowly allowed
AG Grid event-binding hook. Preserve those public exports and make the existing
File Manager peer required and declare AG Grid as a dependency, matching its
existing role in catalog; optional metadata previously hid real declaration
dependencies. AG Grid is used solely for the existing narrow event-binding
exception. No new grid
rendering or general engine use is introduced. This increases the installed
peer closure but preserves runtime lazy-loading boundaries. Removing those
root contracts instead would be a breaking API change.

- Broad scope across ten items → ordered slices with tests and parent adoption in every slice; P3 items remain in scope but land last.
- Library callback complexity → narrow named option types and JSDoc; prefer established structural contracts over app return types.
- ID formats and grouping policy differ → callback injection and paired fixtures; never infer a host from an ID prefix globally.
- Unmount and cross-attempt races → generation/abort tests; do not equate API cancellation support with stale-result safety.
- Compatibility wrappers obscure duplication → inspect wrappers and require library execution in integration tests.

## Migration Plan

1. Extract downloads/grouping, then discovery/skill names, each with parent adoption and public exports.
2. Extract picker/attachment-result state, then provider-scoped preview and preselection.
3. Extract width/persisted-state utilities; retain all app signatures and current settings.
4. Complete artifact fixtures, README/API documentation, architecture ownership notes and host integration guidance.
5. Verify the implementation with behavioral suites, independent packed consumers, module-boundary checks and full workspace checks. Registry releases use aligned package versions.

Rollback is per slice: restore the prior app implementation and revert that slice's wiring if necessary. Additive published exports can remain until normal version policy permits removal. No backend or persisted-schema rollback is required.
