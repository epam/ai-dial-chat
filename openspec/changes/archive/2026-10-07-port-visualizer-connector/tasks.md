Slicing strategy: **contract-first, then switch**. Slice 1 adds the workspace lib with its own tests and no consumers, so it can be verified on its own. Slice 2 moves `attachment-canvas` and the app tests over to it and removes the npm pins. Slice 3 updates the docs and specs.

## 1. Slice 1: workspace `libs/visualizer-connector`

- [x] 1.1 Scaffold `libs/visualizer-connector` modelled on `libs/chat-overlay`:
  - `package.json`: `@epam/ai-dial-visualizer-connector`, `0.0.1`, a `description`, `license: "Apache-2.0"`, `private: true`, `type: module`, an `exports` map with `@epam/source`, no `dependencies` or `peerDependencies`, and `nx.tags: ["publishable"]` plus the `publish` target;
  - `vite.config.mts` (lib mode, `vite-plugin-dts`, jsdom tests);
  - `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `eslint.config.mjs`.

  Add the `@epam/ai-dial-visualizer-connector/*` path to `tsconfig.base.json` and the project reference to `tsconfig.json`.
  - Verification: `npm exec nx show project @epam/ai-dial-visualizer-connector` lists `build`/`lint`/`test`/`typecheck`.
- [x] 1.2 Add the enums to `libs/visualizer-connector/src/types/visualizer-connector.ts` and the interfaces to `libs/visualizer-connector/src/models/visualizer-connector.ts`:
  - the `VisualizerConnectorRequests` and `VisualizerConnectorEvents` string enums (PascalCase members, wire values as listed in design D2);
  - `VisualizerConnectorOptions`, with `hostDomain?` optional and marked `@deprecated`;
  - `VisualizerConnectorRequest`;
  - `VisualizerConnectorLoaderStyles`;
  - `visualizerConnectorLibName`, kept internal to `VisualizerConnector.ts` (see design D4).

  Every export gets JSDoc.
- [x] 1.3 Add the internal helpers under `libs/visualizer-connector/src/lib/internal/`:
  - `task.ts`: `complete`/`fail`/`ready`, rejects with a string, settles once;
  - `deferred-request.ts`: string timeout rejection, default `10000`, UUID request id via `crypto.randomUUID` with a template fallback, `match`/`reply`/`toPostMessage`/`isReplied`, clears its timer on reply;
  - `set-styles.ts`;
  - `default-loader.ts`: the SVG copied verbatim from npm `0.48.0`.

  Use `const` arrow helpers and block comments for multi-line notes. Relative imports have no extensions.
- [x] 1.4 Add `libs/visualizer-connector/src/lib/VisualizerConnector.ts`. It is a port of the npm `0.48.0` class with the deltas from design D4:
  - an `isDestroyed` guard that makes `destroy()` idempotent;
  - a silent `.catch` on its own handshake promise, with no `console.*` calls;
  - an explicit drop of any message whose `type` does not start with `${visualizerName}/`.

  Sandbox and `allow` tokens, loader handling, `send()`/`subscribe()`/`setVisualizerConnectorOptions()` stay unchanged. Export everything public from `libs/visualizer-connector/src/index.ts`.
- [x] 1.5 Write unit tests in `libs/visualizer-connector/src/lib/tests/VisualizerConnector.spec.ts`, one test per scenario in `specs/custom-visualizers/spec.md`:
  - wire values;
  - selector root that matches nothing throws;
  - sandbox and `allow` tokens;
  - ready after handshake;
  - ready never times out (fake timers);
  - per-entry and default send timeouts;
  - reply resolves with payload;
  - wrong-source message ignored;
  - out-of-namespace message ignored;
  - unexpected origin accepted;
  - `subscribe`/unsubscribe;
  - `destroy` rejects `ready()`;
  - `destroy` settles a send that is still awaiting the handshake;
  - `destroy` is idempotent;
  - `destroy` is silent (spy on `console.error`, no unhandled rejection);
  - `hostDomain` optional.

  Use `postMessage` events dispatched with `source: iframe.contentWindow`, and use no `data-testid`.
  - Verification: `npm run test:file -- libs/visualizer-connector/src/lib/tests/VisualizerConnector.spec.ts`
- [x] 1.6 Architecture guard: confirm `libs/visualizer-connector/src` contains none of the following: React, i18n, env, `/api` paths, generated-client imports, app contexts, auth/cookies, feature flags, storage, logging or telemetry. Its only inputs are the constructor options.
  - Verification: `npm run verify:changed`

## 2. Slice 2: switch `attachment-canvas` and drop the npm packages

- [x] 2.1 In `libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx`:
  - import `VisualizerConnector`, `VisualizerConnectorEvents` and `VisualizerConnectorRequests` from `@epam/ai-dial-visualizer-connector`;
  - use `SendVisualizeData`, `SendGroupedVisualizeData` and `SendMessage`;
  - remove `hostDomain` and its comment;
  - replace the migration checklist block with a short note that names the workspace package and the remaining follow-up (the iframe-side port).
- [x] 2.2 Update the `vi.mock('@epam/ai-dial-visualizer-connector', …)` factories and the enum imports in:
  - `libs/attachment-canvas/src/components/VisualizerCanvasRenderer/tests/VisualizerCanvasRenderer.spec.tsx`, adding an assertion that the options passed in contain no `hostDomain`;
  - `libs/attachment-canvas/src/components/InlineGroupedVisualizer/tests/InlineGroupedVisualizer.spec.tsx`;
  - `libs/attachment-canvas/src/components/AttachmentCanvasBody/tests/AttachmentCanvasBody.spec.tsx`;
  - `libs/attachment-canvas/src/components/AttachmentCanvas/tests/AttachmentCanvas.spec.tsx`;
  - `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`.

  Mocks that exported camelCase enum members switch to the PascalCase members.
  - Verification: `npm run test:file -- libs/attachment-canvas/src/components/VisualizerCanvasRenderer/tests/VisualizerCanvasRenderer.spec.tsx libs/attachment-canvas/src/components/InlineGroupedVisualizer/tests/InlineGroupedVisualizer.spec.tsx libs/attachment-canvas/src/components/AttachmentCanvasBody/tests/AttachmentCanvasBody.spec.tsx libs/attachment-canvas/src/components/AttachmentCanvas/tests/AttachmentCanvas.spec.tsx apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`
- [x] 2.3 Manifests:
  - in `libs/attachment-canvas/package.json`, set `@epam/ai-dial-visualizer-connector` to `"*"` (workspace sibling) and remove `@epam/ai-dial-shared`;
  - remove both npm pins from the root `package.json`;
  - remove `@epam/ai-dial-shared` from `libs/attachment-canvas/src/utils/vite-external-matcher.ts`;
  - run `npm install` so that `package-lock.json` links the workspace lib and prunes `@epam/ai-dial-shared`;
  - run `npm run docs:install-matrix`.
  - Verification: `npm ls @epam/ai-dial-shared` is empty; `npm ls @epam/ai-dial-visualizer-connector` resolves to `libs/visualizer-connector`.
- [x] 2.4 Verification: `npm run verify:changed`, plus `npm run build:quiet`, because the bundling of `attachment-canvas` and `chat` is affected.
  - Result: `typecheck:affected`, `test:changed` and `build:quiet` pass. `lint:affected` fails only on the `@epam/ai-dial-celebrations` errors that already exist on `development` (see 4.3).

## 3. Slice 3: docs and specs

- [x] 3.1 Write `libs/visualizer-connector/README.md` in the standard lib shape:
  - H1 `@epam/ai-dial-visualizer-connector`;
  - Overview;
  - Installation, with no `styles.css`;
  - Peer Dependencies: none;
  - Classes (`VisualizerConnector`, with a compiling example);
  - Enums;
  - Types;
  - a "Migrating from npm 0.48.0" note covering the PascalCase members, the enums now coming from this package instead of `@epam/ai-dial-shared`, `hostDomain` being optional, and `destroy()` being idempotent.
- [x] 3.2 Update the peer and dependency note in `libs/attachment-canvas/README.md`, which currently cites `@epam/ai-dial-shared`.
- [x] 3.3 Add `libs/visualizer-connector` to the library tables in `docs/architecture.md`, beside `chat-overlay`.
- [x] 3.4 Check whether `.github/pull_request_template.md` lists `visualizer-connector` as a scope. If it already does, leave it.
- [x] 3.5 Verification: `npm run validate:docs` and `npm run validate:specs`.

## 4. Close

- [x] 4.1 `npm run verify:full`
  - Result: `typecheck:full` and `test:full` pass. `lint:check` fails only on `@epam/ai-dial-celebrations`, whose errors already exist on `development` (see 4.3).
- [x] 4.2 Follow-up (out of scope; record it, do not implement it): port `@epam/ai-dial-chat-visualizer-connector` (iframe side) into `libs/chat-visualizer-connector`. Use strict origin equality instead of `startsWith`, and decide the first npm release version for the workspace package, which must be greater than `0.48.0`.
- [x] 4.3 Follow-up (out of scope; these failures already exist on `development` and are not caused by this change):
  - `libs/attachment-canvas/src/components/AttachmentCanvasBody/tests/AttachmentCanvasBody.spec.tsx` › "renders plain code content when no language is set" used to fail because its `@epam/ai-dial-chat-shared` mock lacked `isSyntaxHighlightingAllowed`; it passes as of 2026-10-07, so nothing remains to follow up;
  - `npm exec nx lint @epam/ai-dial-celebrations` reports two `prettier/prettier` Tailwind class-order errors (focus-visible outline classes) in `libs/celebrations/src/new-year/components/NewYear/NewYearDecor.tsx`;
  - `npm run validate:docs` reports `@modelcontextprotocol/sdk` declared at `^1.32.1` (`attachment-canvas`, `mcp-apps`) and at `^1.29.0` (`chat-hooks`).
