## Why

The File storage page (`/files`) makes users pick one source — My files, Shared, or Organization — before they can see anything, so finding a file whose origin they don't remember means switching tabs and re-expanding trees. The design (the File storage screenshot attached to this change's request) adds an **All** tab: one tree with **My files**, **Shared** and **Organization** as top-level folders, each browsable in place. No such tab exists today — `DialFileManagerTabs` (owned by `@epam/ai-dial-react-file-manager`, `src/types/file-manager.ts:1`) has only `MyFiles`/`Shared`/`Organization`/`Review`, and every listing hook is single-source.

## Problem

- The tab strip is generated from `Object.values(DialFileManagerTabs)` by `useDialFileManagerTabs` (`ai-dial-react-file-manager/src/components/FileManager/hooks/use-file-manager-tabs.tsx:25`), so a tab cannot be added from the chat side alone.
- `useDialFileListing` (`libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts:111`) is one-tab-one-root: a single `rootLabel`, one `folderPath`, one cache, and `fetchByTab(activeTab, …)` on every fetch path. `useDialFileManager` (`libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts:127-175`) derives upload rules, columns and the action matrix from `activeTab`, and so does `DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx:323-327`, `:493`) for upload-archive gating and empty states.

## Solution

An **All** tab on the standalone File storage page, first in the strip and selected on open. Its tree has one top-level folder per enabled source tab, in the order My files → Shared → Organization. Each top-level folder behaves exactly like the matching single tab: same listing source, same lazy expansion, same columns, same upload/new-folder rules and the same per-row action matrix. Clicking a folder anywhere in the tree opens it in the grid; the tab strip stays on All.

Mechanically (details in `design.md`):

1. **`@epam/ai-dial-react-file-manager`** (sibling repo `c:\projects\ai-dial-react-file-manager`) gains `DialFileManagerTabs.All = 'all'`, declared first so `useDialFileManagerTabs` lists it first. Released as a new `0.3.0-dev.N`, then bumped in this workspace.
2. **`libs/chat-hooks`** gains a composer, `useDialFileManagerSections`. It runs one `useDialFileManager` per source tab with a fixed `activeTab`, returns that section's result as-is on a single tab, and on All merges the three trees and routes each callback to the section that owns the path (by its root label). `useDialFileListing`/`useDialFileManager` gain an `isActive` option so inactive sections do not fetch, and a `sessionKey` option so a tab switch still resets navigation.
3. **`libs/chat-shared`** `FileManagerController` gains an optional `sectionTab`, the source tab of the folder being browsed. `DialFileManagerShell` uses it (falling back to `activeTab`) for the per-tab gates, and keeps `activeTab` for the strip.
4. **`apps/chat-api`** accepts `all` in `FILE_MANAGER_AVAILABLE_TABS` and adds it to the default tab list. **`apps/chat`** `DialFileManagerPage` switches to the new composer, opens on All, and supplies the translated label.
5. The attach modal (`DialFileManagerModal` / `useFileAttachmentPicker`) and the other file pickers **always drop `all`** from their tab list, because they compose a single-source manager.

### Alternatives considered

| Option | Correctness | Delivery risk | Perf | Rollback |
| --- | --- | --- | --- | --- |
| **A. Compose one manager per section and route by path (picked)** | Each section reuses the proven single-tab logic unchanged | Medium: new composer and routing, no rewrite of existing hooks | Up to 3 root listings on entering All, each lazy after that | Remove `all` from config, or revert the page to `useDialFileManager` |
| B. Rewrite `useDialFileListing` as multi-source with a section-keyed cache | Equivalent end state | High: 743-line hook plus the upload/mutations/sharing hooks that all key off `activeTab`; wide regression surface | Same | Hard — shared code path for every tab |
| C. All as a pure navigation view (clicking a root switches to its tab) | Simple, but the strip jumps away from All, which contradicts the design | Low | Same | Easy |
| D. Baseline: keep three tabs | Does not meet the request | None | — | — |

We picked A because it keeps all per-tab rules in one place, with no second implementation of the action matrix. B was rejected on regression risk, C because it fails the design, and D because it does not deliver the feature.

## Non-goals

- No All tab in the attach modal (`DialFileManagerModal`), the Catalog/skill file pickers, or `FileManagerAttachModal`. Recorded assumption; revisit in a follow-up if wanted.
- No cross-section copy/move/drag (for example, Organization → My files). A destination outside the source section is refused (see design D6).
- No search across sections. Search stays scoped to the current folder, as today.
- No change to the legacy `DialFileManagerTabs` copy inside `@epam/ai-dial-ui-kit`.
- No new backend endpoints. The existing `listFiles`/`listSharedFiles`/`listPublicFiles` are reused.

