## 1. First vertical slice: selected text to uploaded file

Strategy: vertical. Complete selection -> Reply -> file -> existing upload -> send before widening lifecycle and input-method coverage. Tasks within a slice depend on preceding tasks unless explicitly stated. All TypeScript changes use extensionless relative code imports and preserve frontend bundler resolution. Use the existing `npm run test:file` wrapper for focused Nx-backed tests. No backend or generated-client changes are planned.

- [x] 1.1 Add the narrow library contracts: `contentRef` in `libs/conversation-messages/src/models/message-bubble.ts`, forwarded by `MessageBubble.tsx`, `UserMessageBubble.tsx` and `AssistantMessageBubble.tsx` in `libs/conversation-messages/src/components/MessageBubble/`; add `focusRequestId` to `libs/conversation-input/src/models/Input.ts` and `models/ConversationInput.ts`, implementing/forwarding it in `components/Input/Input.tsx` and `components/ConversationInput/ConversationInput.tsx`. Keep defaults unchanged and export any newly public types. The Reply action supports colors/typography/class overrides and a same-document portal container. Architecture guard: DOM refs, focus requests and host-agnostic selection/file mechanics enter libs; no API paths/clients, server-api, app contexts, auth/session/cookies/env, flags, routes, storage, telemetry/logging, deployment details, SDK setup or platform bridges. Follow library styling/package rules; the action portal declares `react-dom` as a peer dependency.

  ### Verification

  Run `npm run test:file -- libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.spec.tsx` for body-only roots and unchanged callers; `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.spec.tsx` for focus without text/caret mutation; `npm run test:file -- libs/conversation-input/src/components/ConversationInput/ConversationInput.spec.tsx` for prop forwarding.

- [x] 1.2 Add `libs/chat-hooks/src/conversation/useMessageSelectionReply/useMessageSelectionReply.ts` and `libs/conversation-messages/src/components/MessageSelectionReply/MessageSelectionReply.tsx`; wire body registration, the action, app-owned availability, raw-file queue merging and focus requests through `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` and `ConversationView.tsx`. Create exact UTF-8 `reply-<uuid>.txt` files; preserve draft/files and route them through `pendingDropFiles` and existing upload/validation callbacks. Resolve the 2.0 UI-kit control through `searchEntity`/`getEntityDetails` before coding its props; do not inspect kit files for component discovery. Keep the button's English strings at the app edge as task 1.3 specifies.

  ### Verification

  Create/run `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.reply.spec.tsx` to exercise native-selection snapshot -> Reply -> real input attachment processing -> mocked upload -> outgoing URL, including a pre-existing draft and attachment. Run `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx` for body registration and existing rendering.

- [x] 1.3 Add `chat.reply`, `chat.replySelectionAvailable` and `chat.replyAttachmentAdded` to `apps/chat/src/i18n/locales/en.json` only; use the app's established locale-key convention and `useTranslation` in the new action/integration. Reuse existing retry/remove/error strings. Announce selection action availability and accepted attachment insertion with a polite status region; never announce uploaded success before it occurs or read the selected content. Depends on 1.2.

  ### Verification

  Create/run `npm run test:file -- libs/conversation-messages/src/components/MessageSelectionReply/tests/MessageSelectionReply.spec.tsx` for translated visible/accessibility labels, status feedback and button activation. Run `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.reply.spec.tsx` to ensure rejected insertion does not announce success.

- [x] 1.4 Add dedicated unit coverage for the new selection/queue hook and every extracted helper, co-located at `libs/chat-hooks/src/conversation/useMessageSelectionReply/tests/useMessageSelectionReply.spec.tsx` (keep simple file construction inside the hook unless extraction is justified). Cover user and assistant bodies, Markdown/code/table visible text, blank and cross-body selections, excluded controls, exact Arabic/emoji/multiline bytes, single activation, repeated deliberate selection and model/composer gating. Test names describe behavior; use role/label/text queries for UI assertions.

  ### Verification

  Run `npm run test:file -- libs/chat-hooks/src/conversation/useMessageSelectionReply/tests/useMessageSelectionReply.spec.tsx` and the slice's `ConversationView.reply.spec.tsx`. Run `npm run verify:changed` once when tasks 1.1-1.4 pass.

## 2. Second vertical slice: lifecycle, keyboard, touch and RTL

Depends on slice 1. Widen the same end-to-end flow without adding another attachment state store.

