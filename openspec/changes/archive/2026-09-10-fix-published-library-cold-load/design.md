## Context

Merged multi-entry library chunks can retain markdown, file-manager and renderer code for a lightweight root import. Source aliases conceal this distribution defect. Measurements must compare the same host, dependency versions and production settings with source and freshly packed libraries.

## Goals / Non-Goals

Reduce published startup cost, preserve APIs and shared state, and enforce reproducible consumer gates. Do not rewrite unrelated features or promise a particular Lighthouse/LCP result.

## Decisions

1. **Granularity.** Use `preserveModules` for chat-shared/chat-hooks. Externalize their declared runtime dependencies and peers, including subpaths, so preserved output contains portable library modules rather than monorepo-relative vendored paths. Keep CSS handling explicit.
2. **Compatibility.** Root exports remain synchronous. Bundlers may need root feature peers installed during resolution even when their code is eliminated. Minimal peer installation is a scoped-entry contract; root probes verify retained bytes with the documented peer closure installed.
3. **Entries and state.** Keep pure source-content classification independent of renderers, preserving MIME behavior. Root and scoped re-exports share the same OAuth/cache modules. Preserve only verified initialization in `sideEffects`.
4. **Styles.** Publish stable stylesheet exports. Catalog/publish-panel own their utilities; peers own theirs. Markdown owns KaTeX CSS/fonts. Remove accidental peer-style inlining without dropping required feature styles.
5. **Verification.** Build identical React hosts in source and isolated tarball modes. Both hosts load the documented shared stylesheet artifact; source aliases vary JavaScript. Exercise startup hooks, conversation sources and mapping; mount deferred features with deterministic adapters. Audit resolved paths and installed tarball integrity. Missing manifest/origin data is an error.
6. **Budgets.** Enforce a 1.20 packed/source ratio for raw/gzip startup JS, plus fixed JS/CSS/assets ceilings and semantic exclusions. Track requests by start time, including early dynamic requests that finish after the ready marker. Tiny enum/utility probes use fixed 1024 B raw / 512 B gzip limits; source classification uses 2048 B / 1024 B. These limits include bundler scaffolding and never grow automatically with source size.
7. **Release.** Pack the complete affected internal peer closure at one version. Check normal npm installation, declarations, exports and tarball integrity without hiding incompatible peers. Test mixed releases using existing local artifacts.

## Risks / Trade-offs

- More published modules increase file count; consumer bundling and portable packed imports determine success.
- Incorrect `sideEffects` metadata can lose initialization or retain unrelated features; behavior and size checks are both required.
- Root compatibility retains a broad resolution surface. Document scoped imports rather than claiming root imports need no optional peers.
- Browser module failures can be cached for a document's lifetime. Reload recovery and same-document loader retry are distinct checks; do not report one as the other.

## Validation and Rollout

Run library build/tests, packed probes, static/browser parity, coherent installation and documentation validation. Keep any unverified acceptance task open. Commit measurements and budget changes with rationale. Upgrade all affected internal packages and the consumer lockfile together; rollback restores the previous complete set and lockfile.
