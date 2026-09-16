## Why

`@epam/ai-dial-attachment-canvas` embeds the `@silurus/ooxml` DOCX, XLSX, PPTX, and worker implementations in its own tarball even though `@silurus/ooxml` is already a runtime dependency. The resulting package is about 15 MB unpacked, with roughly 14.7 MB concentrated in eight OOXML-generated chunks, and its successfully uploaded versions remain unavailable from npm much longer than the other packages published by the same workflow.

Externalizing those imports gives npm a much smaller `attachment-canvas` artifact to scan while preserving automatic installation and on-demand loading through the separately published dependency.

## What Changes

- Externalize the bare `@silurus/ooxml` package and every exported subpath from the Vite library build.
- Keep `@silurus/ooxml` in `dependencies`, so consumers receive it transitively and do not need to declare a new peer dependency.
- Preserve the existing per-format dynamic imports for DOCX, XLSX, PPTX, CSV, and `chart-ex`; the consumer bundler resolves them from the installed dependency.
- Strengthen package-boundary tests to require all declared runtime dependencies and peers to remain external, and assert that built output contains external OOXML dynamic import specifiers instead of private renderer chunks.
- Update bundle/package budgets from measured output and verify a packed tarball in the repository consumer fixture.
- No public TypeScript API, attachment routing, visual behavior, i18n, RTL behavior, accessibility behavior, or host integration contract changes.

### Non-goals

- Changing the `@silurus/ooxml` version or its public viewer APIs.
- Moving `@silurus/ooxml` to `peerDependencies` or requiring host applications to install/configure it explicitly.
- Changing PostCSS, Tailwind, npm publish authentication, provenance, or the publish workflow.
- Claiming that a smaller tarball guarantees a particular npm scan time; publish latency must be measured on a later dev release.

### Acceptance criteria

- The packed `@epam/ai-dial-attachment-canvas` tarball contains no private OOXML renderer or worker implementation chunks and is materially smaller than the current 5.23 MB compressed / 15.04 MB unpacked baseline.
- Installing only the packed canvas tarball into a clean consumer installs `@silurus/ooxml` transitively and permits Vite to resolve every runtime subpath.
- Existing package tests and the tarball consumer fixture pass.
- An additional downstream Vite validation builds with the local tarball and renders DOCX and XLSX without module-resolution, worker, or CSP failures.

### Compatibility and rollback

This is intended to be backward compatible: public exports and dependency ownership remain unchanged. If a supported consumer bundler cannot resolve the external dynamic imports, rollback consists of removing `@silurus/ooxml` from the externalization matcher and restoring the current package-boundary expectations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `attachment-canvas-package-loading`: Require the declared OOXML runtime dependency to remain external to the canvas tarball and extend built-package/consumer verification to cover its dynamic imports.
- `attachment-canvas-ooxml-viewer`: Preserve on-demand format loading while resolving `@silurus/ooxml` from the transitively installed dependency instead of package-private bundled chunks.

## Impact

- Build configuration and boundary checks under `libs/attachment-canvas`, following the existing externalization matcher at `libs/attachment-canvas/src/utils/vite-external-matcher.ts:8` and its manifest-consistency test at `libs/attachment-canvas/tests/package-boundary/externalized-peers.spec.ts:34`.
- `@silurus/ooxml` remains a host-agnostic document-rendering dependency; no app-owned route, auth, storage, environment, or generated-client knowledge enters the library.
- The repository tarball fixture remains the clean-install compatibility gate; an additional downstream Vite validation exercises production bundling and DOCX/XLSX rendering without becoming part of the product contract.
- No documentation of the public API changes, but the existing OpenSpec requirements that call the runtime "bundled" must be updated.
