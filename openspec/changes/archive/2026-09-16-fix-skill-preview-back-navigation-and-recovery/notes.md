# Implementation notes

## Evidence classes used here

Every claim below is labelled with one of these, and they are not
interchangeable:

- **Source inspection** — read from the code, no execution.
- **Mocked test** — Vitest + Testing Library, jsdom. Does not evaluate the CSS
  cascade, layout, focus order, or a screen reader.
- **Isolated browser check** — a real browser, real installed artefacts, but no
  application. Establishes a mechanism, not a user-visible symptom.
- **Build check** — an assertion against emitted build output.
- **Application-level check** — the running application, the actual reported
  scenario. One was performed, as a **smoke check** (see below); no scenario
  matrix was recorded.

## Application-level smoke check (user-confirmed)

The user ran the change in the running application and confirmed that the
behavior they exercised works correctly. Recorded here as a **user-confirmed
application-level smoke check**, on their instruction and in their words: no
scenario list, viewport sizes, or themes were reported, and none are inferred.

It is real evidence that the change is not grossly broken in the app — which
nothing else here established. It is **not** a substitute for any specific
outstanding task: every scenario, width, and theme below that is marked
unverified stays unverified, including task 5.6 (the PDF viewer's own appearance
after layering), 5.5, 3.6, 1.3/1.4/1.6, and 7.1-7.4. A layered-Preflight
regression would most plausibly surface as subtle spacing or border changes
inside the viewer rather than as an obviously broken page, so a smoke check is
exactly the kind of evidence that would miss it.

## Status

Groups 2, 3, 4, and 5 are implemented and verified to the extent the classes
above allow. Group 6 is deliberately not applied. Group 1's application-level
steps (1.1–1.8) and every application-level check in groups 3, 5, and 7 remain
outstanding.

## The diagnosis gate, split in two

The CSS **mechanism** H1 names is now **browser-confirmed in isolation**. An
isolated Chromium check used the actually installed
`@epam/ai-dial-react-pdf-highlighter/styles.css` and utilities generated from
this repository's Tailwind configuration, with no application involved:

| Viewport | Stylesheet state                             | Files panel      | Header actions   |
| -------- | -------------------------------------------- | ---------------- | ---------------- |
| 1440px   | before the vendor sheet                      | `display: block` | `display: flex`  |
| 1440px   | vendor sheet appended, unlayered             | `display: none`  | `display: none`  |
| 1440px   | same sheet inside `@layer pdf-vendor`        | `display: block` | `display: flex`  |
| 768px    | all three states                             | hidden (correct) | hidden (correct) |

What this does establish: a late unlayered vendor `.hidden` outranks the app's
`desktop:`-gated counterpart, and a named layer restores app precedence without
breaking the mobile case.

What it does **not** establish: that this is what issue #8842's reporter saw,
or that the editor's damaged layout has no additional cause. **H1 is not
promoted to a confirmed application-level root cause.** Tasks 1.3, 1.4, and 1.6
stay open.

D5 proceeds on this anyway because the containment is correct independently of
that question — an unlayered vendor Tailwind build loaded after the host's
stylesheet is a defect whether or not it is *the* defect behind #8842.

## Why groups 3 and 4 were implemented ahead of the gate

`design.md` attributes the navigation defect and the preview-state defects to
C1–C4, all confirmed by source inspection and none dependent on H1's verdict.
This was an explicit user decision, not an assumption.

## Evidence per claim

### Navigation (group 3)

| Claim                                                                         | Evidence        |
| ----------------------------------------------------------------------------- | --------------- |
| Back returns to `SKILL.md` while a supporting file is selected, clean & dirty  | Mocked test     |
| Back from `SKILL.md` keeps `returnUrl` + unsaved-changes prompt                | Mocked test     |
| Cancel still exits from a preview, guarded when dirty                          | Mocked test     |
| The Back control's accessible name changes with the selection                  | Mocked test     |
| Unsaved fields, uploaded files, and dirty state survive a preview round trip   | Mocked test     |
| A polite `role="status"` region announces the return                           | **Source only** |
| Focus stays on the Back control across the return                              | **Not verified** — needs a browser (task 3.6) |
| RTL glyph mirroring, `ar` locale, mobile width, keyboard operation             | **Not verified** (task 3.6) |
| Screen-reader announcement is actually heard, and heard once                   | **Not verified** — the review noted the live region and the changed accessible name may double up |

