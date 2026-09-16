## Context

The Skill Editor page (`apps/chat/src/pages/SkillEditor/SkillEditor.tsx`) owns `selectedPath` and hands it to `libs/skill-editor`'s host-agnostic `SkillEditor` form, which renders the manifest fields when `selectedPath === SKILL_MANIFEST_PATH` and the host-supplied `supportingFileContent` slot otherwise. `libs/builder-form`'s `EditorLayout` draws the header (Back arrow, title, desktop actions) and the responsive two-column body, delegating Back straight to the callback it is given. Preview content is reconciled into the globally mounted attachment canvas by `apps/chat/src/hooks/attachment/useSkillFilePreviewSync.ts` and rendered inline by `apps/chat/src/components/SkillFilePreview/SkillFilePreview.tsx`.

Baseline is `development` at `e6cbc91d3` ("fix: skill supporting-file PDF preview (#8850)"), which is the merged form of the `96c4d0674` work named in the request — both parts are present and verified in HEAD: `readSkillFilePreviewBytes` (`libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts:411`, used by `useSkillItemDetails.ts:206`) and `configurePdfWorker` threaded through `SkillFilePreview`. The working tree is clean; there is no uncommitted work to preserve. These fixes are preserved: failures are to be induced by controlled download, worker, or rendering faults, never by reverting them.

Everything below is from source inspection. GitHub is unreachable from this session (the connector is unauthorized), so issue #8842's thread and screenshots were not read, and no browser reproduction was performed. Findings are labelled **Confirmed** (read directly from source) or **Hypothesis** (consistent with source but needing a browser to establish).

### Confirmed findings

- **C1 — Back is unconditionally an exit.** The page passes `onBack={handleCancel}`; `handleCancel` checks `isDirty` (raising the unsaved-changes confirmation) and otherwise calls `navigate(returnUrl)`, defaulting to `ROUTES.Catalog`. It never reads `selectedPath`. Back therefore leaves the editor whether a supporting file is selected or not, and whether the preview succeeded, failed, or is still loading. **The reported failure is not preview-error-specific.**
- **C2 — no late-completion guard.** `useSkillFilePreviewSync`'s effect calls `void openAttachmentCanvas(...)` with no cancellation flag, generation counter, or abort. `openAttachmentCanvas` writes canvas state itself (`openCanvasLoading` before, `openCanvas`/`closeCanvas` after the awaited resolver), so a completion that arrives after the selection moved on can replace current content or reopen a closed preview. `openspec/specs/skill-file-preview/spec.md` already requires the opposite ("Rapid selection change shows only the latest file", "Asynchronous content resolution SHALL guard against out-of-order completion") — **the implementation does not satisfy its existing spec.**
- **C3 — a failed open becomes a permanent spinner.** When `openAttachmentCanvas` resolves `false`, `useOpenAttachmentCanvas` calls `closeCanvas()`, which clears `attachmentId`. `SkillFilePreview` computes `isCurrent = attachmentId === path` and passes `isLoading={!isCurrent || isLoading}`, so a cleared id renders a spinner indefinitely — no error text, no retry. Preview failure is not locally recoverable.
- **C4 — relative-path resource identity.** `skillFileToAttachment` sets `id: node.path`, and the sync hook passes `node.path` as `canvasAttachmentId`. The same relative path in two different skills or buckets is therefore indistinguishable, which interacts with the hook's `canvasAttachmentId === selectedPath && (isCanvasLoading || isCanvasOpen)` early return (it can suppress a needed reopen) and with `SkillFilePreview`'s `isCurrent` check (it can mark a stale preview current).
- **C5 — the editor PDF path never fetches.** A supporting file's bytes are already in memory, so `resolvePdfCanvasContent` → `resolveAttachmentBlobUrl` returns `URL.createObjectURL(attachment.file)` (`libs/chat-hooks/src/files/attachment-canvas.ts:296`). No network request, no LRU cache entry. Consequences: the session LRU caches and `clearAttachmentCache` are **not** implicated in any of these symptoms, and content for a skill supporting PDF essentially always resolves to `AttachmentContentType.Pdf`, so `PdfContent` mounts on every editor PDF preview.
- **C6 — the vendor PDF stylesheet is a full Tailwind build.** `PdfContent.tsx:40` imports `@epam/ai-dial-react-pdf-highlighter/styles.css` at module scope; that export resolves to `dist/index.css` (≈10 KB, `@epam/ai-dial-react-pdf-highlighter@0.2.0`), whose first rule is Tailwind 3.4.19 Preflight (`*,:after,:before{box-sizing:border-box;border:0 solid}`, `body{margin:0}`, `h1..h6{font-size:inherit;font-weight:inherit}`, `menu,ol,ul{list-style:none;margin:0;padding:0}`) followed by ordinary base utilities the app also owns — `.hidden`, `.flex`, `.h-full`, `.min-h-0`, `.px-2`, `.text-left`, `.text-right`, `.border-r`, `.container` at Tailwind's default 640/768/1024/1280/1536 breakpoints. Because it is imported inside a lazily loaded module, it is injected **after** the app's stylesheet.
- **C7 — the editor's desktop layout rests on base-utility/variant pairs.** `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx:422` renders the desktop Files panel as `hidden px-8 py-6 desktop:block`; `libs/builder-form/src/components/EditorLayout/EditorLayout.tsx:73` renders the desktop Cancel/Save actions as `hidden shrink-0 items-center gap-2 desktop:flex`. `tailwind.config.js` defines `mobile: { max: '1279px' }` and `desktop: { min: '1280px' }`. A media-query variant adds no specificity, so a plain `.hidden { display: none }` injected later in the document outranks `@media (min-width:1280px) { .desktop\:block { display: block } }`. The same pattern appears in `BuilderFormBody.tsx:27` and `BuilderFormHeader.tsx:71`.
- **C8 — the shared canvas is global; the editor route renders no canvas container.** `AttachmentCanvasProvider` is mounted above the router, while `app.tsx` mounts `AttachmentCanvasContainer` only on conversation routes. The editor still mutates that shared state, and `useConversationPanelRouteState` reacts to it (`isCanvasOpen` closes the conversation panel and sources sidebar; every `pathname` change closes the canvas). Editor→editor navigation changes only the query string, so cross-skill reset relies solely on the page's own `[isEditMode, skillPath]` effect.
- **C9 — dirty state survives a selection change.** `libs/skill-editor`'s `SkillEditor` re-seeds `values` only when `initialValues` identity changes (its reseed effect is keyed on `[initialValues]`), `files` are owned by the page, and changing `selectedPath` does not remount the form. Returning from a preview to `SKILL.md` therefore preserves unsaved fields and uploads with **no new code** — it needs a regression test to lock the behaviour, not an implementation.

