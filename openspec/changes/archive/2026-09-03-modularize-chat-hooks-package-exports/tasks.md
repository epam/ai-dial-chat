## 1. Investigation checkpoints (record findings, no code)

- [x] 1.1 Confirm the dependency matrix in `design.md` against current `libs/chat-hooks/src/**`
      (a fresh grep pass) — the matrix was built from a point-in-time audit; reconcile any
      export added/removed since, and update `design.md`'s matrix table if it drifted.
      **Done**: found and fixed 6 drift classes (2 new skill-editor files, 1 unassigned skill
      util, 2 unassigned top-level hook folders, 3 mis-classified/missing peers, plus 4 entries
      missing an undocumented type-only `@epam/ai-dial-chat-api-client` peer) — see `design.md`
      Context section for the full reconciliation note and corrected table. A later strict
      rolled-declaration check additionally found `@epam/pdf-highlighter-kit` exposed by
      `./file-manager.d.ts`; it is now declared as an optional type peer.
- [x] 1.2 Search this workspace's other publishable `libs/*` for an existing "install a packed
      tarball and build" fixture convention (design.md's Open Question). Record the decision —
      reuse it or introduce `libs/chat-hooks/e2e-fixtures/` — before task 6 starts.
      **Done**: no existing convention found anywhere in the workspace (checked every
      `libs/*` package, `tools/`, `nx.json`, root `package.json`, and the one archived change
      that floated the idea without implementing it). Decision: introduce
      `libs/chat-hooks/e2e-fixtures/` — see `design.md`'s Open Questions.

## 2. Entry-point barrels

- [x] 2.1 Create `libs/chat-hooks/src/entry-points/viewport-layout.ts` re-exporting
      `usePageFileDrag`, `useViewportWidth`, `usePanelMaxWidth` from their current locations.
- [x] 2.2 Create `libs/chat-hooks/src/entry-points/scroll-anchoring.ts` re-exporting
      `useConversationScroll` and its associated types.
- [x] 2.3 Create `libs/chat-hooks/src/entry-points/conversation.ts` re-exporting the core
      `conversation/*` exports (`useConversationHandlers`, `useConversationStream`,
      `useAttachmentUpload`, announcement/footer/greeting message helpers,
      `generation-resume`, `display-name-watch`, `overlay-messages`,
      `quick-app-conversation-starters`, and the rest of `conversation/*` not owned by
      `./conversation-transfer` or `./scroll-anchoring` — `useActiveConversationSync`,
      `useAsyncConfirmDialog`, `useConversationLookupMaps`, `useConversationPanelItems`,
      `useImportFilePicker`, `deriveConversationRowActionState`, `create-chat-stream-api`,
      `get-model-id-from-conversation-id`, `message-factory`, `message-utils`,
      `starter-option`) — excluding `conversation-transfer/*` and `useConversationScroll`.
      Per task 1.1's reconciliation, also re-export the two previously-unassigned top-level
      hook folders `useChatSettingsFormConfig/` and `useToolsMenu/` (neither has a peer beyond
      `@epam/ai-dial-chat-shared`, already required here).
