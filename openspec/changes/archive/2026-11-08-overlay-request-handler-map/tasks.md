Branch: `refactor/attachment-content-type-registry` (PR #9783, shared with F7), in the worktree `C:/projects/wt-f7`. Its `node_modules` overlays the main checkout's and points `@epam/*` at the worktree's own libs.

## 1. Characterization

- [x] 1.1 Add specs to `OverlayContext.spec.tsx` for the request paths it did not cover yet, and run them against the unchanged provider:
  - `SET_INPUT_CONTENT`, `SET_SYSTEM_PROMPT` and `SET_TEMPERATURE` forwarding and response;
  - malformed payloads for those three, and for `CREATE_CONVERSATION`, `DELETE_CONVERSATION`, `RENAME_CONVERSATION` and `SELECT_CONVERSATION`, checking the error code and message;
  - synchronous throws from both bridges;
  - `CREATE_CONVERSATION` without a payload.

  Result: 69 of 69 pass on the old code.

## 2. Extract

- [x] 2.1 Move the bridge interfaces to `overlay/bridges.ts` (design D4). Move the payload guards to `handlers/payload-guards.ts` and the pending-request helpers to `handlers/pending-requests.ts`.
- [x] 2.2 Add `handlers/request-routes.ts` (D1) and `handlers/bridge-request-handlers.ts` (D2).
- [x] 2.3 Rewrite `OverlayContext.tsx`:
  - the listener uses `getOverlayRequestRoute`;
  - both bridge paths call `ACTIVE_CONVERSATION_HANDLERS` / `CONVERSATION_LIST_HANDLERS` through one `respondFromBridge`;
  - the request-type sets, both switches and the duplicated respond block are removed.

  Result: 1058 → 745 lines. `OverlayContext.spec.tsx` passes unedited (69 of 69), apart from the import of `ConversationListBridge`.

## 3. Close

- [x] 3.1 Exhaustiveness: deleting the `CREATE_LOCAL_CONVERSATION` route made `tsc` fail on the `satisfies` table. Deleting the `SET_TEMPERATURE` handler made it fail on the missing table key. Both edits were reverted.
- [x] 3.2 `nx run @epam/chat:typecheck` passes. It caught two bridge-hook specs that imported the bridge types from `OverlayContext`; they now import from `bridges.ts`. `nx lint` passes for `@epam/chat`, and the full `@epam/chat` test run passes.
- [x] 3.3 Update `docs/architecture.md`'s `context/overlay/` source-tree line. Run `validate:docs`, `validate:specs` and `openspec validate overlay-request-handler-map`.
