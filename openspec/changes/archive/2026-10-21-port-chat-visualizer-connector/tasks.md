## 1. Connector

- [x] 1.1 Add `AppsEditorEvents` to `libs/visualizer-connector/src/types/visualizer-connector.ts` (design D2), with JSDoc per member.
- [x] 1.2 Add `VisualizerAttachmentData`, `VisualizerGroupedAttachmentItem`, `VisualizerGroupedAttachmentsData` and `ChatVisualizerCallbacks` to `libs/visualizer-connector/src/models/visualizer-connector.ts` (design D3).
- [x] 1.3 Add `libs/visualizer-connector/src/lib/ChatVisualizerConnector.ts`, a port of npm `0.49.0` with the deltas in design D4, plus `sendReadyToSave()` / `sendLoggedOut()`. Export it, `ChatVisualizerEventType`, the new types and `AppsEditorEvents` from `src/index.ts`.
- [x] 1.4 Write `libs/visualizer-connector/src/lib/tests/ChatVisualizerConnector.spec.ts`, covering every scenario in `specs/custom-visualizers/spec.md`: no announcement on construction; `READY` / `READY_TO_INTERACT`; `readyToSave` / `loggedOut`; `AppsEditorEvents` wire values; all hosts vs one `dialHost`; `SEND_MESSAGE`; `SEND_VISUALIZE_DATA` and `SEND_GROUPED_VISUALIZE_DATA` with `/RESPONSE`; a payload missing its fields; a foreign origin; a prefix-only origin; a trailing-slash host; the wildcard; an empty host list; `destroy()` twice; no console output.
  - Verification: `npx nx test @epam/ai-dial-visualizer-connector`
- [x] 1.4a Add `AppsEditorMessages` and `AppsEditorMessage`, `sendEditorMessage()` and `onEditorMessage` (design D2), with tests: wire values; unprefixed post to all hosts and to one; `TRIGGER_SAVE` without `payload` reaches `onEditorMessage` with its origin; a foreign origin is ignored; a prefixed copy is not an editor message.
- [x] 1.4b Editor-host parity (design D4), with tests: a layout-only `SEND_VISUALIZE_DATA` reaches `onData`; own-window messages are ignored; another request with a `requestId` is acknowledged; an unsolicited message, a `/RESPONSE` and another namespace are not.
- [x] 1.5 Architecture guard: `libs/visualizer-connector/src` imports no React, i18n, env, `/api` paths, generated client, app contexts, auth, storage or logging.
  - Verification: `npx nx run-many -t lint typecheck build test -p @epam/ai-dial-visualizer-connector`

## 2. Docs

- [x] 2.1 `libs/visualizer-connector/README.md`: both halves in the overview, a `ChatVisualizerConnector` section, `AppsEditorEvents` in the enum table, the new types, and a migration note from `@epam/ai-dial-chat-visualizer-connector` `0.49.0`. Update the package `description` to match.
- [x] 2.2 Verification: `npm run validate:docs` and `npm run validate:specs`.

## 3. Follow-ups (not in this change)

- [ ] 3.1 Replace `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts` with `AppsEditorEvents` and `AppsEditorMessages` from the package.
- [ ] 3.2 Publish a `development` release, then move QuickApps and the DIAL Loop editor from `@epam/ai-dial-chat-visualizer-connector` and hand-written posts to it.