- [x] 2.4 Create `libs/chat-hooks/src/entry-points/conversation-transfer.ts` re-exporting
      `useConversationExport`, `useConversationImport`, and the transfer module's own
      types/enums. **Correction (task 1.1 reconciliation)**: `useConversationTransferQueue`
      (`conversation-transfer/queue.ts`) is never re-exported from `src/index.ts` today — it is
      a private implementation detail of `useConversationExport`/`useConversationImport`.
      Adding it to this barrel would violate task 2.15's subset invariant (a subpath cannot
      publish a name the root entry doesn't). Excluded; re-exporting it is out of scope for this
      change (it would be a root-entry public-surface addition, contradicting the "byte-for-byte
      behaviorally identical" root-entry goal in `design.md`).
- [x] 2.5 Create `libs/chat-hooks/src/entry-points/conversation-sources.ts` re-exporting
      `useConversationSources`.
- [x] 2.6 Create `libs/chat-hooks/src/entry-points/file-manager.ts` re-exporting the
      `files/*` public surface (`DialFilesApi`, `useDialFileManager`,
      `useDialFileManagerTabConfig`, `useDialFileListing`, `useDialFileMetadata`,
      `useDialFileSharing`, `useDialFileUploadBatch`, `useDialFileMutations`,
      attachment-canvas resolvers, domain models/constants/path utilities).
- [x] 2.7 Create `libs/chat-hooks/src/entry-points/catalog.ts` re-exporting `catalog/*`
      (including `useCatalogItemDetails`, `useFavoriteEntitiesState`, `usePublishFolders`,
      `resolveCatalogPrimaryAction`) plus `useSkillFilePreview` and `skill-types.ts` (per task
      1.1's reconciliation — its only consumers are `catalog/map-skill-to-catalog-item.ts` and
      `useCatalogItemDetails.ts`) from `skill/`.
- [x] 2.8 Create `libs/chat-hooks/src/entry-points/skills-state.ts` re-exporting
      `useSkillsState`.
- [x] 2.9 Create `libs/chat-hooks/src/entry-points/skill-editor.ts` re-exporting
      `skill.ts`/`skill-manifest.ts`'s parsing/validation functions, `useSkillEditorSubmit`,
      and `skill-file-batch-validation` — excluding `useSkillFilePreview` (owned by 2.7) and
      `useSkillsState` (owned by 2.8). Per task 1.1's reconciliation, also re-export
      `useSkillEditorLoad`, `useSkillFileActions`, and `skill-file-preview.ts`'s
      `skillFileToAttachment`/`SkillFileContent` (all three were unassigned in the original
      matrix; none belong to `./catalog` or `./skills-state`).
- [x] 2.10 Create `libs/chat-hooks/src/entry-points/oauth.ts` re-exporting `oauth/*`
      (authorize-URL, popup, handshake, toolset-id, models/types) and
      `shared/toolset-login-events.ts`'s emit/subscribe functions.
- [x] 2.11 Create `libs/chat-hooks/src/entry-points/scheduled-tasks.ts` re-exporting
      `scheduled-task/*`.
- [x] 2.12 Create `libs/chat-hooks/src/entry-points/sharing.ts` re-exporting `useShareLink`,
      `useShareRecipientsCount`.
- [x] 2.13 Create `libs/chat-hooks/src/entry-points/attachments.ts` re-exporting
      `useAttachmentAction`, `useAttachmentValidation`.
- [x] 2.14 Create `libs/chat-hooks/src/entry-points/utils.ts` re-exporting the remaining
      `shared/*` (minus `toolset-login-events.ts`), `usage/*`, `api-error/*`,
      `api-transport/*`, `prompt/*` exports.
- [x] 2.15 Add a test asserting each entry-point barrel's export set is a subset of
      `src/index.ts`'s exports and that the union of all 14 barrels' exports, plus anything
      `src/index.ts` exports that intentionally has no subpath yet, equals `src/index.ts`'s
      full export set — catching drift between the root barrel and the new subpaths (design.md
      Risk 1).

## 3. Build configuration

- [x] 3.1 Change `libs/chat-hooks/vite.config.mts`'s `build.lib.entry` from a single string to
      the 15-key object map (`index` + 14 named entries) per `design.md` D1.
- [x] 3.2 Remove `fflate` and `ag-grid-community` from `rollupOptions.external`; confirm
      `dompurify`, `lru-cache`, `mime-types`, `yaml` remain absent from that list (already
      bundled today).
- [x] 3.3 Confirm `vite-plugin-dts`'s `entry`/`entryRoot` configuration emits one `.d.ts` per
      entry key with the multi-entry object form; adjust its options if the installed
      `~4.5.0` version needs an explicit `rollupTypes`/`entryRoot` tweak for multi-entry output
      (verify against its current docs before changing flags — do not guess).
      **Done**: confirmed by building — without `rollupTypes`, the plugin emits one `.d.ts`
      per *source file* mirroring `src/`'s folder structure (e.g.
      `dist/entry-points/viewport-layout.d.ts`, `dist/files/*.d.ts`), not a flat
      `dist/<entry>.d.ts` matching the `exports` map's paths. Added `rollupTypes: true` (backed
      by `@microsoft/api-extractor`, already a transitive dep of `vite-plugin-dts`), which
      forces `insertTypesEntry`/`staticImport` on and rolls each entry into one flat top-level
      `.d.ts` — verified all 15 (`index` + 14) land directly under `dist/` with no nested
      folders, each self-contained (`viewport-layout.d.ts` has zero imports; `oauth.d.ts`
      imports only its documented `@epam/ai-dial-chat-api-client` peer as a bare specifier).
      Cost: build time rose from ~6s to ~65s (one api-extractor analysis pass per entry) — no
      action taken, not in this task's scope.
