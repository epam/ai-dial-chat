## Context

`VisualizerCanvasRenderer` (`libs/attachment-canvas`) is the only in-repo consumer of npm `@epam/ai-dial-visualizer-connector@0.48.0`. That package is roughly 250 lines of DOM code. From its dependency `@epam/ai-dial-shared@0.48.0` it uses only `Task`, `DeferredRequest`, `setStyles`, `visualizerConnectorLibName` and the two protocol enums. Both packages come from the legacy Chat `development` line. The existing `custom-visualizers` spec already describes the connector's runtime contract in detail, and this port keeps that contract.

The closest model in this repo is `libs/chat-overlay`:

- it is vanilla TypeScript with no React;
- it is tagged `publishable`;
- it builds through Vite lib mode plus `vite-plugin-dts`;
- it runs its tests under jsdom;
- it keeps its internal `Task` / `DeferredRequest` in `libs/chat-overlay/src/lib/internal/`.

## Goals / Non-Goals

**Goals**

- The workspace `@epam/ai-dial-visualizer-connector` is wire-compatible with `0.48.0` and has no runtime dependencies.
- `@epam/ai-dial-shared` is removed from the dependency tree.
- The fixes from the checklist are applied: idempotent `destroy()`, optional `hostDomain`, no console noise, timers cleared on reply.

**Non-Goals**

- Porting or republishing the iframe-side `@epam/ai-dial-chat-visualizer-connector`.
- Any protocol or sandbox change.
- Sharing `Task` / `DeferredRequest` with `libs/chat-overlay`. Their semantics differ (see D3).

## Decisions

### D1 — New lib `libs/visualizer-connector`, package name unchanged

The package keeps the name `@epam/ai-dial-visualizer-connector`, so a host that already names it does not need to rename an import. The manifest follows `libs/chat-overlay/package.json`:

- `"version": "0.0.1"`, `"private": true`, `"type": "module"`;
- an `exports` map with the `@epam/source` condition, and no `./styles.css`, because the lib ships no CSS;
- `nx.tags: ["publishable"]` and the same `publish` target.

The file layout:

- `src/index.ts`
- `src/lib/VisualizerConnector.ts`
- `src/types/visualizer-connector.ts` (the protocol enums) and `src/models/visualizer-connector.ts` (options and request types), following the repo rule that enums live in `types/` and interfaces in `models/`
- `src/lib/internal/{task,deferred-request,set-styles,default-loader}.ts`

Tests go in `src/lib/tests/VisualizerConnector.spec.ts`. Path aliases are added to `tsconfig.base.json` and the project reference to `tsconfig.json`, in the same way as for `chat-overlay`.

*Alternative:* a new name such as `@epam/ai-dial-chat-visualizer-host`. Rejected: it would force every consumer to change imports and add nothing.

### D2 — The lib owns the protocol constants, with PascalCase members

`src/types/visualizer-connector.ts` exports the following:

```ts
export enum VisualizerConnectorRequests {
  SendVisualizeData = 'SEND_VISUALIZE_DATA',
  SendGroupedVisualizeData = 'SEND_GROUPED_VISUALIZE_DATA',
  SetVisualizerOptions = 'SET_VISUALIZER_OPTIONS',
}
export enum VisualizerConnectorEvents {
  InitReady = 'INIT_READY',
  Ready = 'READY',
  ReadyToInteract = 'READY_TO_INTERACT',
  SendMessage = 'SEND_MESSAGE',
  CreatedConversationSuccess = 'CREATED_CONVERSATION_SUCCESS',
  UpdatedConversationSuccess = 'UPDATED_CONVERSATION_SUCCESS',
  UpdatedApplicationSuccess = 'UPDATED_APPLICATION_SUCCESS',
}
```

`src/models/visualizer-connector.ts` exports `VisualizerConnectorOptions`, `VisualizerConnectorRequest` (`{ type; requestId; payload? }`) and `VisualizerConnectorLoaderStyles` (a partial map of CSS declarations).

Every member that npm `0.48.0` has is kept, so the wire surface is complete. The checklist proposed putting the enums in `@epam/ai-dial-chat-shared`. That is rejected (proposal, alternative b): a zero-dependency DOM package must not peer on a React lib. The payload shapes (`CustomVisualizerData` and the grouped-payload types) stay where they live today, in `libs/chat-shared/src/models/custom-visualizer.ts` and `libs/chat-shared/src/models/application-visualizer.ts`. The connector sends `payload: unknown`, so it does not need them.

### D3 — Private `Task` / `DeferredRequest`, ported with the npm semantics

The `libs/chat-overlay` helpers behave differently from what this connector needs:

- they reject with `Error`;
- their timeout is mandatory;
- their request ids carry the `dial-overlay-` prefix.

The visualizer spec, by contrast, requires the following, and already-built visualizers rely on it:

