## Context

`libs/conversation-input` caps message text with two independent numbers, and the
`conversation-input-attachments` spec merged them into one rule.

Current implementation:

| Location | Condition | Threshold |
| --- | --- | --- |
| `Input.tsx:299` — send | `!isAttachmentsEnabled && length >= maxMessageLength` | `50000` |
| `Input.tsx:223-227` — paste warning | `!isAttachmentsEnabled && pasted >= maxMessageLength` | `50000` |
| `EditMessageInput.tsx:97` — Save & Submit | `!isAttachmentsEnabled && length >= maxMessageLength` | `50000` |
| `Input.tsx:218` — paste to attachment | `isAttachmentsEnabled ? pasteTextThreshold : Infinity` | `4000` |

`apps/chat` passes neither `maxMessageLength` nor `pasteTextThreshold`, so both library
defaults apply. `useClipboardPaste` converts on `text.length > threshold` (strictly
greater), which is why 4 001 characters becomes an attachment while 4 000 stays inline.
There is no `maxLength` on the textarea (`Input.tsx:380-400`) and no test anywhere
exercises the length gate.

The spec instead states the gate fires at `pasteTextThreshold`, which produced the P1
report. The product decision is that the spec is wrong: the two numbers stay two rules.

## Goals / Non-Goals

**Goals:**

- Bring the spec in line with `maxMessageLength` as the message cap.
- Enforce the cap on every model, not only on attachment-disabled ones.
- Add the boundary coverage whose absence hid the mismatch.

**Non-Goals:**

- Changing either default (`4000` / `50000`) or making the app pass its own values.
- Changing the paste-to-attachment rule or its threshold.
- Adding `maxLength` to the textarea, live character counters, or truncation on paste.
- Making `apps/chat` derive a per-model limit from deployment metadata.

## Decisions

**Keep `maxMessageLength` as the gate threshold rather than moving the gate to
`pasteTextThreshold`.** The alternative — following the spec as written — would refuse a
4 001-character message on a model that accepts 50 000, with no attachment fallback
available on exactly the models where the rule applies. That removes a working scenario to
satisfy a number whose purpose is paste ergonomics. The two properties keep separate
meanings: `pasteTextThreshold` is where pasted text becomes an attachment,
`maxMessageLength` is the cap on text length.

**Drop `!isAttachmentsEnabled` from the send and Save & Submit gates.** Length is a
property of the message, not of the model's attachment support, so conditioning the cap on
attachments has no justification — and it leaves the cap unenforced on attachment-enabled
models for typed input. The alternative, adding `maxLength` to the textarea, was rejected:
it silently truncates at the cap with no feedback, and clipboard and IME input interact
with it inconsistently across browsers. Gating at send keeps the text and lets the host
explain why.

**Keep the paste warning conditional on `isAttachmentsEnabled === false`.** Making it
unconditional looks symmetrical and is wrong: with attachments enabled an over-threshold
paste is converted to an attachment and never reaches the textarea, so a warning would fire
about text the user did not end up pasting inline. An under-threshold paste is at most
`pasteTextThreshold` (4 000) characters and cannot reach the cap by itself. The genuinely
uncovered case — existing text plus a small paste crossing the cap — cannot be detected
from the pasted string's length at all; the send-time gate is what catches it.

**Do not renumber or renegotiate `onMessageTooLong`'s signature.** It stays
`(length: number, max: number)`. Only which value arrives as `max` changes in the spec's
description, and it already was `maxMessageLength` in the code, so no host changes.

## Risks / Trade-offs

**A typed message at or above 50 000 characters on an attachment-enabled model is now
refused where it previously went out silently.** → This is the intended fix. The cap is
already the app's declared limit and the notification text ("Max allowed message length is
50000") already names it, so the behaviour becomes consistent with what users are told
rather than newly restrictive in spirit. Nothing in the repo sends messages that long
programmatically.

**Existing text plus a below-threshold paste still gives no feedback at paste time.** →
Accepted. The send gate refuses it and retains the text; a paste-time check would need to
measure the prospective merged length, which is a larger change than this correction
warrants and belongs to a character-counter feature.

**Renaming the requirement risks losing history if the delta's `MODIFIED` header and the
`RENAMED` mapping disagree.** → The delta uses the new name in `MODIFIED Requirements` and
declares `FROM`/`TO` in `RENAMED Requirements`, matching the pattern already archived in
`2026-08-25-redesign-settings-usage-period-columns`.

## Migration Plan

None required — a library behaviour fix with no data, API, or configuration change. Rollback
is reverting the commit; no state persists.