- [x] 3.4 Run `npm exec nx build @epam/ai-dial-chat-hooks` and confirm `dist/` now contains one
      `.js`/`.d.ts` pair per entry key, each independently loadable.
      **Done**: build succeeds; `dist/` has 15 `.js`/`.d.ts` pairs (`index`,
      `viewport-layout`, `scroll-anchoring`, `conversation`, `conversation-transfer`,
      `conversation-sources`, `file-manager`, `catalog`, `skills-state`, `skill-editor`,
      `oauth`, `scheduled-tasks`, `sharing`, `attachments`, `utils`) plus a set of Rollup/
      Rolldown-generated hashed shared chunks (e.g. `usePanelMaxWidth-BEZYuqF9.js`,
      `useToolsetLogin-GhFtKs4D.js`) that each entry's own file imports by relative path for
      code it shares with another entry (e.g. `oauth.js`'s and `index.js`'s shared
      `toolset-id-*.js`/`useToolsetLogin-*.js` chunks). **Design correction**: `design.md`'s D1
      states the unchanged single-entry behavior means "code shared between two entries... is
      duplicated into each entry's own output file rather than factored into a shared chunk" —
      this is not what the multi-entry build actually does; Rollup/Rolldown's default
      multi-entry chunking factors shared modules into separate hashed chunk files instead of
      duplicating them. This does not break isolation (an entry's own file plus the chunks it
      transitively imports still contain no code exclusive to another entry — confirmed by
      inspecting `viewport-layout.js`/`oauth.js`/`file-manager.js`'s own top-level imports) and
      is a smaller, not larger, published artifact, but `design.md`'s "Risk" section already
      flagged this exact possibility ("Vite 8/Rolldown multi-entry lib-mode behavior around
      chunk de-duplication could differ from assumptions here") — task 6's fixtures (not yet
      implemented) need to assert isolation against an entry's full transitive chunk graph, not
      a single file, and `design.md`'s D1 prose should be corrected in a follow-up pass over
      that section before task 6 starts.

## 4. Package manifest

- [x] 4.1 Add the 14 new subpath blocks to `libs/chat-hooks/package.json#exports`, each with
      `@epam/source`, `types`, `import`, `default` conditions pointing at the matching
      `src/entry-points/*.ts` / `dist/*.d.ts` / `dist/*.js` paths, per `design.md` D2.
- [x] 4.2 Remove `dompurify`, `lru-cache`, `mime-types`, `yaml` from `dependencies` (now
      bundled-only, per `design.md` D3).
      **Done**: the entire `dependencies` field is gone from `package.json` (it held only
      these four).
- [x] 4.3 Remove `fflate` and `ag-grid-community` from `peerDependencies`.
      **Done**: `ag-grid-community` was already absent (dead config, confirmed in task 1.1);
      `fflate` removed — `peerDependencies` now lists exactly `react` + the 16 optional feature
      peers from `design.md` D2 (15 `@epam/ai-dial-*` plus `@epam/pdf-highlighter-kit`, whose
      type is exposed by the rolled-up `./file-manager` declarations).
- [x] 4.4 Add `peerDependenciesMeta` marking every remaining feature peer
      `optional: true`; leave `react` as the only non-optional peer.
- [x] 4.5 Add the three stable side-effect carrier facades and the
      `useToolsetLogin-*.js`/`useDialFileManagerTabConfig-*.js` emitted-chunk globs to
      `package.json#sideEffects`.
- [x] 4.6 Update `libs/chat-hooks/tsconfig.lib.json`'s project `references` if any peer's
      reference is no longer needed by any entry (unlikely, since the root entry still needs
      all of them) — verify, don't assume, by running the typecheck target.
      **Done**: ran `npm exec nx typecheck @epam/ai-dial-chat-hooks` — passes with all 13
      existing references untouched; none is dead, since the root entry (unchanged) still
      imports every peer. No edit needed.

## 5. `tools/publish-lib.mjs`

- [x] 5.1 Add a `stripDistPrefix`-mapped rewrite for a top-level `sideEffects` array,
      mirroring the existing `main`/`module`/`types` handling (lines 259–261), so the
      published manifest's `sideEffects` entries resolve correctly once `dist/` becomes the
      package root.
      **Done**: `publish-lib.mjs` maps `stripDistPrefix` over `json.sideEffects` when present.
      No existing unit-test coverage existed for `publish-lib.mjs` (it runs Nx project-graph
      resolution and process/npm side effects as soon as it's loaded, so it can't safely be
      `import`ed by a test as-is) — the package.json transformation (`stripDistPrefix`,
      `rewriteExportsObj`, and the rest of the version/repository/exports/sideEffects/deps
      rewriting, now including `sideEffects`) was extracted, behavior-preserving, into a new
      pure module `tools/publish-lib-package-json.mjs` that `publish-lib.mjs` imports and
      calls; this is what task 5.2's unit test exercises directly.
- [x] 5.2 Add a unit test (or extend an existing one, if `publish-lib.mjs` has test coverage)
      asserting a `sideEffects: ["./dist/index.js"]` input rewrites to `["./index.js"]` in the
      written `dist/package.json`.
      **Done**: `tools/publish-lib-package-json.spec.mjs` (node:test, run via
      `npm run publish:lib:test`) covers `stripDistPrefix`, `rewriteExportsObj`, and
      `preparePublishPackageJson` — including the exact
      `["./dist/index.js", "./dist/oauth.js", "./dist/file-manager.js"]` →
      `["./index.js", "./oauth.js", "./file-manager.js"]` rewrite this task calls for, plus
      version/private/repository/workspace-dep/`nx`-block coverage carried over from the
      pre-extraction logic. All 9 assertions pass.

## 6. Packed-package consumer fixtures

- [x] 6.1 Implement the fixture harness decided in 1.2: pack `libs/chat-hooks/dist` (via the
      existing `publish-lib.mjs --dry=true` transform) into a tarball and `npm install` it into
      an isolated `node_modules` per fixture.
      **Done**: `libs/chat-hooks/e2e-fixtures/{harness,fixtures,run}.mjs` +
      `libs/chat-hooks/e2e-fixtures/README.md`. `harness.mjs`'s `packChatHooks` runs
      `publish-lib.mjs --dry=true` then `npm pack` on `dist/`. Fixtures are created under the
      OS temp directory, not anywhere inside this repo checkout — Node/Rollup/tsc module
      resolution walks every ancestor directory for a `node_modules` that has the specifier it
      wants, so a fixture nested inside the repo (even git-ignored) silently resolves an
      "uninstalled" peer from the workspace's own root `node_modules`, which really does have
      every peer installed for `apps/chat`. This was found the hard way: an early version
      nested fixtures under `libs/chat-hooks/e2e-fixtures/.tmp/` and the negative fixture (6.5)
      passed without its target peer ever being installed. Two more implementation-time
      corrections to the design as written: peers install off the `development` npm dist-tag,
      not `latest`/`*` (this package family's `latest` tags are not kept mutually compatible —
      e.g. `@epam/ai-dial-chat-shared@1.0.6`'s own peer range on `ui-kit` is
      `^0.14.0-dev.15`, which `ui-kit@latest` (`0.13.0`) never satisfies); and each fixture
      installs the full transitive peerDependencies closure of its documented peers
      (`resolvePeerClosure` in `harness.mjs`, walking `npm view <pkg> peerDependencies`
      recursively, memoized across the run), not just chat-hooks' own direct peer list. Modern
      npm may auto-install peers, but the explicit closure pins a deterministic compatible set;
      e.g. `@epam/ai-dial-quotations` needing
      `@tabler/icons-react`/`react-markdown` is exactly as mandatory as chat-hooks' own
      documented peers. The tarball uses the currently published coordinated development
      version, because `publish-lib.mjs` pins workspace peers to that version and normal npm peer
      resolution must validate them without `--legacy-peer-deps`. Before installing fixtures,
      the harness compares every published
      export target and every emitted `dist/` file with `npm pack --json`'s file list.
      npm itself is invoked through its JavaScript CLI rather than a Windows command shell, so
      peer ranges containing `<`, `>`, or `||` remain literal arguments instead of shell syntax.
- [x] 6.2 Minimal fixture: install the tarball + the `react` runtime peer and consumer-owned
      `@types/react` tooling only, import
      `@epam/ai-dial-chat-hooks/viewport-layout`, assert TypeScript compilation and a
      production bundle both succeed, and assert the bundle contains no code/import exclusive
      to `./file-manager`, `./catalog`, `./skill-editor`, or `./oauth`.
      **Done**: `MINIMAL_FIXTURE` in `fixtures.mjs`; verified passing (real `npm install` +
      `tsc --noEmit` + `vite build`) via `node libs/chat-hooks/e2e-fixtures/run.mjs
      --only=minimal`. The consumer file is `export * from '@epam/ai-dial-chat-hooks/<subpath>'`
      — not the `import * as mod from '...'; export default mod` form tried first, which a
      bundler honoring this package's now-accurate `sideEffects` metadata tree-shook away
      *entirely* (imports and all), silently defeating every fixture including the negative one.
      Isolation is proven by the build succeeding at all with no other peer installed, backed by
      an explicit content check that the bundle contains neither `new EventTarget()` nor
      `LRUCache` (the two side-effect markers — see 6.6).
- [x] 6.3 One fixture per published subpath: install the tarball + that entry's complete
      documented runtime and type-only peer set, assert every external import in the entry's
      rolled-up `.d.ts` resolves, and assert consumer compilation and bundling succeed.
      **Done**: `SUBPATH_FIXTURES` in `fixtures.mjs` covers all 14 subpaths.
      Consumer compilation runs with `skipLibCheck: false`; fixture-only compatibility bridges
      cover React 18 global-JSX declarations, Monaco's extensionless declaration import, Vite
      stylesheet modules, and the currently published catalog peer's broken monorepo-relative
      publish-panel declaration import without weakening type checking or replacing any peer.
      Fixing this end to end surfaced a real, second pre-existing defect (not a fixture bug):
      task 1.1's dependency matrix mis-classified `./sharing`'s `@epam/ai-dial-chat-api-client`
      peer and `./catalog`'s `@epam/ai-dial-skill-editor` peer as type-only. Both are runtime —
      `useShareLink.ts` compares against `ShareLinkResponseDtoAccessEnum`'s real value, and
      `useCatalogItemDetails.ts` imports the value `SKILL_MANIFEST_FILE` from `skill.ts`, which
      itself uses `SkillFileNodeKind` as a value elsewhere in that same file. Corrected in
      `design.md`'s dependency matrix (see its task-6-correction note) and in both fixtures'
      `peers` lists.
- [x] 6.4 Legacy-root fixture: install the tarball + the full 17-peer set, import
      from `.`, assert compilation, bundling, and (a sample of) runtime behavior match
      pre-change expectations.
      **Done**: `LEGACY_ROOT_FIXTURE` in `fixtures.mjs` (peers: `ALL_OPTIONAL_PEERS`, all 16
      optional feature peers); verified passing. Bundling the root entry requires Vite's own
      CSS handling (a bare `rolldown` CLI invocation errors on the CSS a markdown/KaTeX
      renderer imports at module scope, reachable transitively from the root) — this is why
      every fixture's bundle step uses `vite build`, not a standalone bundler CLI. "Runtime
      behavior" is exercised at the same level as every other fixture: real compilation +
      bundling of the actual compiled `dist/` output installed from the packed tarball, not a
      source-level assumption.
- [x] 6.5 Negative fixture: install the tarball for `./oauth` without
      `@epam/ai-dial-chat-shared`, assert the build fails and the failure names that
      specific peer.
      **Done**: `NEGATIVE_FIXTURE` in `fixtures.mjs`; its pass condition accepts only the exact
      missing specifier `@epam/ai-dial-chat-shared`, never an owning source filename.
- [x] 6.6 Side-effect fixtures: for the minimal and one heavy-entry bundle, assert the emitted
      bundle retains `toolsetLoginEventTarget`'s construction when `./oauth` is imported, and
      the two `LRUCache` constructions when `./file-manager` is imported (design.md D4) —
      proving `sideEffects` is respected, not stripped.
      **Done**: `SIDE_EFFECT_CHECKS`/`SIDE_EFFECT_SYMBOLS` in `fixtures.mjs`; the harness also
      verifies that every marker-bearing emitted chunk is covered by the published patterns,
      every pattern matches a packed file, and side-effect-only imports retain the markers.
      Neither check greps for the *declared identifier name* — `toolsetLoginEventTarget` and
      the `lru-cache` class's own local binding are both renamed to single letters by this
      package's production build (confirmed by inspecting the compiled output directly), so
      that string never appears in a real successful build. The markers that do survive:
      `new EventTarget()` (a call to a global constructor — bundlers rename local declarations,
      never references to globals) for oauth, and the bundled `lru-cache` class's own
      `[Symbol.toStringTag] = "LRUCache"` string literal for file-manager.
- [x] 6.7 Wire two fixture execution tiers into Nx and PR CI. Keep
      `test-packed` as the complete matrix (all 14 subpaths, legacy root, and negative case),
      and add `test-packed-smoke` for the three highest-value PR fixtures: `minimal`, `oauth`,
      and `negative-oauth`. Both targets run after `build`; the harness itself
      performs `publish-lib.mjs --dry=true` + `npm pack`, so a separate `publish` dependency
      would be redundant. The PR smoke SHALL retain the package-wide packed export/file check,
      minimal optional-peer isolation, the complete audited `sideEffects` manifest check, the
      OAuth side-effect-only bundle check, and the exact missing-peer failure. Do not run the
      full registry-backed matrix in PR CI.
      **Done**: `libs/chat-hooks/package.json#nx.targets` exposes both targets,
      `nx.json#targetDefaults` makes both depend on `build`, and
      `.github/workflows/pr.yml#chat_hooks_packed_smoke` runs only `test-packed-smoke`.
      The full registry-backed run remains available through `test-packed`; it previously took
      about 19 minutes for all 14 subpaths plus legacy-root and negative fixtures, so it is
      retained for local/release validation rather than made a required PR check.
      **Verified**: `npm exec nx run @epam/ai-dial-chat-hooks:test-packed-smoke` passes all three
      selected fixtures plus the packed export/file manifest, minimal isolation, complete
      side-effect manifest, and OAuth side-effect-only bundle checks.
- [ ] 6.8 Follow-up: configure a scheduled nightly (or equivalent release-gated) workflow to
      run `npm exec nx run @epam/ai-dial-chat-hooks:test-packed`. This is intentionally outside
      the current change; until that automation exists, maintainers invoke the full target
      explicitly before publishing changes to the package contract.

## 7. `apps/chat` representative migration

- [x] 7.1 Repoint `apps/chat/src/components/ConversationView/ConversationView.tsx` (and any
      other viewport/scroll import sites) to `@epam/ai-dial-chat-hooks/viewport-layout` and
      `/scroll-anchoring`.
      **Done**: `ConversationView.tsx` (`usePageFileDrag`→`/viewport-layout`,
      `useConversationScroll`→`/scroll-anchoring`), plus the other three call sites found by
      grepping `usePageFileDrag|usePanelMaxWidth|useViewportWidth|useConversationScroll` across
      `apps/chat/src`: `app/app.tsx` (`usePanelMaxWidth`, and `clearAttachmentCache`→
      `/file-manager` from the same import), `NewConversationComposer.tsx` (`usePageFileDrag`),
      `ConversationSourcesPanel.tsx` (`usePanelMaxWidth`, plus `useAttachmentAction`/
      `downloadAttachment`/`isDownloadableAttachment`→`/attachments`,
      `useConversationSources`→`/conversation-sources`, `isDialFileId`/
      `isExternalSourcePreviewable`→`/file-manager`, found while splitting that file's mixed
      import block). Updated the two affected spec files' `vi.mock` targets to match
      (`NewConversationComposer.spec.tsx`, `ConversationSourcesPanel.spec.tsx`).
      **Build-config correction found while verifying**: `apps/chat/vite.config.mts` aliases
      every workspace lib's bare package name (e.g. `@epam/ai-dial-chat-hooks`) straight to its
      `src/index.ts`, bypassing `package.json#exports` entirely for local dev/test. Vite's alias
      matcher treats a string `find` as a prefix match
      (`importee === find || importee.startsWith(find + '/')`), so the existing single
      `@epam/ai-dial-chat-hooks` alias also intercepted every new subpath import and rewrote it
      onto `src/index.ts/<subpath>` — a nonexistent path — failing with "Failed to resolve
      import". Fixed by adding one explicit alias per subpath (to its
      `src/entry-points/<name>.ts`) listed before the existing root alias, so the more specific
      match wins; this was necessary before any subpath import could work under `vitest`/`vite`
      for this app, not an optional cleanup.