## Acceptance criteria

- `/files` opens on the **All** tab, and the tree shows `My files`, `Shared` and `Organization` as top-level folders, each expandable lazily. `My files` is the initially browsed folder in the grid.
- Browsing into any folder under a top-level folder shows the same grid columns, New/Upload enablement, upload-archive entry, and per-row actions as the matching single tab does for that folder.
- Switching between All and any single tab resets folder navigation and selection, as tab switches do today.
- A source tab excluded by `FILE_MANAGER_AVAILABLE_TABS` has no top-level folder under All. All itself is hidden when `all` is excluded or fewer than two source tabs are enabled. With the variable unset, the tabs are `all,my_files,shared,organization`.
- The attach modal and every other file picker never show an All chip, whatever the config says.
- The All label is translated, and the page renders correctly at 360px and under `dir="rtl"`.
- `npm run verify:changed`, `npm run openapi:check` and `npm run validate:docs` pass.

## Capabilities

### New Capabilities

- `file-manager-all-tab`: the All tab on the standalone File storage page. Covers the multi-root tree, section routing by root label, per-section rule inheritance, lazy per-section loading, the cross-section transfer refusal, and exclusion from attach pickers.

### Modified Capabilities

- `file-manager-tab-config`: `all` becomes an allowed id and part of the default list. The active-tab fallback priority gains `all` first.
- `file-manager-standalone-page`: the page opens on All and composes `useDialFileManagerSections` instead of a single `useDialFileManager`.
- `file-manager-tabs` (added requirement): attach pickers never offer `all`, and `fetchByTab` refuses it.
- `chat-hooks-file-manager-listing` (added requirements): the listing hook gains `isActive` (no fetching while inactive) and `sessionKey` (a change resets state like a tab switch).
- `file-manager-shell` (added requirement): the shell derives its per-tab gates from `controller.sectionTab ?? activeTab`.

## Impact

- **Cross-repo:** `c:\projects\ai-dial-react-file-manager` gets an enum member and a release. This workspace bumps `@epam/ai-dial-react-file-manager` in root `package.json` and every lib manifest that declares it (`libs/chat-hooks`, `libs/chat-shared`, …), then runs `npm run docs:install-matrix`.
- **Shared libs (scope flag):** `libs/chat-hooks` gets a new public hook export plus two new options on existing hooks. `libs/chat-shared` gets an optional field on `FileManagerController`. Library isolation holds: the composer receives the configured `filesApi`, the per-section root labels, and the list of enabled sections as parameters. It reads no config, env, or i18n. The app edge (`DialFileManagerPage` + `useAppConfig().config.fileManagerTabs`) decides which sections exist and what they are called.
- **Backend:** `apps/chat-api/src/app-config/config-registry/env-config.provider.ts:16` (allowed ids), `config-registry.constants.ts:319` (default), `client-config.mapper.ts:11`, the `client-config-response.dto.ts:126` example, then `npm run openapi` for the regenerated client example. Docs: `apps/chat-api/README.md:251` and `.env.template:293`.
- **i18n:** two new user-visible strings, both added to `apps/chat/src/i18n/locales/en.json` (the only locale file in the repo):
  - the tab label `dialFileManager.tab.all` = "All" (`DialFileManagerI18nKeys.TabAll`)
  - the refusal notice `dialFileManager.crossSectionTransferUnsupported` (`DialFileManagerI18nKeys.CrossSectionTransferUnsupported`, design D6) The tree header for All reuses `DialFileManagerI18nKeys.MyFilesTreeHeader` ("File storage"). The top-level folder names reuse the existing tab labels.
- **Docs:** READMEs for `libs/chat-hooks`, `libs/chat-shared` and `ai-dial-react-file-manager`, plus `apps/chat-api` env docs. `docs/architecture.md` is structurally unaffected (no new lib, route, context, or domain).
- **Backward compatibility / rollback:** non-breaking for API consumers. `all` is additive, and deployments that set `FILE_MANAGER_AVAILABLE_TABS` explicitly keep their current tabs because `all` is absent from their list. `Record<DialFileManagerTabs, …>` literals in hosts must add an `all` key, which is a compile-time change inside this workspace only. Rollback: set `FILE_MANAGER_AVAILABLE_TABS=my_files,shared,organization`, or revert the change. The enum member can stay in the package harmlessly.
