## 1. Recording filename slice

Strategy: one vertical slice from completed capture through attachment upload, followed by documentation and verification.

- [x] 1.1 Add MIME/extension regression cases in `libs/conversation-input/src/hooks/tests/useVoiceRecorder.spec.ts` and update the mobile/desktop upload assertion in `libs/conversation-input/src/components/Input/tests/Input.recording.spec.tsx`.
- [x] 1.2 Update `libs/conversation-input/src/hooks/useVoiceRecorder.ts` to use the shared normalized MIME mapping, preserving MIME parameters, bytes, and fallback behavior. Verify that the library imports no host integration code.

Verification for 1.1 and 1.2: run both named files through the Nx conversation-input test target (equivalent file selection: `npm run test:file -- libs/conversation-input/src/hooks/tests/useVoiceRecorder.spec.ts libs/conversation-input/src/components/Input/tests/Input.recording.spec.tsx`), then run `npm run verify:changed` once.

## 2. Documentation and final verification

- [x] 2.1 Update `libs/conversation-input/README.md` and sync the new requirement into `openspec/specs/voice-recording-ui/spec.md`.
- [x] 2.2 Run `npm run validate:docs`, validate the OpenSpec change and main spec, and run `npm run verify:full` once. Record any unrelated baseline failures rather than changing their scope.

## Verification Results

- Regression tests reproduced the extension mismatch before the fix; both selected test files pass afterward (32 tests).
- `npm run validate:docs` passed.
- `npm run verify:changed` passed: affected typechecks, lint, and tests.
- `npm run verify:full` passed all typechecks and lint, then stopped at existing Prettier failures in unchanged `apps/chat-api/README.md` and `docs/observability.md`. Its full-test stage did not run; affected tests passed via `verify:changed`.
- Strict validation passed for this change and `voice-recording-ui`.
- Full OpenSpec validation passed 330 of 334 specs. Unchanged specs `applications-write-api`, `chat-hooks-conversation-stream`, `conversation-share`, and `file-manager-tabs` fail because requirement text lacks SHALL/MUST.
