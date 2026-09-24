Slicing strategy: risk-first. The riskiest part of a "move code without changing behavior" refactor is proving the pre-move behavior is fully characterized before it moves, so Slice 1 adds and green-checks characterization tests against the *current* implementation, Slice 2 does the mechanical move, and Slice 3 adds unit coverage for the extracted module in isolation. Slice 4 is verification and documentation.

## 1. Characterize current behavior before extraction

- [x] 1.1 In `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`, add characterization tests for `announcement.items` warning text, multiplicity, and order: (a) a non-array resolved value logs exactly one warning with the current text and returns `[]`; (b) `null`/`undefined` resolved values log no warning and return `[]`; (c) a non-object entry logs the current "not an object" warning text; (d) a blank-title entry, a blank-link-label entry, and an invalid-href entry each log their current distinct warning text.
- [x] 1.2 In the same file, add a characterization test for duplicate-entry preservation: two entries with identical `title`/`description`/`link` both appear in `config.announcements`, not deduplicated.
- [x] 1.3 In the same file, add characterization tests for cap-and-order interaction: (a) with more valid entries than the maximum, an invalid entry positioned after the maximum still produces its own rejection warning; (b) the cap-exceeded warning is the last warning logged and reports the total number of valid entries (not the configured count).
- [x] 1.4 Run the suite and confirm all new and existing tests are green against the current, pre-extraction `AppConfigService.normalizeAnnouncements`.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`

## 2. Extract the shared text helper

- [x] 2.1 Create `apps/chat-api/src/app-config/text.util.ts` exporting `toNullableText` moved unchanged from `apps/chat-api/src/app-config/app-config.service.ts:31-37` (including its existing comment).
- [x] 2.2 In `apps/chat-api/src/app-config/app-config.service.ts`, delete the local `toNullableText` definition and import it from `./text.util` (extensionless relative import per repo TypeScript conventions); keep its three existing call sites (`announcement.title`, `announcement.description`, `welcomeScreen.description`) unchanged otherwise.
- [x] 2.3 Run the service spec to confirm banner/welcome-screen behavior is unchanged.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`

## 3. Extract announcement-list normalization

- [x] 3.1 Create `apps/chat-api/src/app-config/announcements.normalizer.ts` exporting `normalizeAnnouncements(value: unknown, warn: (message: string) => void): AnnouncementItemDto[]`, moving `isExternalHttpUrl`, `AnnouncementRejection`, `parseAnnouncementLink`, `MAX_ANNOUNCEMENTS`, and the body of `AppConfigService.normalizeAnnouncements` (`app-config.service.ts:47-158`) unchanged, keeping the moved helpers and constant private (unexported) to the new module. Import `toNullableText` from `./text.util`. Import `AnnouncementItemDto`/`AnnouncementLinkDto` with `import type` only.
- [x] 3.2 In `apps/chat-api/src/app-config/app-config.service.ts`, delete the moved private method, the moved private helpers/type/constant, and any now-unused imports; replace the `announcement.items` branch (`app-config.service.ts:258-259`) with `announcements = normalizeAnnouncements(resolved, (message) => this.logger.warn(message));`, following the existing `uiFeatures.enabledUiFeatures` delegation pattern at `app-config.service.ts:268-271`. Add the `normalizeAnnouncements` import from `./announcements.normalizer`.
- [x] 3.3 Run the full service spec (unchanged characterization tests from Slice 1 plus all pre-existing announcement tests) and confirm every assertion still passes post-move.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`

## 4. Add direct unit coverage for the extracted normalizer

- [x] 4.1 Create `apps/chat-api/src/app-config/tests/announcements.normalizer.spec.ts` calling `normalizeAnnouncements` directly (no `TestingModule`, no cache/provider mocks), using the real `sanitizeAnnouncementHtml` from `./html-sanitizer`. Cover: empty/absent input, non-array input with its warning, a complete valid entry, an entry without a link, each invalid-link case (`javascript:`, `data:`, relative path, unparseable, mixed-case scheme), blank title, blank link label, mixed valid/invalid entries, configured-order preservation, and duplicate-entry preservation.
- [x] 4.2 In the same file, add description-sanitization cases using the real sanitizer: a malicious description (`<script>`/`onerror`) that is stripped but retains safe text, a description that sanitizes away entirely returning `null`, and a description whose anchor is transformed to `target="_blank" rel="noopener noreferrer"`.
- [x] 4.3 In the same file, add cap-behavior cases: more than the maximum valid entries returns exactly the first N in order and logs the cap warning with the total valid count; an invalid entry positioned after the maximum still logs its own warning before the cap warning.
- [x] 4.4 In the same file, add an immutability case asserting the input array and its entry/link objects are not mutated by a call to `normalizeAnnouncements` (e.g., via `structuredClone`/deep-equality comparison of the input before and after the call, and reference-inequality of any returned link/entry object against its source).
- [x] 4.5 In `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`, add one integration case proving a cache hit for `getClientConfig` does not re-resolve `announcement.items` through the provider and does not emit additional announcement warnings on the second call.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/announcements.normalizer.spec.ts` and `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`

## 5. Verify and close out

- [x] 5.1 Run the changed-slice verification once the vertical slice above is complete.
  - Verification: `npm run verify:changed`
- [x] 5.2 Run the repository's full non-mutating verification exactly once before completion; record the result truthfully, including any unrelated pre-existing baseline failures separately from this slice's outcome (do not fix unrelated failures here).
  - Result: `npm run verify:full` — typecheck and lint/format passed for all projects. `test:full` failed overall, but the failure is isolated to `attachment-canvas-consumer-fixture:build` (a pre-existing `@tabler/icons-react` ESM subpath resolution error — `Could not resolve './icons-list.mjs'` — in an unrelated Vite consumer-fixture package with 2211 unresolved-import errors), which then blocked the two tasks that depend on it. `@epam/chat-api:test` (this change's own project) passed. This baseline failure is unrelated to this change (no file under `apps/chat-api/app-config/**` or the fixture package was touched) and is out of scope for this slice; not fixed here.
  - Verification: `npm run verify:full`
- [x] 5.3 Run `npm run validate:docs` since this change touches `apps/chat-api` source; confirm no README or `docs/**` statement becomes inaccurate (the existing `apps/chat-api/README.md` announcement description already matches observable behavior and is not expected to need edits — update it only if validation or review finds a discrepancy).
  - Result: `npm run validate:docs` passed (49 markdown files checked). No discrepancy found; `apps/chat-api/README.md`'s announcement section already matches observable behavior, so no doc edit was needed.
- [x] 5.4 Update the local (git-excluded) refactoring audit index and the relevant remediation-plan item-9 entry to mark only this announcement-normalization slice as implemented, explicitly leaving the broader `getClientConfig` dispatch redesign and UI-feature alias hardening open. Do not reference these local planning documents from the public proposal or any PR description.
  - Result: Updated `technical-debt-remediation-plan.md` (executive assessment, scorecard row, item 9 detail), `refactoring.md` (scorecard row, "Next changes" section), and `refactoring-backend.md` (scorecard row, September 21 follow-up bullets, structural-smells row, large-file table) to record this slice as implemented locally (not yet a PR/merge), with the 23-arm dispatch count and existing alias lookup explicitly still open. These are git-excluded local documents; not referenced from `proposal.md`, `design.md`, or any PR description.
