## Context

This change implements the useful subset of the 2026-09-20 cross-repository audit. Planning was refreshed against both local checkouts on 2026-09-21. Parent paths below are relative to this repository; client application paths are relative to its own repository. Line numbers are discovery anchors, not permanent contracts.

| Workflow | Parent evidence | Client application adoption surface | Existing reusable foundation |
| --- | --- | --- | --- |
| Skill import | `apps/chat/src/hooks/skills/useSkillArchiveImport.ts:89`; `components/SkillArchiveUploadDialog/SkillArchiveUploadDialog.tsx` under the same src root | Same hook and dialog paths | `libs/chat-hooks/src/skill/skill-manifest.ts`; configured `server-api/skills.api.ts` wrapper |
| File picker | `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx:94`, selection callback at line 160 | Same modal path | `libs/chat-shared/src/file-manager/FileManagerAttachModal/FileManagerAttachModal.tsx:169` and `:196`; `libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts` |
| Prompt selection | `apps/chat/src/components/PromptSelector/usePromptSelectorOverlay.tsx:78` | Same hook plus `PromptSelectorOverlay.tsx`, `PromptParametersPopupOverlay.tsx`, `PromptCatalogModal.tsx` | `libs/prompts/src/index.ts`; extraction model `libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx:36` |

The skill hook and dialog bodies match across hosts after ignoring imports/comments/formatting. Prompt orchestration differs in host gating and catalog callbacks. The file picker is mostly similar, but the parent now defensively clones incoming selection and delegates row filtering to the shared modal; the client application still filters hidden paths in its app callback. We will consume the existing shared modal behavior rather than copy the client application's older filtering into a second implementation.

Current `FileManagerAttachModal` already filters final payloads, deduplicates folders/descendants, and enforces the attachment count. Most of the remaining large app modal is translation assembly, which stays in the app. File extraction is justified by the remaining stateful picker policy, not by its raw line count.

Relevant existing specs: `skill-archive-import`, `prompt-input-attachment`, `dial-file-manager-attach-validation`, `dial-file-manager-attach-folders`, `chat-shared-file-manager-ui`, `chat-hooks-file-manager-composition`, and `chat-hooks-package-distribution`. The attach-validation spec still forbids putting `isHiddenPath` in a library and points MIME matching to a removed app helper. Current source already imports their library owners. The two ownership requirements receive explicit deltas; other existing behavior requirements remain authoritative.

## Goals / Non-Goals

**Goals:** Deliver three portable workflows used by the parent and demonstrably consumable by the client application through built packages. Preserve existing behavior and allow host policy, translations, side effects, and catalog content to differ.

**Non-goals:** No client application edits in this implementation, no automatic publication, no new package/context/backend API, no broad dependency modernization, no shared app shell, no new feature flags, no extraction of the other audit candidates. No line-count target. In particular, do not move `getConversationSource` or translation dictionaries.

## Decisions

### 1. Keep existing package ownership and inject host behavior

Use `chat-hooks` for headless import/file state, `skills` for the import dialog, and `prompts` for the hook that composes prompt UI. Keep the dependency graph acyclic: `skills` and `prompts` do not import `chat-hooks` or generated DTOs for these additions. UI props use structural domain inputs owned by their UI package; app adapters map API responses structurally.

Every new public type is exported by its owning package. Existing root entry points may expose symbols defined by that same package; other packages must not forward them. Coordinate touched exports with active `remove-cross-package-reexports`, without expanding that change's migration here.

Rejected alternatives: moving app components unchanged would import contexts/i18n/configuration; putting JSX in `chat-hooks` violates its headless contract; adding a new integration package is unnecessary for three existing domains.

### 2. Skill import: one asynchronous controller, one presentation component

Add `useSkillArchiveImport`, `SkillArchiveImportStatus`, `SkillArchiveImportErrorKind`, and named options/result types under `libs/chat-hooks/src/skill/useSkillArchiveImport/`, exported through the existing `./skill-editor` entry and owning root.

Conceptual API:

