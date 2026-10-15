# Tasks: fix scheduled-task long-text rendering

Slicing strategy: vertical — each slice is one independently verifiable surface (card, header title, description wrapping/ink, instructions typography), each closed by its component spec. All tasks are complete; this change is a retroactive record of implemented and verified work.

## 1. Card description: clamp + wrap-don't-stretch

- [x] In `libs/scheduled-tasks/src/components/ScheduledTaskCard/ScheduledTaskCard.tsx`: keep the description clamped to three lines desktop / two below with `min-w-0` + `[overflow-wrap:anywhere]` so an unbreakable token wraps inside the card instead of stretching its grid track; collapse `descriptionSizeClassName` into `descriptionClassName` and document the clamp-cap coupling in its JSDoc.
- [x] Update `libs/scheduled-tasks/src/models/scheduled-task-card-props.ts` (remove the duplicate prop) and `libs/scheduled-tasks/README.md` in the same change.

**Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskCard/tests/ScheduledTaskCard.spec.tsx` (clamp and wrap assertions) — passed; full suite 335/335.

## 2. Detail view header: title truncation + tooltip

- [x] In `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx`: give both title copies the shared `min-w-0 max-w-[600px]` width contract and render the text through the kit's `EllipsisTooltip` (tooltip only when clipped; full name stays the accessible name).
- [x] Document the contract in `libs/scheduled-tasks/README.md`.

**Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskDetailView/tests/ScheduledTaskDetailView.spec.tsx` (both copies carry the width contract and the tooltip span) — passed.

## 3. Details description + skill names: wrap whole words, theme-safe ink

- [x] In `libs/scheduled-tasks/src/components/ScheduledTaskDetailsSection/ScheduledTaskDetailsSection.tsx` and its `.module.scss`: replace `break-all` with `[overflow-wrap:anywhere]` (keeping `whitespace-pre-wrap`), and add the `.description` ink rule chained `var(--stdv-description-text, var(--text-primary, #1b212d))`.
- [x] Thread `styles.colors.descriptionText` → `--stdv-description-text` from `ScheduledTaskDetailView` (`scheduled-task-detail-view-props.ts` + the view's `buildCssVars`).
- [x] Replace `break-all` with `[overflow-wrap:anywhere]` on the skill-name rows in `ScheduledTaskConfigurationSection.tsx` and `ScheduledTaskDetailsSummary.tsx`.

**Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskDetailsSection/tests/ScheduledTaskDetailsSection.spec.tsx` (overflow-wrap present, `break-all` absent, override scoped to the description) and the `--stdv-description-text` test in the view spec — passed.

## 4. Instructions: compact prose step via a scoped record

- [x] In `libs/scheduled-tasks/src/components/ScheduledTaskConfigurationSection/ScheduledTaskConfigurationSection.tsx`: pass a module-level `MarkdownRendererClassNames` record (`{ ...COMPACT_MARKDOWN_CLASS_NAMES, ul/ol at the prose step }`) to the built-in `MDMessageViewer`, leaving `libs/chat-shared/src/components/MarkdownRenderer/markdown-class-names.ts` untouched.
- [x] Keep the README's instructions-scale sentence in sync.

**Verification:** `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskConfigurationSection/tests/ScheduledTaskConfigurationSection.spec.tsx` (viewer receives the scoped record: `p` and `ul` at `dial-small-paragraph-text`) and `nx test @epam/ai-dial-chat-shared` (shared presets unchanged, 605/605) — passed.

## 5. Spec and test hygiene

- [x] Correct `openspec/specs/scheduled-tasks-page-ui/spec.md` ("four lines" → "three lines") to match the implemented clamp.
- [x] Delete the temporary repro scaffolding (`apps/chat/repro-scheduled-tasks.html`, `apps/chat/src/repro-scheduled-tasks/`).

**Verification:** `npm run validate:specs`, `npm run validate:docs`, `nx lint @epam/ai-dial-scheduled-tasks` — passed.
