## Context

### Current state (verified against the repository, not assumed)

`libs/chat-hooks/package.json`:
- `exports`: only `.` (`{"@epam/source": "./src/index.ts", "types": "./dist/index.d.ts", "import": "./dist/index.js", "default": "./dist/index.js"}`) and `./package.json`.
- `dependencies`: `dompurify@3.4.13`, `lru-cache@^10.4.3`, `mime-types@^3.0.2`, `yaml@2.8.3` (4).
- `peerDependencies` (17): `react`, plus 15 `@epam/ai-dial-*` packages and `fflate`.
- `peerDependenciesMeta`: absent — none of the 17 are optional.
- `sideEffects`: absent from the manifest entirely.

`libs/chat-hooks/vite.config.mts`: single `build.lib.entry: 'src/index.ts'`, `formats: ['es']`
only, a flat `rollupOptions.external` list of 18 specifiers (`react`, `react-dom`,
`react/jsx-runtime`, 15 `@epam/ai-dial-*` peers, `ag-grid-community`, `fflate`).
`dompurify`/`lru-cache`/`mime-types`/`yaml` are **not** in that list, so Rollup bundles them
into `dist/index.js` — while `package.json#dependencies` also declares them, so a consumer
installs them a second time. `vite-plugin-dts` runs with `entryRoot: 'src'` against
`tsconfig.lib.json`.

`libs/chat-hooks/dist/index.js`: 560,642 bytes / 19,038 lines. Its own top-level `import`
statements name 14 external specifiers (the 18 externals minus `react-dom`,
`react/jsx-runtime`, `@epam/ai-dial-chat-overlay`, and `@epam/ai-dial-deployment-creation-form`
— the last two are imported only as erased TypeScript types, so no runtime `import` for them
survives compilation even though they remain in `peerDependencies`).

`libs/chat-hooks/tsconfig.lib.json` carries 13 project `references` to sibling libs — one per
peer that has real (non-type-only-in-every-usage) import sites, plus a few type-only ones.

Nx has no `libs/chat-hooks/project.json`; the `build`/`typecheck`/`test`/`publish` targets are
inferred from `vite.config.mts` / `tsconfig.lib.json` by the `@nx/vite` and `@nx/js` plugins.
The `publish` target runs `node tools/publish-lib.mjs @epam/ai-dial-chat-hooks --version=...`.

`tools/publish-lib.mjs`'s `rewriteExportsObj` (lines 209–220) already recurses into every
plain-object value and array of the `exports` map, stripping the `./dist/` prefix and the
`@epam/source` condition at any depth — confirmed by reading the function, not inferred.
**Adding new subpath entries requires no change to this function.** It does not, however,
touch a top-level `sideEffects` array the way it touches `main`/`module`/`types`/`exports`
(lines 259–262) — a gap this change has to close, since it introduces the first real
`sideEffects` list this package has ever declared.

Vite is pinned `^8.0.0`, resolved to `8.0.16`, whose own `dependencies` include
`rolldown@1.0.3` directly — this is Vite 8's built-in Rolldown-powered bundler, not a
separate `rolldown-vite` package alias. `vite-plugin-dts` is `~4.5.0`. Design decisions below
target Vite 8's documented library-mode multi-entry API, not legacy Rollup-only flags.

### Dependency matrix (domain → external imports → peer/bundle treatment)

Built from a file-by-file `import` audit of every top-level folder under `libs/chat-hooks/src/`
(full per-file citations captured during investigation; summarized here per proposed entry).

**Reconciled against the current source (task 1.1)**: the table below corrects six drifts found
by a fresh, complete grep pass over every `src/**/*.ts` file (excluding `tests/`) that the
original audit either missed (two new files, two unassigned top-level hook folders) or
mis-classified (three peers recorded as absent or type-only that are actually runtime, or
present under the wrong entry). The initial source audit changed only the per-entry breakdown;
a later strict audit of the rolled-up declarations additionally found that `./file-manager.d.ts`
directly exposes `@epam/pdf-highlighter-kit`, so D2 declares that existing type requirement as
an optional peer:
- `skill/useSkillEditorLoad.ts` and `skill/useSkillFileActions.ts` (both import
  `@epam/ai-dial-skill-editor` at runtime) exist in `src/` but were absent from the original
  matrix and from tasks.md's `./skill-editor` task — both belong there alongside `skill.ts`.