- [x] 7.2 Repoint one representative file per remaining new entry (`./conversation-transfer`,
      `./file-manager`, `./catalog`, `./skills-state` or `./skill-editor`, `./oauth`,
      `./scheduled-tasks`, `./sharing`, `./attachments`) to its subpath — chosen from the 126
      files identified in the investigation, not an exhaustive migration.
      **Done** (one file per entry, superset of the required list):
      - `./conversation-transfer` + `./sharing`: `ConversationPanelView.tsx` (and its spec) —
        `useConversationExport`/`useConversationImport`/`formatQuotedNameList`/
        `ConversationExportMode`/the `ConversationTransfer*` types →`/conversation-transfer`;
        `useShareRecipientsCount`→`/sharing`.
      - `./file-manager`: `app.tsx`'s `clearAttachmentCache` (see 7.1) and
        `ConversationSourcesPanel.tsx`'s `isDialFileId`/`isExternalSourcePreviewable`.
      - `./catalog`: `FavoriteApplicationsContext.tsx` — `FavoriteEntityType`/
        `useFavoriteEntitiesState`→`/catalog`.
      - `./skills-state`: `SkillsContext.tsx` — `useSkillsState`→`/skills-state`.
      - `./skill-editor`: `useSkillFilePreviewSync.ts` — `SKILL_MANIFEST_FILE`/
        `skillFileToAttachment`/`SkillFileContent`→`/skill-editor`.
      - `./oauth`: `hooks/toolsets/useToolsetLogin.ts` — `useToolsetLogin`/
        `UseToolsetLoginResult`→`/oauth`.
      - `./scheduled-tasks`: `ScheduledTaskCreatePage.tsx` — `mapFormValuesToCreateBody`→
        `/scheduled-tasks`.
      - `./attachments`: `ConversationSourcesPanel.tsx`'s `useAttachmentAction`/
        `downloadAttachment`/`isDownloadableAttachment` (see 7.1).
      - `./conversation-sources` (bonus, not required): `ConversationSourcesPanel.tsx`'s
        `useConversationSources`.
      **Correction found while migrating**: task 1.1/design.md's dependency matrix placed
      `apSchedulerDayToJsDay`/`jsDayToApSchedulerDay`/`padTwoDigits` under `./scheduled-tasks`
      (they are *used* by `scheduled-task/scheduled-task-trigger.ts`), but they are *defined* in
      `shared/cron-weekday.ts`/`shared/formatting.ts` and re-exported only from `./utils`, not
      `./scheduled-tasks` — `map-scheduled-task-dto.ts` (which imports them directly) was
      repointed to `@epam/ai-dial-chat-hooks/utils` accordingly, and `ScheduledTaskCreatePage.tsx`
      (which imports `mapFormValuesToCreateBody` directly from `scheduled-task-trigger.ts`, a
      real `./scheduled-tasks` export) became the representative file for that entry instead.