### Hypotheses for the persistent layout failure

**H1 (primary) — cascade inversion from the vendor PDF stylesheet (C6 + C7).** Once the PDF chunk loads, the vendor's plain `.hidden`/`.flex` rules outrank the app's `desktop:`-gated counterparts for the rest of the session. Predicted symptom: on desktop the Files panel and the header's Cancel/Save disappear while the mobile accordion and the mobile action bar appear — an "incomplete editor layout" — and the stylesheet is never removed, so only a reload restores it.

H1 makes two predictions that are cheap to falsify and that the diagnosis task must run **before any code changes**:

1. **A successful PDF preview damages the layout too.** Per C5 the editor's PDF always mounts `PdfContent`, so the failure is incidental — it merely happens to be when users notice. If a clean, successfully rendered PDF leaves the layout intact, H1 is wrong.
2. **A PDF opened anywhere else damages it.** Open a PDF attachment in a conversation, then enter the Skill Editor without ever touching a preview. If the layout is complete, H1 is wrong.

H2 — **preview-local state (C3)**: the right pane spins forever while the failed file stays selected. This is real and confirmed, but it cannot survive the page unmounting on the way to Catalog, so it explains an incomplete *pane*, not a persistent incomplete *layout*.

H3 — **late completion plus relative-path identity (C2 + C4)**: a stale completion reopens the canvas for a relative path that collides with the newly opened skill's selection, leaving the fresh editor showing a spinner or the wrong file. Also real and confirmed, and it can survive a remount because the canvas state is global (C8) — but it manifests in the preview pane, not as a missing Files panel or missing header actions.

H4 — **responsive misread**: what the reporter saw was the mobile layout on a desktop viewport. H1 predicts exactly that appearance, so this is not a separate cause so much as the observation H1 explains; the diagnosis must record computed `display` values and the winning stylesheet rather than a screenshot impression.

