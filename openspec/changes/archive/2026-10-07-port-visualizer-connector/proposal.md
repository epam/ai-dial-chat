## Why

The host side of the custom-visualizer protocol lives outside this monorepo: `libs/attachment-canvas` depends on the npm packages `@epam/ai-dial-visualizer-connector` and `@epam/ai-dial-shared` at `0.48.0`, both shipped from the legacy Chat `development` line. That means fixes we already know we need, like an idempotent `destroy()` and an optional `hostDomain`, can only land through the old release line, and `@epam/ai-dial-shared` stays in the tree for one enum. The porting checklist in `libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx` already plans this move. This change carries it out for the host-side package only.

## What Changes

- Add a new workspace lib `libs/visualizer-connector`, published as `@epam/ai-dial-visualizer-connector`. It is vanilla TypeScript with no runtime dependencies. It contains:
  - a `VisualizerConnector` class with the same public surface and the same wire behaviour as npm `0.48.0`;
  - the protocol constants `VisualizerConnectorRequests` and `VisualizerConnectorEvents`, renamed to PascalCase members (`SendVisualizeData`, `ReadyToInteract`, …) while keeping the wire strings exactly as they are (`SEND_VISUALIZE_DATA`, `READY_TO_INTERACT`, …);
  - the internal helpers (`Task`, `DeferredRequest`, `setStyles`) that npm currently pulls from `@epam/ai-dial-shared`.
- Fixes carried forward from the checklist:
  - `destroy()` becomes idempotent. A second call does nothing; in npm `0.48.0` it can throw from `removeChild`.
  - `VisualizerConnectorOptions.hostDomain` becomes optional and is marked deprecated. It was never read at runtime.
  - `destroy()` no longer calls `console.error` on every teardown. It quietly handles its own handshake rejection.
  - The reply timeout is cleared once a reply arrives, so no timer is left running.
  - Messages whose `type` does not start with `${visualizerName}/` are dropped. The current spec already requires this; npm only drops them implicitly.
- `libs/attachment-canvas`:
  - `VisualizerCanvasRenderer` imports the connector and both enums from the workspace package and stops passing `hostDomain`.
  - The `@epam/ai-dial-shared` dependency is removed. The `@epam/ai-dial-visualizer-connector` dependency changes from `0.48.0` to the workspace sibling.
  - Its Vite external list drops `@epam/ai-dial-shared`.
- The root `package.json` no longer pins either npm package, and `package-lock.json` is regenerated.
- **BREAKING (TypeScript only, for anyone outside this repo who imports the connector):**
  - The enum members are renamed (`sendVisualizeData` → `SendVisualizeData`).
  - The enums now come from `@epam/ai-dial-visualizer-connector` instead of `@epam/ai-dial-shared`.
  - Wire values do not change, so visualizers that are already deployed keep working unchanged.

**Non-goals**

- Porting `@epam/ai-dial-chat-visualizer-connector` (the iframe side) or republishing it. Third-party authors keep using the npm package.
- Any change to the protocol, the sandbox token set, the loader, or handshake and timeout semantics.
- Auth forwarding, locale or `dir` propagation, and the other deferred features.
- Deciding the npm release version for the new package (see design Open Questions).

**Alternatives considered**

- (a) Keep consuming npm, which is the conservative baseline. Rejected: the checklist fixes stay blocked on the legacy line, and a one-enum dependency stays in the tree.
- (b) Put the protocol enums in `libs/chat-shared`, as the checklist suggested. Rejected: it would make a zero-dependency vanilla DOM package peer-depend on a React lib. The iframe-side package will also need these constants later, and it must not pull in React.
- (c) Port the code but keep the camelCase member names. Rejected: the repo's string-enum convention is PascalCase, and the rename is the checklist's explicit step 3.
- Picked: a new self-contained lib modelled on `libs/chat-overlay`, which is already a vanilla postMessage host with its own `libs/chat-overlay/src/lib/internal/task.ts` and `deferred-request.ts`.

## Capabilities

### New Capabilities

<!-- none — the connector contract is already specified by `custom-visualizers` -->

### Modified Capabilities

- `custom-visualizers`: the "postMessage protocol constants" and "`VisualizerConnector` host-side manager class" requirements change. They now specify:
  - the workspace package and where it lives;
  - PascalCase members with unchanged wire values;
  - `hostDomain` as optional;
  - `destroy()` as idempotent;
  - that the package has no runtime dependencies.
- `canvas`: the "`VisualizerCanvasRenderer` component" requirement now imports from the workspace package and no longer passes `hostDomain`.

## Impact

- **Code:**
  - new `libs/visualizer-connector/**`;
  - `libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx` and its spec;
  - the `vi.mock('@epam/ai-dial-visualizer-connector')` sites in `libs/attachment-canvas` tests and in `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`;
  - `libs/attachment-canvas/src/utils/vite-external-matcher.ts`.
- **Manifests:**
  - the root `package.json` and `package-lock.json`;
  - `libs/attachment-canvas/package.json`;
  - `tsconfig.base.json` paths and the `tsconfig.json` references;
  - `docs/host-install-matrix.md`, regenerated.
- **Docs:**
  - a new `libs/visualizer-connector/README.md`;
  - `libs/attachment-canvas/README.md` (its peer and dependency note);
  - `docs/architecture.md` (library table: a new lib);
  - `openspec/specs/custom-visualizers/spec.md` and `openspec/specs/canvas/spec.md`, via deltas.
- **Library isolation:**
  - The new lib knows only the iframe URL, the protocol name and the timeout. The app supplies all three through the canvas content object, as it does today: `content.url`, `content.visualizerName` and `content.requestTimeout`, resolved from `CUSTOM_VISUALIZERS` / `APPLICATION_VISUALIZERS` at the app edge.
  - The lib does not read env, contexts, i18n or auth, and does no logging.
- **i18n:** none. The lib renders no user-visible strings. Its built-in loader is an SVG with no text.
- **Rollback:** revert the change and restore the two `0.48.0` pins. The wire protocol is identical, so no visualizer deployment is affected either way.

**Acceptance criteria**

- `libs/visualizer-connector` builds, lints, typechecks, and has unit tests covering every scenario in the `custom-visualizers` delta.
- `npm ls @epam/ai-dial-shared` lists no entry under this workspace.
- The existing `VisualizerCanvasRenderer` tests, the `InlineGroupedVisualizer` tests and the `AttachmentCanvas` tests pass unchanged, apart from the import and member renames.
- `npm run validate:docs`, `npm run validate:specs` and `npm run verify:full` pass.