- [x] 2.1 Harden `useMessageSelectionReply.ts`, `ConversationView.tsx` and the Reply component for captured-selection focus transitions, Escape/outside dismissal, body mutation/removal, scrolling/resizing, conversation switch, edit/stream state changes and current-model rechecks. Implement batch-specific acknowledgement that preserves newly queued Reply/drop files and the independent DIAL picker batch. If necessary, narrowly guard replay in `libs/conversation-input/src/hooks/useAttachments.ts`; preserve its host-agnostic raw-file contract. Keep cleanup complete and old upload results isolated from a new conversation.

  ### Verification

  Run `npm run test:file -- libs/chat-hooks/src/conversation/useMessageSelectionReply/tests/useMessageSelectionReply.spec.tsx` for invalidation/listener cleanup and batch races; `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.reply.spec.tsx` for Strict Mode replay, navigation, MIME/size/count rejection, offline failure, retry/removal and send rejection; `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.spec.tsx` for upload blocking and file-only send. Run `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.voice.spec.tsx` and `npm run test:file -- libs/chat-hooks/src/conversation/useConversationHandlers/tests/attachment-to-dto.spec.ts` as focused regressions.

- [x] 2.2 Implement the dedicated responsive/RTL/a11y pass in `MessageSelectionReply.tsx`: logical spacing, RTL arrow mirroring, `DIAL_KIT_ICON_STROKE`, decorative-icon hiding, visible focus, at least 7:1 text contrast, 44px touch targets and viewport clamping. Ensure Tab reaches Reply with its snapshot intact, Enter/Space activates, Escape dismisses, and dismissed UI has no focusable descendants. Preserve native touch selection/copy; use existing app breakpoint hooks only if JS branching is necessary.

  ### Verification

  Run `npm run test:file -- libs/conversation-messages/src/components/MessageSelectionReply/tests/MessageSelectionReply.spec.tsx` and `npm run test:file -- libs/chat-hooks/src/conversation/useMessageSelectionReply/tests/useMessageSelectionReply.spec.tsx`. Cover portal routing, accessible labels and activation in the component unit suite. Run `npm run verify:changed` once after tasks 2.1-2.2 pass.

## 3. Documentation and final verification

Depends on slices 1 and 2. This change introduces optional public props but no new architectural module/provider or cross-cutting mechanism.

- [x] 3.1 Update `libs/conversation-messages/README.md` and `libs/conversation-input/README.md` for the new optional props, and `apps/chat/README.md` plus `docs/technical-requirements.md` FR-1/FR-2 for selection Reply, normal `.txt` upload, availability and error behavior. Keep API examples aligned with actual exports/required props. Verify no architecture-map trigger was introduced; if implementation expands into a new context or module boundary, update `docs/architecture.md` in the same change. Record the pre-existing `conversation-input-attachments` upload-result discrepancy as a separate follow-up item, without repairing unrelated specs here.

  ### Verification

  Run `npm run validate:docs` (required for READMEs/public API). Cross-check examples against the contracts exercised by `npm run test:file -- libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.spec.tsx` and `npm run test:file -- libs/conversation-input/src/components/ConversationInput/ConversationInput.spec.tsx`; do not rerun already-passing tests solely for prose edits.

- [ ] 3.2 Complete the change with the required verification and confirm the diff is confined to Reply, its optional library integration, tests and affected docs. Preserve unrelated working-tree changes and leave `apps/chat-api/src/net/proxy-agent.setup.spec.ts` untouched. Confirm no new REST/client/schema, feature key, analytics event or host knowledge in libs was introduced.

  ### Verification

  Run `npm run build:quiet` because public library contracts and the app UI bundle changed, then exactly one `npm run verify:full`. Record the focused Vitest results from `libs/chat-hooks/src/conversation/useMessageSelectionReply/tests/useMessageSelectionReply.spec.tsx`, `libs/conversation-messages/src/components/MessageSelectionReply/tests/MessageSelectionReply.spec.tsx` and `apps/chat/src/components/ConversationView/tests/ConversationView.reply.spec.tsx`, plus the docs checks; rerun focused files with `npm run test:file -- <path>` only if a final code change warrants it. Do not add manual testing tasks or mark implementation complete on planning-artifact validation alone.

## 4. Requested interaction refinements

- [x] 4.1 Make Reply compact on desktop and opaque in normal/hover states; allow prose selections spanning citations, annotations and other inline controls while rejecting control-only selections. Update selection unit tests and the documented selection contract.

  ### Verification

  Run focused selection/component/ConversationView tests through `npm run test:file`, app lint/typecheck and `npm run validate:docs`. Preserve the prior full-gate findings; this refinement does not close the change.

- [x] 4.2 Defer Reply until selection completion on every pointer/keyboard gesture; recover after cancellation/blur. Verify the hook and ConversationView focused tests, app lint/typecheck and docs validation.

## 5. Review fixes

- [x] 5.1 Expose Reply color, typography and class overrides with CSS variable fallbacks; export all public types. Accept a same-document portal container, including null while the host destination mounts. Verify portal routing and lifecycle in the component unit suite.
- [x] 5.2 Document a complete host composition with required message props, the action, upload/validation callbacks, attachment announcements and conversation-scoped composer lifetime. Align proposal/design/spec ownership with library exports.
- [x] 5.3 Verify the corrected import ordering, component and integration suites, affected library/app lint and builds, and documentation contracts.
