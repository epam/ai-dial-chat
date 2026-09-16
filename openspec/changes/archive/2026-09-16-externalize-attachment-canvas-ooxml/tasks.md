## 1. Externalize the OOXML runtime

- [x] 1.1 Update `libs/attachment-canvas/src/utils/vite-external-matcher.ts` and `libs/attachment-canvas/vite.config.mts` to use package-oriented matcher names and externalize `@silurus/ooxml` plus its subpaths while preserving local CSS handling. Keep `@silurus/ooxml` in `dependencies`, and verify the library still contains no host-owned routes, clients, contexts, auth, environment, storage, analytics, or platform setup. **Verification:** run `npm run test:file -- libs/attachment-canvas/src/utils/tests/vite-external-matcher.spec.ts` after updating the focused matcher tests.
- [x] 1.2 Update `libs/attachment-canvas/tests/package-boundary/externalized-peers.spec.ts` so every declared dependency and peer must have an explicit externalization entry, removing the bundled-OOXML exception. **Verification:** build the library, then run `npm run test:file -- libs/attachment-canvas/tests/package-boundary/externalized-peers.spec.ts`.

## 2. Guard the built and packed package boundary

- [x] 2.1 Extend `libs/attachment-canvas/tests/package-boundary/dist-static-closure.spec.ts` and/or a focused package-artifact spec to assert that built output retains the external `@silurus/ooxml/{docx,xlsx,pptx,chart-ex}` dynamic imports, emits no private OOXML renderer/worker chunks, and stays within compressed/unpacked size ceilings measured after externalization. Update `libs/attachment-canvas/tests/package-boundary/bundle-budgets.spec.ts` comments or budgets only where the new measurement makes them stale. **Verification:** run the exact changed package-boundary spec files with `npm run test:file -- <workspace-relative-path>` after `npm exec nx build @epam/ai-dial-attachment-canvas`.
- [x] 2.2 Extend `tools/attachment-canvas-consumer-fixture/scripts/verify-build-output.mjs` and its README where needed so the clean packed-tarball build proves OOXML is absent from the eager graph and present in on-demand consumer chunks. **Verification:** run `npm exec nx run attachment-canvas-consumer-fixture:verify` and `npm run validate:docs`.

## 3. Validate real consumer compatibility

- [x] 3.1 Generate a publish-shaped local tarball and record its `npm pack --dry-run --json` compressed/unpacked sizes against the 5,232,865 / 15,036,047-byte baseline. Inspect the tarball file list to confirm the multi-megabyte OOXML renderer and worker chunks are absent. **Verification:** retain the measured values in `openspec/changes/externalize-attachment-canvas-ooxml/design.md` and ensure the automated ceiling has enough ordinary-growth headroom while still catching rebundling.
- [x] 3.2 Preserve the existing state of the downstream validation workspace, temporarily install the local canvas tarball with manifest and lockfile saving disabled, then run its production build and existing browser coverage for DOCX and XLSX. Restore the previously installed canvas package and confirm its tracked state is unchanged. **Verification:** both downstream commands pass with no module-resolution, worker, or CSP errors.

## 4. Final verification

- [x] 4.1 Run `npm run verify:changed` for the completed slice and resolve any affected typecheck, lint, or test failures.
- [x] 4.2 Run exactly one `npm run verify:full`, then run `openspec validate externalize-attachment-canvas-ooxml --strict` and review `git diff --check` plus `git status --short` to confirm only intended files changed. **Result:** the full run stopped on pre-existing `@epam/chat-api:typecheck` errors outside this change; strict OpenSpec validation and diff checks passed.