### Preview state (group 4)

| Claim                                                                        | Evidence    |
| ---------------------------------------------------------------------------- | ----------- |
| A stale completion writes no content and closes nothing                      | Mocked test (app + lib) |
| A → B → A with the first A completing last is ignored                        | Mocked test |
| A stale completion does not force a redundant reopen of B                    | Mocked test (asserts the *call count*, not only the end state) |
| A stale failure is not attributed to the current selection                   | Mocked test |
| An abandoned request does not replace or close another surface's canvas      | Mocked test |
| A discarded payload's object URL is revoked                                  | Mocked test (lib) |
| The guard is evaluated at commit time, not call time                         | Mocked test (lib) |
| Omitting the guard preserves prior behavior                                  | Mocked test (lib) + the lib's pre-existing 362-test suite |
| Resource-scoped id distinguishes two skills / two buckets                    | Mocked test |
| A failed preview shows an error + retry; retry re-attempts; selection clears it | Mocked test |
| The failure is announced in a `role="alert"` region                          | Mocked test (DOM role), **not** heard in a screen reader |

### Style containment (group 5)

| Claim                                                                        | Evidence    |
| ---------------------------------------------------------------------------- | ----------- |
| The mechanism: unlayered vendor CSS collapses the layout; the layer fixes it | Isolated browser check |
| `@import … layer()` survives the **library** build                           | Build check — `dist/PdfContent.css` holds exactly one `@layer pdf-vendor{…}` wrapping the entire vendor payload; only this lib's own CSS-module rule sits outside |
| It survives the **application** build                                        | Build check — `apps/chat/dist/assets/PdfContent-*.css`, same shape |
| The lazy boundary still holds                                                | Build check — `index.html` links no `PdfContent-*.css`; it appears only in the `__vitePreload` dependency list of the dynamic import, and `dist/index.css` carries none of the payload |
| The assertion is enforced going forward                                      | `libs/attachment-canvas/tests/package-boundary/pdf-vendor-style-containment.spec.ts` (the `test` target depends on `build`, so it always runs against fresh output) |
| The PDF viewer itself is undamaged by layering                               | **Not verified** (task 5.6). This is the material risk: Preflight now sits below *all* unlayered author styles, including inside the viewer. Only the string-level build assertion covers it today. |
| The editor layout survives a preview attempt in the running app              | **Not verified** (tasks 5.5, 7.2) |

### Preserved behavior (group 7)