Ruled out by inspection: the session LRU attachment caches and `clearAttachmentCache` (C5 — this path never fetches); `preparationPromise` in `PdfContent` (cleared on rejection by construction); a permanently rejected `lazy()` reference (`AttachmentCanvasBody` recreates it per `pdfRetryKey` via `createPdfContent`); `@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css` (inspected: entirely `.pdf-*`/`.highlight-*`/`.text-segment` class rules, no Preflight, no host-colliding utilities).

### Evidence update — the CSS mechanism is browser-confirmed in isolation

An isolated Chromium check was run against the **actually installed**
`@epam/ai-dial-react-pdf-highlighter/styles.css` and the utilities Tailwind
generates from this repository's own configuration, with no application
involved:

| Viewport | Stylesheet state                                | Desktop Files panel | Header actions |
| -------- | ----------------------------------------------- | ------------------- | -------------- |
| 1440px   | before the vendor sheet                         | `display: block`    | `display: flex` |
| 1440px   | vendor sheet appended, unlayered                | `display: none`     | `display: none` |
| 1440px   | same vendor sheet inside `@layer pdf-vendor`    | `display: block`    | `display: flex` |
| 768px    | all three states                                 | hidden (correct)    | hidden (correct) |

This establishes **the mechanism** H1 names — a late unlayered vendor `.hidden`
outranks the app's `desktop:`-gated counterpart, and a named layer restores host
precedence without breaking the mobile case. It is a **browser-confirmed
isolated CSS reproduction**, not an application-level reproduction of issue
#8842: it does not show that this is what the reporter saw, and it does not
establish that the editor's damaged layout has no additional cause. Tasks 1.3,
1.4, and 1.6 — the application scenarios — remain outstanding, and H1 is not
promoted to a confirmed application-level root cause on this evidence alone.

D5 proceeds on it because the containment it applies is correct independently of
that question: an unlayered vendor Tailwind build loaded after the host's
stylesheet is a defect whether or not it is *the* defect behind #8842. D6 does
not, because it is defence in depth against a mechanism that is now contained,
and it is only warranted by evidence that something still gets through.

## Goals / Non-Goals

**Goals**

- Back returns to the `SKILL.md` view while a supporting file is selected — during loading, after a successful render, and after a failure — without leaving the editor and without prompting about unsaved changes.
- Back from the `SKILL.md` view keeps today's `returnUrl` resolution and unsaved-changes confirmation; Cancel keeps today's exit-plus-confirmation behavior.
- Returning from a preview preserves unsaved manifest fields and uploaded files.
- Opening another skill, or starting a new one, restores the correct selection and the complete responsive layout with no page reload.
- A preview error stays inside the preview pane, is legible, and is retryable.
- A late result from a previous preview can neither replace current content nor reopen a closed preview.
- Separate, recorded root-cause evidence for the navigation defect and the persistent layout defect.

**Non-Goals**

- Reverting or weakening the #8837 fixes.
- Changing `Cancel`, `returnUrl` resolution, or the unsaved-changes guard for the main editing view.
- Reworking the attachment canvas architecture, the catalog's isolated `SkillDetailsFilePreview`, or any other attachment preview surface.
- Moving routing or host integration into `libs/*`.
- Page reloads, timers, arbitrary delays, or blanket global-state resets as remedies.
- Upgrading or forking `@epam/ai-dial-react-pdf-highlighter` (its CSS build is the upstream problem H1 identifies; containing it here is in scope, fixing it upstream is not).

## Decisions

### D1 — Back becomes preview-aware in the application layer

`SkillEditor.tsx` gains a `handleBack` distinct from `handleCancel`:

- while `selectedPath !== SKILL_MANIFEST_FILE`, it sets `selectedPath` back to `SKILL_MANIFEST_FILE` and returns — no navigation, no dirty prompt;
- otherwise it delegates to `handleCancel` unchanged.

`onBack={handleBack}` and `onCancel={handleCancel}` are then distinct props. No library change: `libs/skill-editor` and `libs/builder-form` already forward Back to a host callback, and `openspec/specs/skill-editor-library/spec.md`'s contract ("Back button delegates to onBack", "`onBack` forwarded from `SkillEditorProps`") stays literally true.

*Alternative considered — let `libs/skill-editor` intercept Back when a supporting file is selected.* Rejected: the library would then own a navigation policy, and a host wanting Back to always exit could not express it. The condition is host policy and stays in the page.