- [x] 7.3 Run `npm exec nx affected --target=build,test,lint` against `chat-hooks` and `chat`
      to confirm the migrated files and the untouched 100+ files both still pass.
      **Done**: `npm exec nx typecheck @epam/ai-dial-chat-hooks` and `npm exec nx typecheck chat`
      both pass. All 6 touched spec files pass via `npm run test:file` (one required an
      additional fix: `ConversationPanelView.spec.tsx` imported `useConversationExport`/
      `useConversationImport` directly from the root for `vi.mocked(...)` typing — repointed to
      `/conversation-transfer` alongside its `vi.mock` target). `npm exec nx lint chat` (fresh,
      after `nx reset`) reports only two pre-existing, unrelated failures on `origin/development`
      (`ClientChannelContext.tsx` prettier, `ScheduledTaskDetailPage.spec.tsx` a11y warning —
      confirmed via `git diff --stat` these files are untouched by this change) plus one
      genuine prettier fix applied to `ConversationSourcesPanel.spec.tsx`. `chat-api`/
      `mcp-app-sandbox` typecheck failures surfaced by `nx affected` are pre-existing on a clean
      `origin/development` checkout (confirmed via `git stash`), unrelated to this change.

## 8. Documentation

- [x] 8.1 Rewrite `libs/chat-hooks/README.md`'s peer-dependency section into the
      entry-point-to-dependency matrix from `design.md`, add the six previously-undocumented
      real peers, and remove the `ag-grid-community` row.
      **Done**: replaced the flat bullet list with an intro paragraph (react is the only
      mandatory peer; every `@epam/ai-dial-*` peer is optional per
      `peerDependenciesMeta`), the full 17-peer list, and a 15-row "Entry-point-to-peer
      matrix" table (root + 14 subpaths) with separate "Runtime peers" and "Type-only
      peers" columns transcribed from `design.md`'s Context table. Added the six peers
      `package.json` already listed but the old section didn't
      (`@epam/ai-dial-catalog`, `@epam/ai-dial-chat-overlay`,
      `@epam/ai-dial-deployment-creation-form`, `@epam/ai-dial-publish-panel`,
      `@epam/ai-dial-scheduled-tasks`, `@epam/ai-dial-skill-editor`) and called that drift
      out explicitly in a closing note. Removed `ag-grid-community` and `fflate` from the
      peer list, with a sentence explaining why (`ag-grid-community`: no import site, never
      in `package.json`; `fflate`: bundled into `./conversation-transfer`/`./skill-editor`,
      not a peer).
