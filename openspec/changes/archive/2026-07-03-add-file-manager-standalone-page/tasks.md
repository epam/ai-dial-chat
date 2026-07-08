Slicing strategy: vertical — route/nav scaffolding lands first (Slice 1) so the page is reachable early even with placeholder content, then the real page host is wired in (Slice 2), then responsive/RTL polish and tests close it out (Slice 3). Each slice ends green (`npx nx test chat`, `npx nx lint chat`) before the next starts.

## 0. Pre-flight

- [x] 0.1 Confirm `extract-dial-file-manager-shell` has been archived (its `DialFileManagerShell`, `variant`, and `actionProfile` are present in `apps/chat/src/hooks/files/useDialFileManager.ts` and `apps/chat/src/components/DialFileManagerShell/`) before starting any task below.

## 1. Route, navigation, i18n scaffolding

- [x] 1.1 Added `ROUTES.FileManager = '/files'` to `apps/chat/src/types/routes.ts` (per design.md Decision 1, chosen over the legacy `/file-manager` path).
- [x] 1.2 Added `dialFileManager.page.navLabel` to `en.json` and `DialFileManagerI18nKeys.PageNavLabel` to `translation-keys.ts`. Only `en.json` exists in this repo (no other locale files to update).
- [x] 1.3 Added `NavigationI18nKeys.FileManager = 'dialFileManager.page.navLabel'` (reuses the dialFileManager namespace per spec) and a `NAVIGATION_CONFIG` entry (`path: ROUTES.FileManager`, `IconFolder`, the new label key) in `navigation.ts`.
- [x] 1.4 Added `apps/chat/src/constants/tests/navigation.spec.ts` (3 tests): File Manager entry resolves to `ROUTES.FileManager`; its label key resolves to an existing `en.json` string; every nav item's label key resolves to a string.
- [x] 1.5 Verify: `npx nx test chat` (90 files / 815 tests green), `npx nx lint chat` clean on touched files (pre-existing unrelated `Login.tsx` errors untouched).

## 2. DialFileManagerPage

- [x] 2.1 Created `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`: resolves `bucket` via `useUser()`; calls `useDialFileManager({ bucket, activeTab, rootLabel, onNotification, variant: DialFileManagerVariant.Standalone, actionProfile: DialFileManagerActionProfile.Browse })`; wires `useNotification()`; renders `<DialFileManagerShell hookResult={...} labels={...} .../>` filling the entire route, with no page title/header of its own. No `DialPopup`, no attach footer, no attach-only props (`allowedFileTypes`/`maxSelectableFileSize`/`isRowSelectable`/`getDisabledTooltip`/`unsupportedFileTypeTooltip` all omitted, so the shell's default "always selectable" behavior applies). Tab state (`useDialFileManagerTabs`) and the full `labels` object are built directly in the page, mirroring `DialFileManagerModal`'s pattern (accepted duplication — no drive-by shared-hook extraction, per design.md scope discipline).
- [x] 2.2 Registered the lazy route in `apps/chat/src/app/app.tsx`, mirroring the Catalog route block exactly.
- [x] 2.3 Added `apps/chat/src/pages/DialFileManagerPage/tests/DialFileManagerPage.spec.tsx` (4 tests): renders the shell with hook-result items; asserts `useDialFileManager` is called with `variant: Standalone`/`actionProfile: Browse` on initial render with no interaction; asserts no "Attach" button exists; tab navigation renders.
- [x] 2.4 Verify: `npx nx test chat` (91 files / 819 tests green), `npx nx lint chat` clean on touched files (pre-existing unrelated `Login.tsx` errors untouched).

## 3. Responsive layout and RTL

- [x] 3.1 `DialFileManagerPage` has no chrome of its own — it renders only `DialFileManagerShell` inside a `flex size-full min-h-0 flex-col` root container, which fills available height at every width with no breakpoint-conditional classes. No `sm:`/`md:`/`lg:`/`xl:`/unsupported prefixes used.
- [x] 3.2 Confirmed via grep: no `ml-*`/`mr-*`/`pl-*`/`pr-*`/`text-left`/`text-right`/`left-*`/`right-*` anywhere in the new file.
- [x] 3.3 **Partially verified.** Static verification done: Tailwind class audit (above) confirms no forbidden prefixes/physical classes, and the page relies on the app's existing global `dir="rtl"` inheritance (`apps/chat/src/i18n/config.ts`, unmodified by this change) the same way `DialFileManagerModal` already does. **Not done:** live DevTools viewport screenshots (360/769/1280px) and an interactive Arabic-locale visual check — the dev server requires Keycloak login in a visible browser, which isn't available in this non-interactive session. Recommend a manual pass before merge.
- [x] 3.4 Verify: `npx nx test chat` (91 files / 819 tests green), `npx nx lint chat` clean on touched files (pre-existing unrelated `Login.tsx` errors untouched).

## 4. Final verification

- [x] 4.1 `npx nx affected --target=lint --base=origin/development-1.0` — only pre-existing unrelated `Login.tsx` errors.
- [x] 4.2 `npx nx affected --target=test --base=origin/development-1.0` — 819/819 tests green (91 files).
- [x] 4.3 `npx nx affected --target=build --base=origin/development-1.0` — succeeds; `DialFileManagerShell` now code-splits into its own chunk, confirming the new lazy route wired correctly.
- [x] 4.4 `git diff origin/development-1.0 -- '**/DialFileManagerModal.spec.tsx'` — empty diff; 38/38 tests still pass unmodified.