- a send timeout that rejects with a **string** (`[VisualizerConnector] Request <type> failed. Timeout <ms>`);
- a default timeout of `10000`;
- a `ready()` that rejects with the string `'Chat Visualizer destroyed'`;
- request ids in UUID-v4 form, echoed back in `/RESPONSE`.

Both libs therefore keep their own internal copies. One small difference from npm: `DeferredRequest` clears its timeout once a reply arrives. That change cannot be observed through the public contract.

Request ids use `crypto.randomUUID()` when it exists and otherwise fall back to the npm `Math.random` template. jsdom and every supported browser provide it in a secure context.

### D4 — Behaviour deltas from npm `0.48.0`, kept minimal

| Area | npm 0.48.0 | Workspace |
| --- | --- | --- |
| Second `destroy()` | `removeChild` throws `NotFoundError` | No-op, guarded by `isDestroyed` |
| `destroy()` console output | `console.error` on every teardown, because the handshake always rejects | None. The lib attaches a silent `.catch` to its own handshake promise and leaves logging to the host |
| `hostDomain` | Required in the type, ignored at runtime | Optional and `@deprecated`, still ignored |
| Message whose `type` is outside `${visualizerName}/` | Falls through. It reaches `processEvent`, matches no prefixed subscription, and is dropped implicitly | Discarded explicitly before dispatch, as the existing spec already requires |
| Reply timer | Kept until it fires | Cleared on reply |
| How `sandbox` is applied | `iframe.sandbox.add(token)` | `setAttribute('sandbox', tokens.join(' '))`. The token set is identical, and this also works where `HTMLIFrameElement.sandbox` is not implemented (jsdom) |
| `visualizerConnectorLibName` | Exported from `@epam/ai-dial-shared` | Internal only. It appears in error strings and has no public use |

Everything else is unchanged:

- the sandbox and `allow` tokens;
- the loader markup, styles and `loaderDisplayCss` handling;
- `send()` resolving `undefined` when `destroy()` happens while the call is still waiting for the handshake;
- pending posted requests not being cancelled on destroy;
- the `source`-window-only trust check;
- `setVisualizerConnectorOptions` and `subscribe`.

The current renderer subscribes with the full prefixed type (`${visualizerName}/SEND_MESSAGE`), so the prefix filter has no effect on it.

### D5 — The `attachment-canvas` switch

- `VisualizerCanvasRenderer.tsx`:
  - imports `VisualizerConnector`, `VisualizerConnectorEvents` and `VisualizerConnectorRequests` from `@epam/ai-dial-visualizer-connector`;
  - uses the members `SendVisualizeData`, `SendGroupedVisualizeData` and `SendMessage`;
  - drops `hostDomain`;
  - replaces the migration checklist comment with a short note that names the workspace package and the open follow-up (the iframe-side port).
- `libs/attachment-canvas/package.json`:
  - `@epam/ai-dial-visualizer-connector` moves to `"*"` in `dependencies`, which is the sibling-lib rule in `.claude/rules/libs.md`; publish rewrites it;
  - `@epam/ai-dial-shared` is removed.
- `vite-external-matcher.ts` drops `@epam/ai-dial-shared` and keeps the connector external, as a sibling.
- The `vi.mock` factories in the tests rename the mocked members.

### D6 — Library isolation

The connector receives three values: `domain`, `visualizerName` and `requestTimeout`. The app resolves them from `CUSTOM_VISUALIZERS` / `APPLICATION_VISUALIZERS` (`apps/chat/src/hooks`) and hands them over in the canvas content object.

The lib does not touch env, routing, auth, i18n, contexts, storage or telemetry. It does not log either: the npm `console.error` is removed, not moved.

## Risks / Trade-offs

- **[A name collision on npm: the registry already holds `0.48.0` from the legacy line]** → For now the lib is `private: true`, like every other lib. When it is released, the `publish` target's `--version` must be greater than `0.48.0` (see Open Questions).
- **[An external TypeScript consumer imports `sendVisualizeData` from `@epam/ai-dial-shared`]** → This is called out as **BREAKING (TS only)** in the README and the proposal. The wire is identical, so runtime is unaffected.
- **[The loader overlay duplicates the renderer's own spinner overlay]** → This already happens today and is kept for parity. It is a possible follow-up, but out of scope here.
- **[`crypto.randomUUID` is missing in an insecure context]** → Fall back to the npm template.

## Migration Plan

1. Add the lib with tests, but no consumers yet.
2. Switch `attachment-canvas` and the app tests, and remove both npm pins.
3. Run `npm install` to prune the lockfile.
4. Rollback: revert the change. Both npm pins come back, and the wire is identical.

## Open Questions

- The release version for the first npm publish of the workspace package has to be greater than `0.48.0`. The release owner decides it when the lib's `private` flag is lifted. It does not block this change.