- [x] 8.2 Add a "Subpath imports" section with one example per new entry point.
      **Done**: added a "Subpath imports" section with 14 code fences, one per entry point
      (`viewport-layout`, `scroll-anchoring`, `conversation`, `conversation-transfer`,
      `conversation-sources`, `file-manager`, `catalog`, `skills-state`, `skill-editor`,
      `oauth`, `scheduled-tasks`, `sharing`, `attachments`, `utils`), each importing a real,
      verified export from that entry's actual `src/entry-points/*.ts` barrel
      (`useViewportWidth`, `useConversationScroll`, `getLastDeploymentId`, `formatDateYMD`,
      `useConversationSources`, `sanitizeFileName`, `encodeDeploymentId`, `useSkillsState`,
      `normalizeSkillName`, `encodeToolsetId`/`isPublicToolsetId`,
      `mapFormValuesToCreateBody`, `useShareRecipientsCount`, `useAttachmentValidation`,
      `getBrowserTimezone`) — every name checked against its owning source file, not
      invented from the concept.
- [x] 8.3 Add a "Missing peer" troubleshooting section documenting the build-time failure
      shape from task 6.5.
      **Done**: added a "Missing a peer" section showing the two failure shapes actually
      seen (a Rollup/Vite unresolved-import error and a `tsc` `TS2307` error), explaining
      that `npm install` succeeds regardless (every peer is optional) and the failure
      surfaces only at build time, scoped to the one missing specifier — matching task
      6.5's negative-fixture behavior (build fails and names the exact missing peer).