- Inputs: `importArchive(file)` returning the small successful result needed by the host; `onImported(result)` for notification/refresh; `onError(error, kind)` for host reporting. The host provides the configured request callback; the library never constructs a client.
- Outputs: dialog open state, idle/uploading/success/error status, selection rejection reason, error kind, and stable open/close/select/reject handlers.
- The controller owns exact-`SKILL.md` precheck, in-flight exclusion, transitions, and HTTP error classification: 400/413/422 validation, 409 collision, 429 rate limited, 502/503 unavailable, otherwise generic.
- Local rejection stays in the dialog and sends no request/toast. Successful submission closes the selection dialog. Completion calls the host's existing success/refresh adapter once. Preserve the current awaited refresh behavior and error handling; never retry a successful import because refresh failed.
- Ignore late completions after unmount. Do not claim cancelling a selection dialog cancels an already submitted server operation.

Add `SkillArchiveUploadDialog` to `libs/skills/src/components/`. It accepts open/error state, selection/rejection/close callbacks, accepted-file hint and labels. It has no dependency on the controller's enums, app constants, or API response types.

The app hook maps controller status/reasons to existing `SkillArchiveImportI18nKeys`, and resolves a trace ID only for a generic error. `useSkills`, `useNotification`, `useOperationNotification`, and `server-api/skills.api.ts` remain app dependencies. Keep the existing app return shape where practical so CatalogView need not change its responsibilities.

### 3. File picker: compose the remaining state without replacing the shared modal

Add `useFileAttachmentPicker` under `libs/chat-hooks/src/files/useFileAttachmentPicker/`, exported through `./file-manager` and the owning root.

Inputs comprise existing configured `useDialFileManager` options, allowed tab values and translated tab/root labels, MIME/size/count constraints, folder-selection policy, and automatic upload-selection policy. The hook composes existing file-manager/tab helpers, owns active tab and selected paths, and returns the existing controller plus the selection/tab and eligibility props consumed by `FileManagerAttachModal`. Export its named types without exposing raw AG Grid types.

The hook defensively clones selection sets, clears selection on tab changes, and derives hidden-path/MIME/size/folder eligibility and accepted upload types using existing canonical helpers. Missing MIME or size metadata retains current permissive behavior. Stable memoized predicates use current constraints.

Keep final attachment filtering, descendant deduplication, count enforcement, and busy/loading controls in the existing shared modal. Do not create another `AttachResult` shape, add picker state to `UseDialFileManagerResult`, or move validation back into the host. The new hook is a separate composition, not a breaking change to `useDialFileManager`.

The host retains `resolveFolderPath`: it knows DIAL resource paths/buckets and normalizes them before returning a string. It also retains labels, constraint-description sentences, notifications, API setup and attachment-to-composer wiring. Preserve current close/reopen selection behavior; do not invent a new reset-on-close rule.

Rejected alternative: exporting a second all-in-one modal would mostly wrap the existing modal while creating another UI contract and reverse library edges. The headless controller reuses the current modal unchanged.

### 4. Prompt selector: package-owned UI orchestration with a host catalog slot

Add `usePromptSelectorOverlay` and its named options/result/labels/input types under `libs/prompts/src/hooks/` and `src/models/`. Reuse `FavoritePromptsPanel`, `PromptParametersPopup`, and the canonical prompt-variable utilities in `chat-shared`.

Inputs: a structural list of prompts (`id/name/content/description`), favorite IDs, `onToggleFavorite(id)`, `onInsertText(text)`, labels, a resolved `isEnabled` boolean, and `renderCatalog({ isOpen, onSelect, onClose })`. The renderer returns host-owned modal content, preserving lazy loading and allowing the two hosts' catalogs to differ. `onSelect` takes the structural prompt data, so the library need not import API DTOs or fetch a missing entity.

The hook owns pending prompt, browse visibility, selection origin, parameter extraction/resolution, and the three returned UI surfaces: favorites renderer, catalog modal, parameter popup. It exposes direct opening for the Catalog route's parameterized-prompt flow. Dialogs are rendered beside the transient Add-menu popover so closing the menu cannot unmount them.

Unparameterized selection inserts immediately and closes browse; parameterized browse selection retains the browse context behind the popup; Back returns to browse; direct/favorites selection offers no browse Back action; submit inserts once and closes both. Cancel clears the pending prompt without inserting and retains existing underlying-browse behavior. The host still decides how insertion changes its draft.

Parent `useUiFeature(OverlayFeature.Prompts)` stays in the adapter; the client application can supply true. Disabled mode returns no rendered surfaces/menu renderer and direct-open is a no-op, matching the current parent contract. Favorites data/loading remain owned by existing providers; opening the picker does not refetch.

### 5. Prove package reuse with two proportionate, distinct checks — not a new runtime-test phase

