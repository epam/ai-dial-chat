## Why

Issue [#8842](https://github.com/epam/ai-dial-chat/issues/8842) reports two failures around the Skill Editor's supporting-file preview: the editor's Back arrow leaves the editor entirely instead of returning to the skill's `SKILL.md` view, and after a preview attempt the editor renders an incomplete layout for every skill opened afterwards until the page is reloaded. The first defect makes the only obvious "go back" affordance destructive (it is gated by the unsaved-changes prompt, so users are asked to discard work merely to leave a file preview); the second leaves the editor unusable for the rest of the session with no in-app recovery.

The two symptoms were reported together but are not one defect. Static analysis of the current implementation (`development` at `e6cbc91d3`, which already carries the #8837 preview fix) attributes them to independent causes, and the plan treats them as independent.

## What Changes

**Navigation (confirmed cause).** `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` passes `onBack={handleCancel}`, and `handleCancel` only ever checks dirtiness and navigates to `returnUrl`. Back therefore exits the editor whether or not a supporting file is selected — independent of any preview error. Back gains a preview-aware first step: while a supporting file is selected it returns to the `SKILL.md` view without navigating; from the `SKILL.md` view it keeps today's `returnUrl` + unsaved-changes behavior. `Cancel` is untouched.

**Persistent layout damage (primary hypothesis, requires browser confirmation).** The strongest candidate is a CSS cascade inversion, not React state:
- `libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx:40` imports `@epam/ai-dial-react-pdf-highlighter/styles.css` at module scope, so it is injected only when the PDF lazy chunk loads — i.e. *after* the app's own stylesheet.
- That file (`dist/index.css`) is a complete Tailwind 3.4 build: Preflight plus base utilities (`.hidden`, `.flex`, `.h-full`, `.px-4`, `.border-r`, `.container` at Tailwind's default breakpoints), duplicating class names the app already owns.
- Media-query variants carry no extra specificity, so a later-injected plain `.hidden { display: none }` outranks the app's `@media (min-width:1280px) { .desktop\:block { display:block } }`. The editor's desktop layout is built on exactly those pairs — `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx:422` (`hidden px-8 py-6 desktop:block`, the desktop Files panel) and `libs/builder-form/src/components/EditorLayout/EditorLayout.tsx:73` (`hidden … desktop:flex`, the desktop Cancel/Save actions).
- Because a skill's supporting-file bytes are already in memory, `resolvePdfCanvasContent` resolves them through `URL.createObjectURL` (`libs/chat-hooks/src/files/attachment-canvas.ts:296`) with no network fetch, so `PdfContent` — and its stylesheet — mounts on *every* editor PDF preview, successful or failed. The hypothesis therefore predicts the damage after a **successful** preview too, and after opening any PDF anywhere else in the app. Both are cheap falsification tests and are the first tasks in this change.

The fix contains that stylesheet in the cascade (a named CSS layer at the vendor import seam is the leading option) so it can no longer outrank host utilities, while keeping the lazy-load boundary `attachment-canvas-package-loading` already requires. The alternative causes and the decision gate are recorded in `design.md`; no code path is changed before the diagnosis task pins the cause.

**Preview state correctness (confirmed defects, surfaced by the same flows).**
- `apps/chat/src/hooks/attachment/useSkillFilePreviewSync.ts` awaits `openAttachmentCanvas` with no cancellation or generation guard, so a late completion can replace current content or reopen a closed preview. The existing `skill-file-preview` spec already requires this guard ("Rapid selection change shows only the latest file") — **the current implementation does not satisfy its own spec**, and this change makes it true rather than adding a new requirement.
- The canvas attachment id is the file's *relative* path (`skillFileToAttachment`, `libs/chat-hooks/src/skill/skill-file-preview.ts`), so the same relative path in two different skills or buckets is indistinguishable. This collides with the sync hook's `canvasAttachmentId === selectedPath` early return and with `SkillFilePreview`'s `isCurrent` check. The id becomes resource-scoped; this **modifies** the existing spec requirement that pins the id to the relative path.
- When `openAttachmentCanvas` resolves `false` it calls `closeCanvas()`, clearing `attachmentId`; `SkillFilePreview` then computes `isCurrent === false` and renders `isLoading` forever — an indefinite spinner with no error text and no retry. A failed preview becomes a local, recoverable error state instead.

**Not changed:** the #8837 fixes (`readSkillFilePreviewBytes`, the app-owned `configurePdfWorker`), PDF worker initialization, object-URL cleanup, other attachment previews, `Cancel` semantics, routing ownership, and the library isolation boundary. No page reloads, timers, or global state resets are used as a fix.

## Capabilities

### New Capabilities

- `attachment-preview-style-containment`: the application-level contract that vendor CSS pulled in by a lazily loaded attachment-preview engine cannot alter layout or typography outside the preview surface, in any app route, for the rest of the session.

### Modified Capabilities

- `skill-file-preview`: Back returns to the `SKILL.md` view while a supporting file is selected; preview failures are local and recoverable rather than an indefinite spinner; the canvas attachment id becomes resource-scoped (bucket + skill path + relative path) instead of the bare relative path; the existing out-of-order-completion requirement gains scenarios that pin the guard the implementation is missing.
- `skill-editing`: the dirty-navigation guard requirement is restated so it distinguishes Back-from-a-file-preview (never navigates, never prompts) from Back-from-`SKILL.md` and Cancel (both keep today's `returnUrl` + confirmation behavior).
- `attachment-canvas-package-loading`: the "PDF-only CSS loads separately from the base stylesheet" requirement gains a containment clause, so satisfying the lazy-load rule cannot be achieved by a stylesheet that outranks the host's own utilities.

## Impact

**Application layer (`apps/chat`)**
- `src/pages/SkillEditor/SkillEditor.tsx` — a `handleBack` distinct from `handleCancel`; resource-scoped preview ids.
- `src/hooks/attachment/useSkillFilePreviewSync.ts` — generation guard, stale-completion reconciliation, local failure state.
- `src/components/SkillFilePreview/SkillFilePreview.tsx` — error/retry state instead of a permanent spinner.
- The vendor-stylesheet containment seam (exact file decided by the diagnosis task: the app's CSS entry, its Vite config, or the lib-side import in `libs/attachment-canvas`).

**Libraries** — no change expected. `libs/skill-editor` and `libs/builder-form` already delegate Back to a host callback, which is where the routing decision belongs. If the confirmed cause requires touching `libs/attachment-canvas`'s own vendor-CSS import, it stays a change to how that lib loads its own declared peer's stylesheet — no host or routing knowledge enters the lib. `.claude/rules/lib-styling.md` and `.claude/rules/libs.md` apply if any lib file is touched. Defensive class-pair hardening in `libs/skill-editor`/`libs/builder-form` (`mobile:hidden desktop:block` for `hidden desktop:block`) is complementary and only applied if the diagnosis shows it is warranted.

**Tests** — `apps/chat/src/pages/SkillEditor/tests/SkillEditorPreview.spec.tsx` and `SkillEditor.spec.tsx` extend with Back/Cancel, dirty-preservation, failure-recovery, cross-skill, and late-completion cases; a new spec covers `useSkillFilePreviewSync`. Cascade containment is asserted by a build-output assertion plus documented manual browser verification — jsdom does not evaluate the cascade, so no mocked test can stand in for it.

**Docs** — `docs/architecture.md` only if the containment mechanism changes a cross-cutting styling tier; the affected lib READMEs if any public API changes (none expected). `npm run validate:docs` runs if a README, `docs/**`, or a lib manifest is touched.

**Not verifiable in this planning pass** — GitHub is not reachable from this session (the connector is unauthorized), so issue #8842's own thread, screenshots, and environment details were not read; the symptoms above are taken from the request. Every root cause below is from source inspection only. No browser reproduction was performed.