- [x] 8.4 Add the legacy-root compatibility policy statement (root entry stays, no forced
      migration).
      **Done**: added a "Legacy root compatibility" section stating the root (`.`) entry is
      unchanged in behavior and public surface, still requires the full 17-peer set, every
      existing `@epam/ai-dial-chat-hooks` import keeps working, and no consumer is required
      to migrate to a subpath.
- [x] 8.5 Run `npm run validate:docs` and fix any reported drift.
      **Done**: restored the documented backward-compatible `useGridEditingScroll` re-export
      from the root and `./file-manager` entries; `npm run validate:docs` passes.

## 9. Final verification

- [x] 9.1 `npm exec nx run-many --target=build,lint,test --projects=@epam/ai-dial-chat-hooks`
      **Done**: build succeeds (15 `.js`/`.d.ts` entry pairs); all 109 test files / 1400 tests
      pass; lint succeeds with 12 existing non-null-assertion warnings and no errors.
      **Environment issue found and fixed along the way**: root `package.json`'s
      `@epam/ai-dial-ui-kit` dependency had been pointed at a nonexistent local tarball path
      (`file:../ai-dial-ui-kit/fixtures/.tarballs/...`), corrupting `node_modules` (a nested,
      incomplete `react` install under `@epam/ai-dial-ui-kit/dist/node_modules/react` missing
      `index.js`/`package.json`) and breaking `chat-hooks`'s test run. This was already present
      as an uncommitted change before this task started (not introduced by any task in this
      change) — confirmed with the user before reverting `package.json`'s dependency back to
      `^0.14.0-dev.15` and running `npm install`, which fixed both the lockfile and the broken
      nested install; `chat-hooks`'s test suite passes cleanly after the fix.
- [x] 9.2 `npm exec nx affected --target=build,lint,test` (base `origin/development`) to cover
      the migrated `apps/chat` files.
      **Done**: build and test succeed for all 30 affected projects (plus 27 dependency tasks).
      Only 3 lint failures, all pre-existing and unrelated (confirmed via `git diff --stat`
      showing zero delta on each file): `@epam/ai-dial-catalog` (`Card.tsx`,
      `Toolbar.spec.tsx` — prettier), `@epam/ai-dial-chat-hooks` (see 9.1),
      `@epam/chat` (`ClientChannelContext.tsx` prettier, `ScheduledTaskDetailPage.spec.tsx` a11y
      warning — both already confirmed untouched in task 7.3's verification).
- [x] 9.3 `npm run validate:docs`
      **Done**: passes after restoring the documented `useGridEditingScroll` exports.
- [x] 9.4 `openspec validate modularize-chat-hooks-package-exports --strict`
      **Done**: "Change 'modularize-chat-hooks-package-exports' is valid".
