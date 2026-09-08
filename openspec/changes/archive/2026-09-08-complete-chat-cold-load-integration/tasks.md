## 1. Integration

- [x] Build and pack the local UI Kit; verify with a fixed dependency toolchain.
- [x] Move catalog Grid to `/grid`; move prompt, skill and scheduled-task editor loaders to `/editors`.
- [x] Externalize UI Kit subpaths in the affected library builds and raise compatible peer minimums.
- [x] Add shared `/file-manager` entry, aliases and side-effect metadata without changing library isolation.
- [x] Lazy-load conversation publishing and remove obsolete manual chunks.
- [x] Update public READMEs and the architecture document.

## 2. Verification and reproducibility

- [x] Verify a packed local artifact without changing other installed dependencies.
- [x] Test transitive static leaks, dynamic boundaries, backtick imports and orphan chunks.
- [x] Run focused catalog, file-manager, publication and editor tests.
- [x] Build all seven changed libraries, including shared declaration and stylesheet output.
- [x] Run documentation validation.
- [x] Complete full repository verification and record any existing unrelated failures.
- [x] Complete final production graph measurement and browser smoke on desktop/mobile.
- [x] Verify the locked registry package separately from the local artifact and record limitations.

## 3. UI Kit follow-up and final cleanup

- [x] Reproduce root `LazyMarkdownEditor` + lazy `/grid` in a standalone Vite 8 consumer.
- [x] Record the root-loader defect in UI Kit section 9 for its owner to implement.
- [x] Rebuild and pack UI Kit after section 9; verify root/subpath loader isolation and real feature activation.
- [x] Repeat production graph and desktop/mobile browser checks after cleaning the chat diff.
- [x] Remove local installer, graph plugin/checker, mock browser server and their npm/Nx wiring from the delivery.
- [x] Remove redundant barrel rewrites and unrelated lockfile peer-classification churn.
- [x] Update final evidence and run the documentation, formatting and relevant quality checks.

UI Kit section 9 is published in `0.14.0-dev.36`. The root dependency, registry
lockfile and installed package now use that release; no local substitution is
needed. The final release verification is recorded in `verification-report.md`.