*A11y.* The control's meaning changes with selection, so its accessible name must too: `backAriaLabel` becomes the existing `SkillEditorI18nKeys.BackAriaLabel` on the manifest view and a new `skillEditor.backToManifestAriaLabel` key while a supporting file is selected. The view change is announced through a polite `role="status"` region so a screen-reader user learns the pane switched back to `SKILL.md`; focus stays on the Back control, which remains mounted with an updated name. Keyboard operation is unchanged — it is the same `GhostIconButton`.

### D2 — resource-scoped preview identity

The canvas attachment id becomes a composite of the resource and the relative path — `${bucket}/${skillPath ?? '<new>'}#${node.path}` — derived in the page (which already knows `bucket` and `skillPath`) and passed both to `useSkillFilePreviewSync` and to `SkillFilePreview`, so the hook's early return and the component's `isCurrent` check compare the same resource-scoped value. `skillFileToAttachment`'s `Attachment.id` is left alone; only the `canvasAttachmentId` the host passes to `openAttachmentCanvas` becomes scoped, which is precisely the parameter the library documents for this purpose ("Callers that need to track which specific tile opened the canvas … pass a caller-scoped key here").

This **modifies** `skill-file-preview`'s existing requirement that the id be the bare relative path. The guarantee that wording protected — two files sharing a basename in different folders never collide — is preserved and extended to two files sharing a full relative path across skills or buckets.

*Alternative considered — key on `Attachment.id` inside `skillFileToAttachment`.* Rejected: the mapper lives in `libs/chat-hooks` and would then need the host's bucket/resource identity, which is host integration knowledge.

### D3 — request generation checked at the canvas commit boundary

`useSkillFilePreviewSync` numbers its opens monotonically and passes a
per-request guard down to `openAttachmentCanvas`, which consults it immediately
before **each** canvas write that follows an awaited resolver. A request that is
no longer the newest — or that belongs to an editor that has since unmounted —
writes nothing at all: no content, no close, and no failure attributed to the
file the user has already moved away from. Its resolved payload's object URL is
released, since the canvas revokes only what it actually held.

This replaces the corrective guard the first draft of this design specified.
That version checked staleness *after* `openAttachmentCanvas` had already
mutated the canvas, which cannot provide the guarantee: the stale content is
displayed for a render, and the only way back is to reopen the current
selection — a second resolve of a file that was already showing. R5 called that
an acceptable one-render window; it is not, because it is also an extra open.
The check has to sit where the write happens.

**Identity alone is not enough.** Comparing the completing request's
`canvasAttachmentId` against the current selection fails for A → B → A: by the
time the first A completes, its id is the current id again, so it reads as
fresh and publishes content resolved by a superseded request. A monotonically
increasing request number distinguishes them; the id remains as the resource
scope (D2), not as the freshness test.

**Ownership is the same check.** Unmount retires every in-flight request by
bumping the counter, so a completion arriving after the editor is gone can
neither write to nor close a canvas another surface has opened in the meantime.

*Lib change.* `useOpenAttachmentCanvas` gains an optional third argument on
`openAttachmentCanvas` — `shouldCommit?: ShouldCommitCanvas` — consulted at
every post-await commit point. Omitted, every request commits, so no existing
caller changes. This is the smallest change that puts the decision at the
boundary: the hook owns the writes, so only the hook can gate them. It carries
no host knowledge — it asks the caller one question about the caller's own
request — and it is spec'd as a MODIFIED requirement in
`specs/attachment-canvas-workflow/spec.md`.

*Alternative considered — thread an `AbortSignal` through `useOpenAttachmentCanvas`.*
Still rejected, and for a sharper reason than before: cancelling the resolvers
is not needed to stop a stale **state commit**, which is the whole defect.
Aborting I/O is a separate (and much larger) concern — every resolver would
have to honour it — and would not by itself prevent a commit.

*Alternative considered — give the Skill Editor its own isolated
`AttachmentCanvasProvider`, as the catalog's `SkillDetailsFilePreview` does.*
Isolation bounds the blast radius to the editor's own provider; it does not stop
a stale request inside that provider from clobbering a newer one, which is the
A → B → A case. It also still needs a further MODIFIED requirement against
`skill-file-preview`'s explicit "SHALL NOT require any new route-level
provider". Kept as a fallback if diagnosis shows shared canvas state
contributing beyond what the commit guard covers — not needed for the orderings
covered here.