Revised after implementation started: a combined synthetic host application with an isolated runtime-test phase (installing Vitest/jsdom/Testing Library inside a packed consumer) was judged disproportionate to a reuse-focused extraction and was dropped before task 4.1 was implemented. The change instead keeps two existing, distinct verification mechanisms, each proportionate to what it proves:

- **Workflow behavior** is proven by each workflow's own library test suite (already delivered in slices 1–3: `libs/chat-hooks/src/skill/useSkillArchiveImport/tests`, `libs/chat-hooks/src/files/useFileAttachmentPicker/tests`, `libs/prompts/src/hooks/usePromptSelectorOverlay/tests`), run through the existing per-lib Vitest/Testing Library setup with injected host callbacks and structural data — no parent application providers. This is unchanged by this revision; it is not a new obligation.
- **Package consumption** — that an external application can actually install, resolve, typecheck, bundle, and load the required CSS of the new exports — is proven by minimal packed-consumer examples using the two packed-artifact harnesses this workspace already has, matched to how each affected package declares its dependencies:
  - `chat-hooks/skill-editor` and `chat-hooks/file-manager` are already exercised end to end (pack, typecheck, Vite build, declaration-import and side-effect checks) by the existing `skill-editor` and `file-manager` entries in `libs/chat-hooks/e2e-fixtures/fixtures.mjs`'s `SUBPATH_FIXTURES`, because `useSkillArchiveImport`/`useFileAttachmentPicker` are exported through those same existing entries. No new chat-hooks fixture is added; the existing `test-packed`/`test-packed-smoke` targets are re-run to confirm the two new exports do not break that contract.
  - `@epam/ai-dial-skills` and `@epam/ai-dial-prompts` have no existing packed-consumer fixture. Both declare workspace-sibling packages (`@epam/ai-dial-catalog`, `@epam/ai-dial-conversation-input`) as ordinary `dependencies`, not `peerDependencies` — the same shape `tools/attachment-canvas-consumer-fixture` exists to prove (see `libs.md`'s "a sibling lib is a dependency" section), not the peer-closure shape `chat-hooks/e2e-fixtures` is built around. A new `tools/reusable-workflows-consumer-fixture` is added: rather than reimplementing `attachment-canvas-consumer-fixture`'s pattern of a fixture-local `node_modules` with `--legacy-peer-deps` (which leaves every *peer* — `react`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit` — to resolve by ancestor `node_modules` lookup up to the workspace root, proving nothing about whether an external consumer could actually satisfy them), it reuses `libs/chat-hooks/e2e-fixtures/harness.mjs` directly: the fixture materializes outside this repo checkout (`createTmpRoot`/`createFixtureDir`, eliminating ancestor-resolution leakage entirely), `createFixtureDependencyResolver`'s generic `resolvePeerClosure` is called with both root packages as `directPeers` (which packs each one, plus every workspace-sibling dependency each pulls in transitively, and pins every required external peer — including peers-of-peers such as `@epam/ai-dial-chat-shared`'s own required peers — to this workspace's exact `package-lock.json` version), and one plain `npm install` (no `--legacy-peer-deps`) installs that fully declared tree. `typecheckFixture`/`bundleFixture` then run a real `tsc --noEmit` and `vite build` against an entry that imports both packages' `./styles.css` and re-exports their full public surface.

Neither harness renders or interacts with a mounted component tree, and neither installs a test runner into the isolated consumer — bundling and typechecking are the whole of what "packed consumption" proves here. This is a narrower claim than the original decision made, and `docs/reusable-chat-workflows.md` (§4.3) states the boundary explicitly: **runtime behavior against installed tarballs is not covered by either fixture** — only behavior-under-test (via the libraries' own Vitest suites) and package-resolution/build (via the two fixtures) are.

Keep feature imports and the catalog lazy boundary — unchanged from the original decision. This does not authorize fixing unrelated existing bundle/dependency issues.

**Two defects the packed fixture caught, both fixed at the source, neither compensated for:**

- `libs/prompts/src/hooks/usePromptSelectorOverlay/usePromptSelectorOverlay.tsx`'s `React.lazy()` boundary around `PromptParametersPopup` (which reaches `@epam/ai-dial-catalog`'s AG-Grid-backed `ListView`) did not actually keep AG Grid out of `@epam/ai-dial-prompts`' initial chunk once packed: a single-entry Vite library build inlines a dynamic `import()` of anything that is not itself a separately declared `build.lib.entry`, and the package root (`src/index.ts`) also directly re-exported `PromptParametersPopup` as a convenience export, which forced a static import of that chunk regardless of the internal lazy boundary. Fixed by declaring `parameters-popup` as its own `build.lib.entry`/`./parameters-popup` export subpath. The existing root-level `PromptParametersPopup` export is preserved through a shared lazy wrapper with its own Suspense boundary; the workflow hook uses that wrapper too. This keeps current client application imports and props compatible while loading the catalog only when the popup opens. The fixture's bundle check now asserts AG Grid is absent from the main chunk **and** present in a separate emitted chunk, proving the split is real rather than merely inferred from source.
- `libs/skills` and `libs/prompts` scoped their `@epam/ai-dial-chat-shared`/`@epam/ai-dial-catalog`/`@epam/ai-dial-publish-panel` Vitest `resolve.alias` at the top level of `vite.config.mts` instead of inside `test.alias`; that leaked into `vite-plugin-dts`'s declaration pass and corrupted both packages' emitted `.d.ts` imports into monorepo-relative paths (`../../../chat-shared/src/index.ts`) instead of the bare `@epam/ai-dial-chat-shared` specifier — unresolvable outside this checkout. Fixed by moving the alias into `test.alias` only. The fixture's `typecheckFixture` call needs no compensating bridge file for this defect (it still carries the harness's own pre-existing, separately tracked `@epam/ai-dial-catalog`/`@epam/ai-dial-publish-panel` declaration bridge, which papers over a different, already-present defect in `libs/catalog`'s own build config — out of scope for this change).

### 6. Preserve app behavior and document scope precisely

No HTTP/Swagger/generated-client change; existing authorization and backend archive validation remain authoritative. No new cache, TTL, telemetry, persistence, feature key, or i18n key. Reuse the app's `SkillArchiveImportI18nKeys`, `PromptSelectorI18nKeys`, `NavigationI18nKeys`, `DialFileManagerI18nKeys`, and generic button labels as applicable to actual source.

UI retains accessible labels, keyboard dismissal/focus restoration, upload live status, error presentation, logical CSS and mirrored directional icons. Add automated RTL and keyboard tests for the new UI composition. Keep memoized callbacks/derived collections stable as inputs permit. Follow `AGENTS.md`, `.claude/rules/libs.md`, and `.claude/rules/lib-styling.md`; no UI-kit redesign is needed.

## Risks / Trade-offs

- **Extraction can move only glue and deliver little value** -> acceptance requires the three actual stateful workflows to leave the app; label assembly remains local and is not counted as a failure.
- **Subtle two-host differences** -> preserve parent runtime rules; cover the client application's always-enabled prompt flow and host-supplied catalog in the consumer fixture. Record any incompatible client application behavior instead of silently porting it.
- **Existing spec/source drift** -> explicitly modify two obsolete attach-helper ownership requirements. The skill spec describes native selection while source has a dropzone dialog; preserve the existing dialog and its tested native/drop selection behavior, not a new UI redesign.
- **Monorepo resolution masks incomplete exports** -> isolated packed typecheck/build/runtime checks and exported reachable types.
- **Async notifications/refresh races** -> exactly-once completion, busy guard, retry after failure, and late-completion tests.
- **Breaking APIs in unrelated parent work** -> record the tested aligned artifact set; this change adds no new forwarding shims and does not claim the client application can upgrade without reviewing unrelated release changes.

## Migration Plan

Implement three independently verifiable vertical slices: skill import, file picker, prompt selector. Each slice adds its public contract, moves the behavior, migrates the parent adapter and relevant tests, and documents the owning package. Then complete combined packed-consumer verification and a client application adoption map in `docs/reusable-chat-workflows.md`.

The adoption map must name each current client application hook/component, replacement import, retained callbacks/labels/policy, required owning-package CSS, and automated checks. It must state which copied workflow code can disappear. Do not make client application source changes or publish packages as part of this parent change.

Release-ready means locally built/packed and tested artifacts. A release number is assigned by the existing release process later. Roll back per slice by reverting that parent's adapter and implementation commit; no data migration is required.

## Open Questions

No product decision blocks implementation. Exact release version is intentionally deferred to release time. The consumer fixture demonstrates compatibility with the client application integration boundary, not a claim that the client application itself has already migrated or passed its full test suite.
