## 1. Backward-compatible library behavior

Slicing strategy: one vertical slice covering public props, tooltip selection, tests, and documentation.

- [x] 1.1 Add `emptyMessageTooltip` to `libs/conversation-input/src/models/Input.ts` and `models/ConversationInput.ts`, and resolve it using `hasSendableContent` in `components/Input/Input.tsx`. Keep the parent application unchanged and verify library isolation: no app/API/i18n/context or other host-owned imports.
- [x] 1.2 Add behavior coverage in `libs/conversation-input/src/components/Input/tests/Input.send-tooltip.spec.tsx` for empty, populated, dynamically updated, blocked, attachment-only, skill-only, and legacy callers.

### Verification

Run `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.send-tooltip.spec.tsx` and `npm run verify:changed` once after this slice.

## 2. Documentation and specification

- [x] 2.1 Update `libs/conversation-input/README.md` with the optional prop, fallback behavior, and a host usage example. Sync the delta to `openspec/specs/conversation-input-send-tooltip/spec.md`.
- [x] 2.2 Validate docs and specs, run `npm run verify:full` once, and record any unrelated baseline failures. Prepare a pg-chat integration patch for the compatible release without changing published-version pins.

### Verification

Run `npm run validate:docs`, `openspec validate add-empty-message-tooltip --strict`, and `openspec validate --specs`. Preserve existing accessibility and RTL behavior; this change introduces no layout or keyboard interactions.