*Re-entrancy.* Committing a failure closes the canvas, which re-runs the
reconciliation effect before the failure has been recorded. The hook therefore
also tracks the id of the open currently in flight and does not issue a second
open for it — without that, a failing file reopens in a loop and the error state
never settles. This was found by the failing-preview test, not by inspection.

### D4 — explicit preview states replacing `!isCurrent ⇒ loading`

`SkillFilePreview`'s `isLoading={!isCurrent || isLoading}` is replaced by three explicit states driven by the sync hook: **Loading** (an open for this id is in flight), **Ready** (the canvas's `attachmentId` equals this id), **Error** (the open for this id resolved `false` or threw). The hook records the failed id and exposes it along with a `retry` that re-runs the open for the current selection; `SkillFilePreview` renders the error in a `role="alert"` region with a real `<button>` Retry, reusing `AttachmentCanvasI18nKeys.LoadErrorLabel` and `ButtonsI18nKeys.Retry`. A state enum (`SkillFilePreviewState { Loading = 'loading', Ready = 'ready', Error = 'error' }`) is used rather than a string-literal union, per the project's enum rule. The failed id is cleared when the selection changes or a retry starts, so the error cannot outlive its file.

### D5 — contain the vendor stylesheet in a named cascade layer

Applied on the isolated browser evidence above, which confirms the mechanism. The direct `import '@epam/ai-dial-react-pdf-highlighter/styles.css'` in `PdfContent.tsx` is replaced by a co-located wrapper stylesheet that pulls both vendor sheets into a named layer:

```css
@import '@epam/ai-dial-react-pdf-highlighter/styles.css' layer(pdf-vendor);
@import '@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css' layer(pdf-vendor);
```

Unlayered author styles outrank every layered rule regardless of document order, so each app utility wins over the vendor sheet while the vendor's own `.pdf-*`/`.highlight-*`/`.text-segment` rules — which no app rule competes for — keep applying. The lazy boundary `attachment-canvas-package-loading` requires is untouched: the wrapper is still imported from the lazily loaded module, so nothing is requested until a PDF opens. `pdf-highlighter-kit`'s sheet is layered alongside it for a single seam even though inspection clears it of any host collision.

This stays inside the library that already owns the import, and it carries no host knowledge — it is how `libs/attachment-canvas` loads its own declared peer's stylesheet. `.claude/rules/lib-styling.md` and `.claude/rules/libs.md` apply, and the `./styles.css` export contract must still match what the build emits (`npm run validate:docs` checks this).

*Alternative — import the vendor sheet eagerly from the app entry, before the app's own CSS.* Rejected as primary: it breaks `attachment-canvas-package-loading`'s "no PDF-vendor stylesheet is requested … until a PDF opens" requirement and adds the CSS to first paint. Kept as the fallback if `layer()` does not survive the build (see R2).

*Alternative — strip or prefix Preflight and utilities from the vendor sheet with a PostCSS step.* Rejected: the vendor's own components render with those utility class names, so stripping them breaks the viewer, and distinguishing structural from colliding rules is guesswork against a build artifact.

*Alternative — upgrade or patch the upstream package so it stops shipping Preflight.* Correct long-term fix, out of scope here; the containment layer holds regardless of the upstream version and should be recorded as such in the change's notes.

### D6 — breakpoint-pair hardening as defence in depth, never as the fix

**Not applied in this change.** Containment (D5) removes the mechanism that made
the pair fragile, and the isolated check confirms the layered sheet preserves
both the desktop and the mobile case. Changing four files in two libraries needs
its own evidence that something still gets through after containment — a
remaining application-level failure, or another late unlayered stylesheet — and
there is none. It is recorded here so a later change can pick it up against that
evidence rather than as a reflex.

`hidden desktop:block` and `hidden desktop:flex` depend on a base utility losing to a variant. Under this project's exclusive `mobile: { max: 1279px }` / `desktop: { min: 1280px }` screens, `mobile:hidden desktop:block` is semantically identical and immune to a late base-utility override. Applying it to `EditorLayout.tsx:73`, `SkillEditor.tsx:422`, `BuilderFormBody.tsx:27`, and `BuilderFormHeader.tsx:71` is cheap insurance — but it is applied **after** D5 and never instead of it, because Preflight and the remaining duplicated utilities would still be loose in the cascade. If diagnosis disproves H1, D6 is dropped entirely rather than kept as a cosmetic change.

### D7 — verification honesty

jsdom does not evaluate the cascade, so **no unit test can substantiate D5**. Coverage is split explicitly and labelled as such in the tasks:

- *Mocked (Vitest + Testing Library):* Back/Cancel routing and prompts, dirty preservation, selection reset across resources, late-completion ordering, error/retry states, resource-scoped ids.
- *Build assertion:* the emitted PDF stylesheet contains the `layer(pdf-vendor)` statement and the vendor rules resolved inside it.
- *Browser (manual, recorded in the change notes):* computed `display` of the desktop Files panel and header actions before and after a PDF preview, which stylesheet wins in DevTools, at desktop and mobile widths, in both themes, plus a rendered PDF in the conversation canvas and in the editor.

A passing unit suite is never reported as browser verification.

## Risks / Trade-offs

- **R1 — H1 is unconfirmed; the layout half could be mis-aimed.** → Task group 1 is a falsification pass with H1's two predictions (successful preview; conversation PDF) run before any code change. The spec deltas are written against observable behavior rather than mechanism, so they survive a different verdict; the design's H2/H3 branch and D3's isolation fallback cover the alternatives.
- **R2 — `@import … layer()` may not survive the library build or Vite's CSS handling.** → **Resolved; the premise was also wrong.** `vite-external-matcher.ts` explicitly does *not* externalize a `.css` subpath (`isExternalPeerImport` returns `false` for any id ending in `.css`, so `resolve.alias` can resolve it and Vite can extract it) — the vendor sheet is inlined by this library's own build, not by the consuming app. Verified in both builds: `libs/attachment-canvas/dist/PdfContent.css` and the app's `assets/PdfContent-*.css` each contain exactly one `@layer pdf-vendor{…}` holding the entire vendor payload, with only this lib's own CSS-module rule outside it, and neither `dist/index.css` nor the app's eager `index.html` stylesheet set carries any of it. The eager-import fallback is not needed.
- **R3 — layering could regress the PDF viewer's own appearance** if any vendor rule silently depended on outranking an app rule. → Visual verification of a rendered PDF, thumbnails, and highlights in both themes and both layouts, in the conversation canvas as well as the editor.
- **R4 — D2 changes a spec'd identity contract.** → MODIFIED requirement with scenarios for both the old guarantee (same basename, different folders) and the new one (same relative path, different skills or buckets).
- **R5 — a guard applied after the write cannot hide a stale completion.** → Resolved by moving the check to the commit boundary (D3): the stale write never happens, so there is no window and no redundant reopen. The tests assert the absence of the extra open, not only the end state — an end-state-only assertion passes even when the stale content was displayed and then corrected, which is exactly the defect.
- **R6 — changing `SkillFilePreview`'s props touches a component the catalog path also renders.** → `SkillFilePreview` is app-owned (`apps/chat/src/components/SkillFilePreview`); its other consumers are enumerated and updated in the same change, and the shared-canvas consumers outside the Skill Editor are exercised as regression coverage.
- **R7 — D6 edits files in two libraries for a defensive reason.** → Only after D5 lands and only if diagnosis warrants it; each changed class pair is semantically identical under the project's breakpoints, and mobile/desktop rendering is verified.

## Migration Plan

No data, schema, API, or configuration migration. The change is a fix on `development`, deployed normally; rollback is a revert. D5 changes only how an already-lazy stylesheet is loaded, so there is no cache-busting or client-coordination concern. If D5's fallback (eager import) is taken instead, `attachment-canvas-package-loading`'s lazy-load requirement must be amended in the same change rather than quietly violated.

## Open Questions

1. Which induced failure modes actually load the PDF chunk — download fault, worker fault, render fault? C5 says the editor's in-memory path always reaches `AttachmentContentType.Pdf`, so a "download" fault must be induced inside the viewer rather than at the resolver; the diagnosis task records chunk and stylesheet loading per mode.
2. Does the persistent failure reproduce from a conversation PDF with no skill preview at all? A yes settles H1 and also means the defect is app-wide, not Skill-Editor-specific — which would widen the regression coverage (and is worth noting on the issue).
3. Does `@import … layer()` survive `libs/attachment-canvas`'s build with the specifier externalized (R2)?
4. Is the shared attachment canvas contributing at all, or is D3 + D2 sufficient without isolating the provider (D3's fallback and its extra spec delta)?
5. Should the editor's Back also be reachable by `Escape` while a supporting file is selected? Not part of the reported defect and not specified here; raised because the same "return to the previous view" affordance is conventionally keyboard-bound.
