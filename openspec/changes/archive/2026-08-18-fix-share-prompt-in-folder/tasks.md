## 1. Fix resource path encoding

- [x] 1.1 Update `toPromptResourceUrl` in `apps/chat-api/src/prompts/utils/prompt-mapper.util.ts` to percent-encode `promptPath` via `encodeDialResourcePath` (`apps/chat-api/src/common/utils/encode-dial-path.ts`) before building the resource URL.
- [x] 1.2 Verify `ShareService.createShareLink` (`apps/chat-api/src/share/share.service.ts`) requires no changes now that `toPromptResourceUrl` encodes internally; update the call site only if encoding needs to happen before `toPromptResourceUrl` is invoked.

## 2. Tests

- [x] 2.1 Add a unit test for `toPromptResourceUrl` (or the module containing it) asserting a multi-segment path with a space (e.g. `New folder 1/Prompt 1`) is percent-encoded segment-by-segment in the returned URL.
- [x] 2.2 Add a test in `apps/chat-api/src/share/tests/share.service.spec.ts` asserting `createShareLink` with `resourceKind: "prompt"` and a nested `itemId` sends a percent-encoded resource path to DIAL Core (e.g. `prompts/{bucket}/New%20folder%201/Prompt%201`) and returns 201 instead of surfacing a 400.
- [x] 2.3 Run `npm exec nx test chat-api` and confirm the new and existing tests pass.

## 3. Verification

- [x] 3.1 Run `npm exec nx lint chat-api` to confirm no lint regressions.
- [x] 3.2 Manually verify (or via the new test) that sharing a root-level prompt still works unchanged (no double-encoding regression).