| Claim                                                                        | Evidence    |
| ---------------------------------------------------------------------------- | ----------- |
| #8837/#8850 fixes untouched                                                  | Source inspection — empty diff against `libs/chat-hooks` and `apps/chat/src/utils/pdf.ts`; the worker is still `pdfjs-dist/build/pdf.worker.min.mjs?url`, not a CDN; no size cap on this path |
| Object URLs revoked on replacement and unmount                               | Mocked test (the provider's existing behavior, unchanged) |
| Object URLs revoked on the new discard path                                  | Mocked test (lib) |
| Large supporting PDF still previews; worker actually loads                   | **Not verified** (task 7.3) |
| Other shared-canvas consumers (conversation, sources, citations, catalog)    | **Not verified** (task 7.1); their unit suites pass |

## Design deviations recorded

**D3 was rewritten.** The first version put the guard *after*
`openAttachmentCanvas` had already mutated the canvas. That cannot provide the
guarantee: the stale content is displayed for a render and the current selection
has to be reopened to recover — a second resolve of a file that was already
showing. The check now sits at the commit boundary inside
`libs/attachment-canvas`, via a new optional `shouldCommit` argument. R5 was
rewritten accordingly; the tests assert the absence of the extra open, because
an end-state-only assertion passes even when the stale content was displayed and
then corrected.

**Identity comparison was not enough.** A → B → A makes the first A's id current
again, so it reads as fresh. Requests are numbered monotonically instead.

**A lib public contract changed.** `openAttachmentCanvas` gains an optional third
argument (`ShouldCommitCanvas`), spec'd as a MODIFIED requirement in
`specs/attachment-canvas-workflow/spec.md`, exported from the package root, and
documented in the lib README. Omitted, behavior is unchanged, so no existing
caller is affected.

**R2's premise was wrong.** The design assumed
`vite-external-matcher.ts` externalizes the vendor CSS specifier, leaving it for
the consuming app to resolve. It does the opposite: `isExternalPeerImport`
returns `false` for any id ending in `.css`, precisely so `resolve.alias` can
resolve it and Vite can extract it. The eager-import fallback was never needed.

**Re-entrancy, found by a test rather than by inspection.** Committing a failure
closes the canvas, which re-runs the reconciliation effect before the failure is
recorded — the file reopened in a loop and the error state never settled. The
hook now tracks the in-flight id and will not issue a second open for it.

**D6 is not applied.** Containment removes the mechanism that made
`hidden desktop:*` fragile, and the isolated check confirms the layered sheet
preserves both the desktop and the mobile case. Editing four files across two
libraries needs evidence that something still gets through *after* containment;
there is none.

**The error region is `ErrorText`'s own `role="alert"`.** An outer
`role="alert"` container nested two alert regions; the outer one was removed.

**`SecondaryButton` does not exist in `@epam/ai-dial-ui-kit`.** The retry control
uses `NeutralButton`, matching `OverlayLoginGate`'s retry.

## Known gaps the review raised

**Still open.** The catalog's `SkillDetailsFilePreview` keeps the indefinite
spinner when a resolver finds nothing to display. Unchanged by this change and
out of its declared Non-Goals; the misleading comment that claimed otherwise was
corrected rather than the behavior. It wants its own change.

**Closed as unreachable, by source inspection — no code fix warranted.**

- *A supporting file listed in `files` with no bytes in `filesContentRef`.*
  Every writer fills the ref **before** publishing the node:
  `useSkillFileActions`'s upload sets bytes at line 198 and calls `setFiles` at
  204; `useSkillEditorLoad` builds the map at 258 and calls `setFiles` at 260. A
  removal drops the node from `files` as well, which the `node == null` branch
  already handles. Left as a quiet no-op with a comment saying why: the only way
  it could occur is a transient frame, and an error state would make a transient
  permanent.

- *Re-uploading a file at the previewed path.* Not something the editor permits:
  `skill-file-batch-validation.ts:167` rejects an upload at an existing path with
  `pathDuplicate`. Replacement is remove-then-add, and the removal closes the
  preview (and resets the selection when the removed file was the selected one),
  so reselecting opens the new bytes through the ordinary path. **The spec was
  describing behavior the product does not have** — the requirement and its
  scenario in `specs/skill-file-preview/spec.md` were corrected to the real flow
  rather than left as an unmet obligation.

## Verification runs

- `npm run validate:docs` — passes.
- `npm run verify:changed` — typecheck and lint pass; tests fail **only** on
  `libs/chat-hooks/src/files/tests/create-files-api.spec.ts` (2 cases).
- `npm run lint:check:quiet` (full) — passes.
- `npm run test:full:quiet` — same 2 failures, nothing else.
- `npm run typecheck:full:quiet` — fails in `@epam/chat-api` test files.

Both failures are **pre-existing on `development`** and untouched by this change:
the `chat-hooks` cases were reproduced with this change stashed, and this change
has an empty diff against `apps/chat-api`.

`attachment-canvas-consumer-fixture:verify` could not run: `npm install` of the
packed tarballs fails with `ETARGET` resolving `@epam/*` versions from the
registry in this environment. It fails the same way on a clean tree, so it is
environmental — but it was **not** proven to pass with this change.

## Outstanding

1. Group 1's application-level steps, especially 1.3, 1.4, 1.6 — H1's
   application-level attribution.
2. Task 5.6 first among the browser checks: the PDF viewer's own appearance
   after layering is the one thing layering could plausibly have broken.
3. Tasks 3.6, 5.5, 7.1, 7.2, 7.3, 7.4 — the remaining browser, keyboard, focus,
   screen-reader, and RTL checks.
4. Task 4.8's branch (D3's isolation fallback) stays open pending 1.7/1.8; the
   commit-boundary guard covers every ordering tested here without it.
