## Context

`libs/attachment-canvas` is a publishable Vite library. Its externalization matcher already keeps every declared runtime package except `@silurus/ooxml` out of the library artifact. OOXML is deliberately imported through format-specific `import()` calls in `OoxmlContent`, but because it is omitted from the matcher, Rollup resolves those imports and emits the renderer, worker, and shared implementation chunks into `dist/`.

The current packed artifact is 5,232,865 bytes compressed and 15,036,047 bytes unpacked. Eight generated OOXML-related files account for 14,685,047 unpacked bytes. Other packages from the same publish workflow become available while the canvas version remains `E404`, so package content and npm's post-upload scan are the remaining differentiators. Reducing the tarball cannot guarantee registry latency, but it removes the dominant unique input.

`@silurus/ooxml@0.87.0` declares ESM exports for `./docx`, `./xlsx`, `./pptx`, and `./chart-ex`, so Vite consumers can resolve the same specifiers after npm installs the dependency. In addition to the repository fixture, the implementation will be checked in a downstream Vite application that exercises production bundling, CSP transformation, and DOCX/XLSX rendering. That application is validation-only and is not part of this change's product contract.

No application or external-system knowledge moves into the library. The canvas continues to receive only resolved content URLs and formats through its existing public API; dependency resolution remains ordinary npm/Vite behavior at the consumer boundary.

## Goals / Non-Goals

**Goals:**

- Remove private OOXML implementation and worker chunks from the canvas tarball.
- Preserve automatic installation by retaining `@silurus/ooxml` as a runtime dependency.
- Preserve per-format lazy loading and current rendering behavior.
- Prove compatibility using built output, a clean tarball consumer, and an additional downstream production/browser validation.
- Record measured package-size evidence that can be compared with a later npm dev publish.

**Non-Goals:**

- Changing the OOXML renderer version, APIs, worker model, or rendering behavior.
- Making OOXML a peer dependency or adding host configuration.
- Changing CSS processing or npm publishing behavior.
- Guaranteeing or simulating npm malware-scan duration locally.
- Adding user-visible strings, UI, feature flags, telemetry, endpoints, caching, or state.

## Decisions

### Decision 1 — Externalize every declared JavaScript runtime package, including OOXML

Add `@silurus/ooxml` to the explicit package-name allowlist used by `rollupOptions.external`. Rename the internal `EXTERNAL_PEER_NAMES` / `isExternalPeerImport` symbols to package-oriented names because the list covers both `dependencies` and `peerDependencies`. Exact and `<name>/...` subpath matching remains unchanged; `.css` imports remain locally resolved so Vite can extract them.

The manifest-consistency test will require every declared dependency and peer to appear in the matcher. This removes the one-off bundled exception and makes future dependency additions fail until their package-boundary choice is explicit.

Alternatives considered:

- Keep the current bundle and only add post-publish polling. This improves CI reporting but does not reduce the content npm scans.
- Move OOXML to `peerDependencies`. This would shrink the tarball but force every host to manage an implementation detail it does not configure.
- Exclude generated chunks with `package.json#files`. This would publish unresolved relative imports and break document viewing.

### Decision 2 — Preserve source dynamic imports as external dynamic imports

`OoxmlContent` keeps its existing `import('@silurus/ooxml/docx')`, `xlsx`, `pptx`, and `chart-ex` boundaries. Rollup emits those bare dynamic import specifiers instead of private relative chunks. The installed dependency's exports map resolves them when a consuming Vite app builds, and that app owns final chunking.

No source-level viewer logic changes. Type-only OOXML imports remain type-only. This keeps DOCX, XLSX/CSV, and PPTX independent and prevents the eager canvas entry from acquiring the renderer.

Alternatives considered:

- Add a canvas-level wrapper chunk for each format. It adds indirection without changing who owns the implementation bytes.
- Replace dynamic imports with static imports and rely on the consumer to split them. That weakens the existing lazy-load contract.

### Decision 3 — Verify both package ownership and downstream runtime behavior

Verification has four layers:

1. Matcher unit tests cover the OOXML bare name/subpaths and CSS exception behavior.
2. Built-package tests assert that the canvas output retains external OOXML dynamic imports, contains no generated renderer/worker implementation chunks, and meets a newly measured packed-size ceiling.
3. The isolated consumer fixture installs the publish-transformed tarball. Its build-output verifier asserts OOXML remains absent from the eager graph and is present in on-demand consumer chunks, proving the dependency is installed and bundled by the host.
4. A downstream Vite application installs the local tarball without saving manifest/lockfile changes, runs its production build, and runs existing browser coverage for DOCX and XLSX. Its pre-existing files remain untouched, and the installed canvas package is restored afterwards.

PPTX resolution is covered by the library's existing component tests and by the consumer build graph even though the external CSP browser fixture currently renders only DOCX/XLSX. Adding a new browser scenario to another repository is outside this change.

### Decision 4 — Treat publish latency as a post-change observation

Record pre/post `npm pack --dry-run --json` byte counts in the change evidence. The code change is accepted on artifact size and compatibility. Whether npm exposes the next dev version faster is observed after merge/publish and is not a deterministic automated test.

Post-publish registry polling remains a separate possible improvement because it changes CI reporting rather than package construction.

## Risks / Trade-offs

- **[Risk] A consumer bundler does not preserve or resolve external dynamic subpaths** → The supported Vite path is exercised by both the clean fixture and an additional downstream validation; the package remains ESM with bundler module resolution.
- **[Risk] Consumer production chunks grow** → The OOXML bytes already enter applications that use the viewer; ownership moves from the canvas tarball to its installed dependency, while format-level dynamic boundaries remain.
- **[Risk] CSP rewriting misses separately installed OOXML code** → Downstream browser validation covers CSP behavior with the dependency installed separately.
- **[Risk] An OOXML release changes exported subpaths** → The existing version range and lockfile remain unchanged; library and consumer builds catch missing exports before publish.
- **[Trade-off] npm scan latency may remain high** → The change removes the dominant package-size/content difference but npm scanning is external and nondeterministic; npm support remains the next escalation if a materially smaller tarball is still delayed.

## Migration Plan

1. Update the matcher and regression tests.
2. Build and test the library, then measure the packed artifact.
3. Run the isolated tarball consumer fixture.
4. Install the local tarball temporarily in the downstream validation workspace, run its production build and browser coverage, and restore its prior installed package without touching tracked manifests.
5. Publish a new development version and compare registry availability with sibling packages.

Rollback removes OOXML from the matcher and restores the previous test expectations; dependency metadata and public APIs do not require migration either way.

## Open Questions

None.

## Final Measurements

`npm pack --dry-run --json` against the publish-shaped artifact reports 53,563 bytes compressed and 200,653 bytes unpacked across 56 files. The previous artifact was 5,232,865 bytes compressed and 15,036,047 bytes unpacked, so externalization removes about 99% of the canvas package's packed and unpacked size while leaving the renderer available through its runtime dependency.

The automated ceilings are 75,000 bytes compressed and 230,000 bytes unpacked. They allow normal library growth above the measured output while remaining far below the multi-megabyte footprint produced by bundling OOXML again.