- `skill/skill-file-preview.ts` (exports `skillFileToAttachment`, `SkillFileContent`; type-only
  imports `SkillFileTreeNode` from `@epam/ai-dial-skill-editor`) was unassigned. Its only
  runtime consumer (`skillFileToAttachment`, used by `apps/chat/src/hooks/attachment/
  useSkillFilePreviewSync.ts`) is a skill-editing concern, matching its README placement under
  "Skill Utilities" — it belongs to `./skill-editor`. `./catalog`'s `useSkillFilePreview` hook
  and `useCatalogItemDetails.ts` both import only this file's `SkillFileContent` type, which
  keeps catalog's `@epam/ai-dial-skill-editor` peer type-only but through `SkillFileContent`'s
  owning module, not through `SkillFileTreeNode` directly as previously cited.
- `useChatSettingsFormConfig/` and `useToolsMenu/` (two top-level `src/` folders, both hooks
  with no peer beyond a type-only `@epam/ai-dial-chat-shared` import) were exported from
  `index.ts` but assigned to no entry. Grouped into `./conversation`, whose peer footprint
  already covers `@epam/ai-dial-chat-shared`.
- `./conversation` (via `useConversationStream/apply-chunk.ts`'s runtime
  `normalizeRawAnnotations` import) and `./conversation-sources` (via
  `useConversationSources.ts`'s runtime import) both actually require
  `@epam/ai-dial-quotations`; the original matrix listed it for neither.
- `./conversation-transfer`'s `@epam/ai-dial-chat-api-client` peer is runtime, not type-only —
  `useConversationExport.ts` imports the `ResponseError` class as a value.
- `./file-manager`'s `@epam/ai-dial-react-file-manager` peer is runtime, not "types only" as
  previously framed — `DialFileNodeType` and `DialFileManagerTabs` are imported and compared as
  enum values across seven files (`dial-file-manager-copy-move.util.ts`,
  `dial-file-manager-mapping.util.ts`, `dial-file-manager-path.util.ts`,
  `dial-file-manager.types.ts`, `resolve-dial-file-api-path.ts`, `useDialFileListing.ts`,
  `useDialFileManager.ts`, `useDialFileManagerTabConfig.ts`, `useDialFileMutations.ts`,
  `useDialFileUploadBatch.ts`).
- `./attachments` (`useAttachmentAction.ts`'s runtime `useAttachmentCanvas` import) also
  requires `@epam/ai-dial-attachment-canvas`, undocumented in the original row.
- `./utils` (`shared/locale.ts`) also has a type-only peer on
  `@epam/ai-dial-deployment-creation-form`, undocumented in the original row.
- `./skills-state` (`useSkillsState.ts`), `./skill-editor` (`useSkillEditorLoad.ts`,
  `useSkillEditorSubmit.ts`), `./oauth` (`useToolsetLogin.ts`), and `./scheduled-tasks`
  (`scheduled-task-trigger.ts`) each have a type-only `@epam/ai-dial-chat-api-client` peer the
  original matrix omitted (recorded as "—" for `./skills-state`, and absent from the type-only
  column for the other three).
- `skill/skill-types.ts` (exports `SkillSource`, `PUBLIC_SKILL_BUCKET`,
  `parseSkillResourceUrl`, and related constants/types) was unassigned. Its only consumers are
  `catalog/map-skill-to-catalog-item.ts` and `catalog/useCatalogItemDetails.ts` — it belongs to
  `./catalog`, not `./skill-editor`, despite living under `skill/`. Its own type-only import of
  `SkillAboutDetails` from `skill-manifest.ts` is erased at compile time and does not pull the
  `yaml` bundle (owned by `./skill-editor`) into `./catalog`'s output.

| Proposed entry | Owns (src folders) | Runtime peers beyond `react` | Type-only peers | Bundled impl. deps | Side effects |
| --- | --- | --- | --- | --- | --- |
| `.` (root, unchanged) | everything | every runtime peer appearing below | `@epam/ai-dial-chat-overlay`, `@epam/ai-dial-deployment-creation-form`, `@epam/ai-dial-source-panel`, `@epam/pdf-highlighter-kit` | `dompurify`, `lru-cache`, `mime-types`, `yaml`, `fflate` | yes (see below) |
| `./viewport-layout` | `useViewportWidth/`, `usePanelMaxWidth/`, `usePageFileDrag/` | — | — | — | no |
| `./scroll-anchoring` | `conversation/useConversationScroll/` | — | — | — | no |
| `./conversation` | `conversation/*` core (`useConversationHandlers`, `useConversationStream`, `useAttachmentUpload`, announcement/footer/greeting messages, `generation-resume`, `display-name-watch`, `overlay-messages`, `quick-app-conversation-starters`, and the rest of `conversation/*` not owned by `./conversation-transfer` or `./scroll-anchoring`), plus `useChatSettingsFormConfig/`, `useToolsMenu/` | `@epam/ai-dial-chat-api-client`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-quotations` | `@epam/ai-dial-publish-panel`, `@epam/ai-dial-chat-overlay` | `dompurify` | no |
| `./conversation-transfer` | `conversation/conversation-transfer/*` + its hook subfolders (`useConversationExport/`, `useConversationImport/`) | `@epam/ai-dial-chat-api-client`, `@epam/ai-dial-chat-shared` | — | `fflate` | no |
| `./conversation-sources` | `conversation-sources/*` | `@epam/ai-dial-chat-shared`, `@epam/ai-dial-quotations` | `@epam/ai-dial-source-panel` | — | no |
| `./file-manager` | `files/*` | `@epam/ai-dial-react-file-manager`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-api-client`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-attachment-canvas`, `@epam/ai-dial-quotations` | `@epam/pdf-highlighter-kit` | `lru-cache`, `mime-types` | **yes** — two module-scope `LRUCache` instances |
| `./catalog` | `catalog/*` (incl. favorites, publish-folders, `useSkillFilePreview`, `skill-types.ts`) | `@epam/ai-dial-catalog`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-chat-api-client`, `@epam/ai-dial-attachment-input`, `@epam/ai-dial-publish-panel`, `@epam/ai-dial-skill-editor` (runtime — see task 6 correction below) | — | — | no |
| `./skills-state` | `skill/useSkillsState/` | — (fetch injected via `listSkills` callback param) | `@epam/ai-dial-chat-api-client` | — | no |
| `./skill-editor` | `skill/skill.ts`, `skill/skill-manifest.ts`, `skill/useSkillEditorSubmit.ts`, `skill/skill-file-batch-validation.ts`, `skill/useSkillEditorLoad.ts`, `skill/useSkillFileActions.ts`, `skill/skill-file-preview.ts` | `@epam/ai-dial-skill-editor`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit` | `@epam/ai-dial-chat-api-client` | `yaml`, `fflate` | no |
| `./oauth` | `oauth/*`, `shared/toolset-login-events.ts` | `@epam/ai-dial-chat-shared` | `@epam/ai-dial-chat-api-client` | — | **yes** — module-scope `EventTarget` singleton |
| `./scheduled-tasks` | `scheduled-task/*` | `@epam/ai-dial-scheduled-tasks` | `@epam/ai-dial-chat-api-client` | — | no |
| `./sharing` | `useShareLink/`, `useShareRecipientsCount/` | `@epam/ai-dial-share`, `@epam/ai-dial-chat-api-client` (runtime — see task 6 correction below) | — | — | no |
| `./attachments` | `attachment/*` | `@epam/ai-dial-quotations`, `@epam/ai-dial-attachment-input`, `@epam/ai-dial-attachment-canvas`, `@epam/ai-dial-chat-shared` | — | — | no |
| `./utils` | `shared/*` (minus `toolset-login-events.ts`), `usage/*`, `api-error/*`, `api-transport/*`, `prompt/*` | — | `@epam/ai-dial-chat-api-client`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-deployment-creation-form` | — | no |

`ag-grid-community` appears in no row: it has zero import sites anywhere in `src/`, is absent
from `package.json#peerDependencies`, and is dropped from `vite.config.mts`'s external list
and the README as dead configuration.

**Corrected against the packed-package fixtures (task 6)**: task 1.1's reconciliation classified
`./catalog`'s `@epam/ai-dial-skill-editor` peer and `./sharing`'s `@epam/ai-dial-chat-api-client`
peer as type-only. Both are actually runtime — the packed-tarball fixtures (design.md D5) caught
this by failing to bundle with only the documented peers installed, which a source-level
`import`/`import type` grep audit cannot catch when the runtime usage is one hop removed from
the file the earlier audit read:
- `./sharing`: `useShareLink/useShareLink.ts` does `level === ShareLinkResponseDtoAccessEnum.Edit`
  — a real value comparison against a `@epam/ai-dial-chat-api-client` enum, not a type reference.
- `./catalog`: `catalog/useCatalogItemDetails.ts` imports the value `SKILL_MANIFEST_FILE` from
  `skill/skill.ts` (not `skill-manifest.ts`, and not type-only). `skill.ts` itself does
  `node.kind === SkillFileNodeKind.File` — a real value from `@epam/ai-dial-skill-editor` — in
  the same file. Compiling in `SKILL_MANIFEST_FILE` compiles in the whole module, including that
  runtime dependency; `useCatalogItemDetails.ts`'s own imports from `skill/` are otherwise
  genuinely type-only, which is what the original audit saw.

Both are now optional peers like every other `@epam/ai-dial-*` peer (D2 already marks all of them
optional package-wide) — this correction only moves them from the "type-only, omit from a
minimal-peer consumer's install" column to "runtime, a consumer of this entry needs it," which
task 6's fixtures now install for both entries.

### Side-effect audit (module scope, on-import)

Two genuine, observable global-state constructs exist:
- `shared/toolset-login-events.ts:10` — `const toolsetLoginEventTarget = new EventTarget();`,
  a singleton retained for the module's lifetime, used for same-window cross-tree
  notification. Lands in `./oauth`.
- `files/attachment-canvas.ts:153-154` — two `new LRUCache(...)` instances (`blobCache`,
  `textCache`), retaining cached `Promise`s across the module's lifetime, explicitly cleared
  only by calling `clearAttachmentCache()`. Lands in `./file-manager`.

Everything else audited (`Intl.NumberFormat` construction in
`catalog/map-deployment-limits-to-catalog.ts`, module-scope `Set`/constant declarations in
`scheduled-task/scheduled-task-trigger.ts` and `skill/skill.ts`) allocates a plain, inert
value with no observable effect beyond memory — safe to treat as side-effect-free. No
module-scope `addEventListener`, CSS import, or polyfill exists anywhere in `src/`; the three
`addEventListener` call sites found (`useViewportWidth`, `usePageFileDrag`,
`oauth/handshake.ts`) are all inside function/hook bodies, firing only on invocation.

## Goals / Non-Goals

**Goals:**
- Let a consumer of one dependency-light hook install only `react`.
- Let a consumer of one dependency-heavy feature install exactly that feature's peers,
  without npm/pnpm warning about or refusing to install the other 16 peers' absence.
- Give every implementation-only dependency (`dompurify`, `lru-cache`, `mime-types`, `yaml`,
  `fflate`) exactly one delivery model.
- Keep the root entry byte-for-byte behaviorally identical for existing consumers.
- Make `sideEffects` accurate and verified, not asserted.

**Non-Goals** (restated from the proposal for traceability):
- Splitting into multiple npm packages.
- Changing any hook's behavior, signature, or state ownership.
- Migrating all 126 `apps/chat` import sites — only a representative sample per entry.
- Moving `libs/conversation-stages/src/utils/stage-name.ts` or creating any
  `@epam/ai-dial-conversation-stages` subpath.
- Redesigning `useSkillFilePreview`'s ownership split between `skill/` (implementation) and
  the `catalog-orchestration` capability (consumer-facing grouping) — the entry-point mapping
  above resolves it pragmatically (grouped with `./catalog` by capability, not by folder) but
  a deeper reorganization of `skill/` vs. `catalog/` folder boundaries is out of scope.

## Decisions

### D1 — One npm package, many ESM subpath entries, kept as thin barrels

Each new subpath (`./viewport-layout`, `./conversation-transfer`, etc.) is a new, small barrel
file under `libs/chat-hooks/src/entry-points/<name>.ts` that re-exports the relevant existing
named exports from their current locations. No existing domain folder moves. `src/index.ts`
(the root barrel) is untouched — it keeps re-exporting everything exactly as today.

`vite.config.mts`'s `build.lib.entry` becomes an object map (Vite 8 lib-mode's documented
multi-entry form):
```ts
entry: {
  index: 'src/index.ts',
  'viewport-layout': 'src/entry-points/viewport-layout.ts',
  'scroll-anchoring': 'src/entry-points/scroll-anchoring.ts',
  // ... one line per subpath in the matrix above
}
```
`rollupOptions.external` stays a **single flat list** shared across every entry — Rollup/
Rolldown only emits an `import` for a specifier an entry's own module graph actually reaches,
so a shared external list does not force an unrelated import into a lightweight entry's
output; it only makes bundling-vs-externalizing a per-package (not per-entry) decision.
`vite-plugin-dts` (`~4.5.0`) supports the same `entry` object and emits one rolled-up `.d.ts`
per key.

**Corrected against the actual multi-entry build (task 3.4)**: this section originally assumed
Rollup's lib-mode chunk-splitting stays off for multi-entry builds the way it is for the
existing single-entry build, so that code shared between two entries (say, a helper both
`./catalog` and `./skill-editor` import) would be duplicated into each entry's own output file
rather than factored into a shared chunk. Building the 15-entry map (task 3.1–3.4) shows this
is wrong: Rollup/Rolldown's default multi-entry behavior factors shared modules into separate,
content-hashed chunk files (e.g. `useToolsetLogin-GhFtKs4D.js`, `attachment-types-AAoN9E95.js`)
that each entry's own compiled file imports by relative path for the code it shares with
another entry — there is no `manualChunks`/`inlineDynamicImports` override in this config
suppressing that, and none is being added. This does not weaken isolation: an entry's own file
plus the chunk files it transitively imports still contain no code exclusive to another entry
(spot-checked: `viewport-layout.js` imports only its own shared `usePanelMaxWidth-*.js` chunk;
`oauth.js` imports only `toolset-id-*.js`/`useToolsetLogin-*.js`), and the published artifact is
smaller than duplication would produce, not larger. It does mean the "verified tree shaking"
requirement's fixtures (task 6) must assert isolation against an entry's full transitive chunk
graph after installing the packed tarball, not against a single output file in isolation — the
per-file framing below is retired in favor of that. This is the exact risk this document's own
Risks section flagged ("Vite 8/Rolldown multi-entry lib-mode behavior around chunk
de-duplication could differ from assumptions here") materializing during task 3, not task 9.

**Alternative rejected**: generate the barrels rather than write them by hand. Rejected — the
domain-to-entry mapping needs human judgement (e.g., `useSkillFilePreview` living under
`skill/` but grouped with `./catalog`), and 14 short hand-written files are easier to review
and keep correct than a generator that has to encode the same judgement calls.

### D2 — `package.json#exports`: one subpath block per entry, `peerDependenciesMeta` marks everything but `react` optional

```json
"exports": {
  "./package.json": "./package.json",
  ".": {
    "@epam/source": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "default": "./dist/index.js"
  },
  "./viewport-layout": {
    "@epam/source": "./src/entry-points/viewport-layout.ts",
    "types": "./dist/viewport-layout.d.ts",
    "import": "./dist/viewport-layout.js",
    "default": "./dist/viewport-layout.js"
  }
  /* ... one block per remaining entry, same shape */
},
"peerDependencies": {
  "react": "^19.2.6",
  "@epam/ai-dial-attachment-canvas": "*",
  "@epam/ai-dial-attachment-input": "*",
  "@epam/ai-dial-catalog": "*",
  "@epam/ai-dial-chat-api-client": "*",
  "@epam/ai-dial-chat-overlay": "*",
  "@epam/ai-dial-chat-shared": "*",
  "@epam/ai-dial-deployment-creation-form": "*",
  "@epam/ai-dial-publish-panel": "*",
  "@epam/ai-dial-quotations": "*",
  "@epam/ai-dial-react-file-manager": "*",
  "@epam/ai-dial-scheduled-tasks": "*",
  "@epam/ai-dial-share": "*",
  "@epam/ai-dial-skill-editor": "*",
  "@epam/ai-dial-source-panel": "*",
  "@epam/ai-dial-ui-kit": "*",
  "@epam/pdf-highlighter-kit": ">=0.0.14"
},
"peerDependenciesMeta": {
  "@epam/ai-dial-attachment-canvas": { "optional": true },
  "@epam/ai-dial-attachment-input": { "optional": true },
  "@epam/ai-dial-catalog": { "optional": true },
  "@epam/ai-dial-chat-api-client": { "optional": true },
  "@epam/ai-dial-chat-overlay": { "optional": true },
  "@epam/ai-dial-chat-shared": { "optional": true },
  "@epam/ai-dial-deployment-creation-form": { "optional": true },
  "@epam/ai-dial-publish-panel": { "optional": true },
  "@epam/ai-dial-quotations": { "optional": true },
  "@epam/ai-dial-react-file-manager": { "optional": true },
  "@epam/ai-dial-scheduled-tasks": { "optional": true },
  "@epam/ai-dial-share": { "optional": true },
  "@epam/ai-dial-skill-editor": { "optional": true },
  "@epam/ai-dial-source-panel": { "optional": true },
  "@epam/ai-dial-ui-kit": { "optional": true },
  "@epam/pdf-highlighter-kit": { "optional": true }
}
```
`fflate` and `ag-grid-community` are removed from `peerDependencies` entirely (D3 covers
`fflate`; `ag-grid-community` was already dead). `react` stays the one mandatory peer,
matching the pre-existing (if package-wide-inaccurate-until-now) `chat-hooks-scroll-anchoring`
requirement.

npm/pnpm/yarn do not support per-subpath `peerDependencies` — the field is package-wide by
construction. Marking every feature peer `optional` is the only mechanism that lets `npm
install` succeed for a minimal consumer without any of the 16 peers present, while a consumer
who *does* import a heavy entry without its peers gets a **module-resolution or type error at
build time** (Vite/tsc cannot resolve the specifier), which is the "clear error scoped to that
peer" the proposal's required behavior calls for — install-time silence, build-time failure.

**Alternative rejected**: keep all peers mandatory and rely on tree-shaking alone. Rejected —
this is exactly the status quo the proposal's Problem section shows to be insufficient
(`npm install` resolves declared dependencies before any bundler runs).

### D3 — `fflate`, `dompurify`, `lru-cache`, `mime-types`, `yaml`: bundle, never externalize, never re-declare as a runtime dependency field

All five currently have inconsistent treatment (dompurify/lru-cache/mime-types/yaml: bundled
*and* declared as `dependencies`; fflate: externalized *and* declared as a mandatory peer).
The fix applies one rule uniformly: **an implementation-only dependency the consumer never
imports by name is bundled into every entry that uses it and appears in no runtime dependency
field** (`dependencies`, `peerDependencies`, or `peerDependenciesMeta`) at all. Concretely:
- Remove `dompurify`, `lru-cache`, `mime-types`, `yaml` from `dependencies`.
- Remove `fflate` from `peerDependencies`/`vite.config.mts`'s external list.
- None of the five appear anywhere in the published `package.json`'s dependency fields; they
  remain listed in `libs/chat-hooks/package.json`'s own (unpublished-shape) build-time
  dependency graph via the workspace's root lockfile, which is how Vite resolves them to
  bundle at build time — no different from any other bundled-in transitive implementation
  detail.

This directly satisfies "a consumer that does not import `./conversation-transfer` or
`./skill-editor` is not required to provide `fflate`" — there is no `fflate` dependency
declaration of any kind for `npm install` to see, and no consumer code path needs it unless it
imports one of the two entries that bundle it.

**Alternative rejected**: keep `fflate` external and add `peerDependenciesMeta.fflate.optional
= true`. Rejected — `fflate` is a genuine implementation detail (a zip codec used inside a
`.dial` export/import format and a skill-archive reader), never referenced by name in any
public type or return value; bundling it removes an install step for every consumer with zero
behavioral cost, versus "optional peer" which still asks two entries' worth of consumers to
separately discover and install it.

### D4 — `sideEffects`: an explicit array, not `false`, and a fix to `publish-lib.mjs`

```json
"sideEffects": [
  "./dist/index.js",
  "./dist/oauth.js",
  "./dist/file-manager.js",
  "./dist/useToolsetLogin-*.js",
  "./dist/useDialFileManagerTabConfig-*.js"
]
```
The three stable entry facades and the two content-hashed shared chunks that actually contain
the audited state are retained. Every other compiled output is absent from the array, i.e.
side-effect-free. This is based on the audit in Context, not asserted — the two real
module-scope constructs (`toolsetLoginEventTarget`, the two `LRUCache` instances) are the only
ones with any persistent, observable state. The hashed chunk globs are necessary because the
multi-entry build factors each implementation out of its public facade.

`tools/publish-lib.mjs` strips the `./dist/` prefix from `main`/`module`/`types`/`exports`
(because `npm publish` runs from inside `dist/`, which becomes the package root) but has no
equivalent handling for a `sideEffects` array — it would ship as `["./dist/index.js", ...]`
verbatim, which resolves to a nonexistent nested `dist/` folder inside the published package
and silently defeats the whole point of declaring it. This change adds a `rewriteSideEffects`
step (mapping `stripDistPrefix` over the array, mirroring the existing `main`/`module`/`types`
handling at lines 259–261) before the package.json is written to `dist/`.

The harness locates the stable marker emitted for each audited construct, verifies that its
hashed chunk matches a published pattern, and production-bundles side-effect-only imports of
`./oauth` and `./file-manager`. Their bundles must retain `new EventTarget()` and `LRUCache`,
respectively, while the minimal bundle contains neither marker. This tests the metadata itself;
an `export *` consumer alone would keep exports alive even if the metadata were wrong.

**Alternative rejected**: `sideEffects: false`. Rejected outright by the audit — it would be a
false claim that a bundler could act on (e.g., dropping the `EventTarget` singleton or the
`LRUCache` construction believing it's dead code), silently breaking `./oauth` or
`./file-manager` behavior for any consumer whose bundler prunes on that basis.

### D5 — Consumer fixtures install the packed tarball, not `@epam/source`

New fixtures under (proposed) `libs/chat-hooks/e2e-fixtures/` (or an Nx-conventional
`packages-e2e`-style location — exact path decided during implementation against the
workspace's existing fixture conventions, if any exist for other libs) each run `npm pack`
against the built `dist/` (after the same `publish-lib.mjs` transform, `--dry=true`) into a
tarball, `npm install` it into an isolated `node_modules`, and then typecheck + production-
bundle a small consumer file:
1. **Minimal**: imports only `./viewport-layout`, installs only the `react` runtime peer plus
   consumer-owned `@types/react` tooling.
2. **One per published subpath**: installs exactly that entry's documented runtime and
   type-only peers, verifies every external specifier in the entry's rolled-up `.d.ts` resolves,
   then typechecks the consumer and production-bundles it. The consumer typecheck skips peer
   libraries' own declaration bodies because several UI peers publish React-18/Monaco types
   that are not valid under React 19 + `moduleResolution: bundler`; the explicit rolled-up
   import check keeps missing type-only peers observable without owning those upstream defects.
3. **Legacy root**: imports from `.`, installs `react` plus the full 16-peer optional set.
4. **Negative**: imports `./oauth` without installing `@epam/ai-dial-chat-shared`, asserts the
   build fails with an error naming that exact specifier.
5. **Packed-file contract**: compares every published export target and every emitted `dist/`
   file with the `npm pack --json` file list before any consumer fixture runs.

The dependency plan is derived for every run instead of storing release versions in fixture
files. Each publishable workspace peer in the transitive peer closure is built and packed from
the current checkout. `publish-lib.mjs` assigns chat-hooks and all of those local tarballs the
same synthetic version (`0.0.0-packed.0`), preserving its workspace-peer version invariant.
External peers are installed at their exact root `package-lock.json` versions; exact-version
registry metadata supplies their required peer closure. Mutable selectors (`development`,
`latest`, or an open range) never choose a fixture version. A normal PR therefore needs no
fixture-version refresh: checkout and lockfile changes are picked up automatically.

The harness exposes two Nx execution tiers. `test-packed-smoke`, required by PR CI, runs the
`minimal`, `oauth`, and `negative-oauth` consumers. That selection exercises optional-peer
isolation, one representative audited side-effect implementation, and the expected missing-peer
failure while the package-wide packed-file/export and complete `sideEffects` manifest checks
(including the file-manager marker-bearing chunk) still run once for the entire artifact.
`test-packed` runs all 14 subpath consumers plus the legacy-root and negative consumers. The
complete matrix remains available for local and release validation but is deliberately not a
PR gate: every consumer performs a real isolated install, and the complete
16-fixture matrix takes about 19 minutes. A scheduled nightly workflow is follow-up work, not
part of this change.

This is why the monorepo's `@epam/source` condition must **not** be present for these
fixtures (unlike normal in-repo consumption): that condition point straight at `src/`,
bypassing exactly the packaging boundary under test.

**Alternative rejected**: assert success by import graph/static analysis of `src/` instead of
an actual `npm pack` + `npm install` + build. Rejected — the proposal explicitly calls this out
as insufficient ("tests inspect the installed dependency tree and emitted bundle, rather than
assuming success from the library's own build"), and the whole class of bug this change fixes
(npm resolving `peerDependencies` before any bundler runs) is invisible to source-level
analysis by construction.

### D6 — README rewrite: entry-point-to-dependency matrix, corrected peers, optional-peer failure guidance

`README.md`'s peer-dependency section is replaced with the matrix from Context (one row per
entry, its peers, and which are new-optional), the six missing real peers are added, and
`ag-grid-community` is removed. A short "Missing an optional peer" section documents the
build-time failure shape from D2/D5's negative fixture, so a consumer debugging a resolution
error for, say, `@epam/ai-dial-skill-editor` can recognize it as "install this one peer," not
"something is broken."

## Alternatives compared (proposal §Alternatives)

| Option | Correctness | Install footprint | Bundle/type isolation | Compatibility | Delivery risk | Release overhead | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1. `sideEffects: false` only | Fails the audit (D4) — would be a false claim | Unchanged (still 17 mandatory peers) | Unchanged — still one entry | Full | Low | Trivial | Trivial |
| 2. Optional peers only, single entry | Fixes install footprint | Fixed | **Not fixed** — one `dist/index.js` still ~560 KB regardless of which hook is used; type resolution still touches all domains | Full | Low | Trivial | Trivial |
| 3. Subpaths + optional peers + accurate `sideEffects`, root kept (chosen) | Fixes all four concerns (install, runtime resolution, type resolution, bundle size) named in the proposal | Fixed | Fixed per entry | Full — root unchanged | Medium — new build/export-map surface, mitigated by D5's packed-artifact tests | Same publish pipeline (D1's `publish-lib.mjs` fix is small) | Root entry never changes shape; revert build/manifest files only |
| 4. Independently versioned packages, `chat-hooks` as aggregator | Same correctness ceiling as option 3 | Same as option 3, potentially better (each package's own lockfile entry) | Same as option 3 | Requires a **new** aggregator-vs-package versioning policy; harder rollback (multiple package versions in flight) | High — N release pipelines, N sets of CI publish credentials, cross-package version-skew risk | N× the release overhead of option 3 | Much harder — reverting means un-publishing or deprecating N packages, not one |

**Why option 3 now, not option 4**: nothing in the investigation shows independent
*versioning* pressure — no entry has needed a breaking change independent of the others'
release cadence yet, and every entry still shares the same `@epam/ai-dial-chat-hooks` review/
test/lint pipeline. Option 4 would be justified once (a) an entry's peer set needs a major
version bump the others don't (e.g. `./file-manager` needing a `@epam/ai-dial-react-file-
manager` v2 while `./catalog` stays on v1-compatible types), or (b) an entry's install size
matters enough on its own that a separate lockfile entry (rather than a subpath of an already-
installed package) measurably helps a real consumer. Neither condition exists today; option 3
is strictly cheaper and gets the same install/runtime/type/bundle isolation.

## Risks / Trade-offs

- **[Risk]** A hand-written entry-point barrel drifts from the domain folder it wraps (e.g. a
  new export is added to `catalog/` but the maintainer forgets to add it to
  `entry-points/catalog.ts`) → **Mitigation**: a lint/test rule (implementation detail, see
  `tasks.md`) diffs each entry barrel's export set against `src/index.ts`'s corresponding
  slice, failing CI on drift.
- **[Risk]** 15 new `exports` subpaths is a larger, more error-prone manifest to hand-maintain
  than one → **Mitigation**: D5's packed-package fixtures assert every `exports` target exists
  in the packed tarball, catching a typo'd path before publish.
- **[Risk]** Bundling `dompurify`/`yaml`/etc. into each owning entry (D3) means the root
  entry's `dist/index.js` still contains all five, unchanged in size — the root entry gets
  none of this change's bundle-size benefit → **Mitigation**: this is intentional (D3's design
  goal is per-dependency delivery-model consistency, not root-entry size; root-entry size
  reduction is not a stated goal — `apps/chat` migrating from the root to subpaths per entry
  is what actually shrinks its bundle, tracked as ordinary follow-up migration work, not part
  of this change's non-goals list).
- **[Risk]** `peerDependenciesMeta` marking 16 peers optional could mask a genuinely forgotten
  peer for a consumer who *does* use a heavy entry, surfacing only as a build failure instead
  of an install-time warning → **Mitigation**: this is the accepted, documented trade-off
  (D2) — install-time silence, build-time failure — and D6's README ships the failure-mode
  guidance so it is recognizable rather than mysterious.
- **[Risk, materialized in task 3.4]** Vite 8/Rolldown multi-entry lib-mode behavior around
  chunk de-duplication differs from this document's original assumption — see D1's corrected
  paragraph. The actual build factors shared code into hashed chunk files rather than
  duplicating it per entry. → **Mitigation**: D5's fixtures assert on the actual emitted
  bundle contents (an entry's own file plus its transitive chunk imports), not on assumed
  Rollup/Rolldown internals or a single-file-per-entry assumption, so this and any further
  Vite upgrade that changes chunking strategy fails the fixtures rather than silently
  regressing isolation.

## Migration Plan

1. Land the build/manifest changes (D1–D4) and the corrected README (D6) with the root entry
   provably unchanged (existing `apps/chat` build + full test suite green with zero import
   changes).
2. Land the packed-package fixtures (D5) proving every new subpath resolves, typechecks, and
   bundles with its documented peers, and that the negative case fails clearly.
3. Migrate a representative sample of `apps/chat` imports per entry (not all 126 files) to
   exercise each subpath from the primary consuming application.
4. No feature-flagging or staged rollout is needed beyond normal PR review — the root entry's
   unchanged behavior is the safety net; nothing forces any consumer, in this repo or outside
   it, onto a subpath.

**Rollback**: revert `package.json`, `vite.config.mts`, the `entry-points/` barrels, and
`tools/publish-lib.mjs`'s `sideEffects` handling. Because the root entry's shape never changed,
reverting these files alone restores the prior single-entry publish exactly — no consumer
source migration needs to be reverted in lockstep, though any `apps/chat` files that moved to
a subpath would need their imports pointed back at the root (a one-line change per file,
compiler-checked).

## Open Questions

- ~~Exact on-disk location for the packed-package consumer fixtures (D5)~~ — **Resolved
  (task 1.2)**: a workspace-wide search (every `libs/*` package, `tools/`, `nx.json`, root
  `package.json`, and the archived `extract-file-manager-catalog-reuse` change that floated the
  same idea without implementing it) found zero existing "install a packed tarball and build"
  fixture convention and no `*-e2e` project anywhere in the workspace. Decision: introduce
  `libs/chat-hooks/e2e-fixtures/` as D5 originally proposed — there is no existing convention to
  conform to instead.
- Whether `useSkillFilePreview`'s split between its `skill/` implementation folder and its
  `./catalog` entry-point grouping (chosen pragmatically in the dependency matrix) should
  instead become a real folder move in a later, separate change — tracked as a follow-up, not
  blocking this proposal.
