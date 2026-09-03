## Why

The `conversation-input-attachments` spec and the code it describes disagree about which
number caps a message. The spec gates sending on `pasteTextThreshold` (default `4000`);
`Input` and `EditMessageInput` gate on `maxMessageLength` (default `50000`). A P1 UI bug
report (2 Sep 2026, `ui/chat/attachments/conversation-input-attachments.feature:145`)
measured the consequence: on an attachment-disabled model, messages of 4 000 and 49 999
characters send with no warning, while 50 000 is refused with "Max allowed message length
is 50000".

The two numbers are two separate rules, and the spec conflated them.
`pasteTextThreshold` is only the boundary above which pasted text becomes an attachment;
`maxMessageLength` is the cap on message length. Blocking a 4 001-character message on a
model that accepts 50 000 would remove a working scenario with no attachment fallback
available on that model, so the spec is what changes here — not the threshold.

Correcting the spec exposes a real gap it was hiding: the cap is only enforced when
`isAttachmentsEnabled` is `false`. On attachment-enabled models nothing checks length on
send and the textarea carries no `maxLength`, so a **typed** 60 000-character message is
sent silently. Paste escapes notice there only because it converts to an attachment.

## What Changes

- Rewrite the "Message length validation when attachments are disabled" requirement to
  gate on `maxMessageLength` (default `50000`) and to call
  `onMessageTooLong(length, maxMessageLength)`, matching the implementation.
- Make the send block and the `EditMessageInput` Save & Submit block **unconditional** —
  drop the `isAttachmentsEnabled === false` precondition, so the cap holds on every model.
  This is also what catches existing text plus a below-threshold paste adding up past the
  cap, which no paste-time check can see.
- Keep the paste warning conditional on `isAttachmentsEnabled === false`. When attachments
  are enabled, an over-threshold paste becomes an attachment and leaves the inline text
  untouched, while an under-threshold paste is at most `pasteTextThreshold` characters and
  can never reach the cap on its own — warning there would be spurious.
- Rename the requirement accordingly, since it no longer applies only to
  attachment-disabled models.
- Leave the "paste converts to an attachment when attachments are enabled" scenarios
  untouched — that rule is correct and stays on `pasteTextThreshold`.
- Add the test coverage whose absence let the mismatch survive: no test currently exercises
  the length gate at all.

No **BREAKING** changes. `onMessageTooLong` keeps its `(length: number, max: number)`
signature; only which value arrives as `max`, and when the callback fires, are specified
differently. Hosts already render the number they are given.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-input-attachments`: the message-length requirement changes the gate's
  threshold from `pasteTextThreshold` to `maxMessageLength` and removes its
  `isAttachmentsEnabled === false` precondition, so the cap applies on every surface
  embedding `Input` regardless of attachment support.

## Impact

- `libs/conversation-input/src/components/Input/Input.tsx` — the send gate (line 299) loses
  the `!isAttachmentsEnabled` condition. The paste warning (lines 223-227) is unchanged.
- `libs/conversation-input/src/components/EditMessageInput/EditMessageInput.tsx` — the
  Save & Submit gate (line 97) loses the same condition.
- `libs/conversation-input/src/components/Input/tests/Input.spec.tsx` and the
  `EditMessageInput` tests — new boundary coverage on attachment-enabled and
  attachment-disabled models.
- `libs/conversation-input/README.md` — the `maxMessageLength` / `pasteTextThreshold`
  paragraph must state that the cap now applies regardless of attachment support.
- Behaviour change visible to users of attachment-enabled models: a typed message at or
  above `maxMessageLength` is now refused and retained instead of being sent. Hosts pass
  neither prop today, so the effective numbers stay 4 000 and 50 000.
- No app, API, or dependency changes. `apps/chat` already wires `onMessageTooLong` to a
  notification in both `ConversationView` and `NewConversationComposer`.
