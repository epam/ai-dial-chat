# Implementation status

## Implemented behavior

The reusable selection hook is exported from `@epam/ai-dial-chat-hooks/conversation`.
It owns the transient selection snapshot and raw Reply-file queue. The application
supplies conversation identity and availability; deployment policy, localization,
configured upload and validation callbacks stay at the application edge.

`MessageSelectionReply` is exported from `conversation-messages`. It supports
color, typography and root/button class overrides with CSS variable fallbacks.
An optional same-document `portalContainer` keeps the action and live status
region inside a host modal or locally themed surface. Null defers rendering;
Tab is not intercepted while the action is absent.

Reply creates an ordinary UTF-8 text file containing the selected text verbatim,
preserves the draft and reuses the existing attachment lifecycle. Body refs exclude
message action rows and attachment trays; selections containing prose around inline
citations remain valid. Pointer/keyboard selection completion controls visibility.
The drop queue acknowledges captured batches, input processing guards effect replay,
and the composer remounts on conversation changes to isolate old uploads.

The library README includes a complete composition of the hook, message body,
Reply action, upload/validation callbacks and conversation-scoped composer.
Proposal, design and specs describe the actual library ownership. No backend,
generated client, stored schema, feature flag or telemetry change was introduced.

## Localization

Reply adds English labels only. At the user's request, no Arabic resource or
registration is added. Libraries continue to accept labels from the host, and
existing RTL layout and Unicode attachment support remain unchanged.

## Verification

- Focused component/message-bubble suite: 58 tests passed.
- ConversationView Reply integration: 11 tests passed.
- Selection hook, including absent-action Tab navigation: 15 tests passed.
- The complete Reply composition in the hook README passed a TypeScript diagnostic check.
- `npm run validate:docs` and `openspec validate message-selection-reply --type spec --strict`: passed.
- Nx lint/build for `@epam/ai-dial-chat-hooks`, `@epam/ai-dial-conversation-input`, `@epam/ai-dial-conversation-messages` and `@epam/chat`: passed. After the review fixes, lint/build for hooks and chat passed again, including dependent typechecks.
- Formatting of changed source files and `git diff --check`: passed.

## Historical full-workspace verification

The earlier implementation report recorded an unchanged formatting failure in
`apps/chat-api/README.md` during `npm run verify:full`, followed by an unrelated
`CelebrationContext.spec.tsx` failure when the complete test suite ran separately.
These historical results are not a claim about the current focused checks.
Task 3.2 remains open until the complete workspace gate is green.

The pre-existing upload-result mismatch in `conversation-input-attachments`
remains a separate documentation follow-up; this implementation uses the existing
`{ url, name }` callback contract.

## Archive status

Archived on 2026-09-26 at the user's explicit request. The archive does not imply
that the full workspace verification gate passed. Review corrections are recorded
in task group 5 without reopening or renaming the archived change.

Unrelated edits to `.claude/settings.json`,
`.claude/skills/lean-verification/SKILL.md` and `.mcp.json` are preserved.
`apps/chat-api/src/net/proxy-agent.setup.spec.ts` is unchanged.
