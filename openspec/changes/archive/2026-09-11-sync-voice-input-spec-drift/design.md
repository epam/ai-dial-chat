## Context

Three voice specs — `voice-recording-ui`, `voice-dictation`, `voice-transcription/spec.md` — were verified line by line against `libs/conversation-input`, `apps/chat/src/hooks/conversation` and `apps/chat-api/src/transcription`. They are accurate and need no change.

Two documents were left behind by earlier changes:

- `voice-transcription/asr-model.md` was written by `2026-06-09-voice-messages` and never revisited. Since then `2026-09-09-voice-input-transcription` split the single microphone into two entry points (action-bar Dictate → text, add-menu Record voice → attachment), and separate changes replaced `GET /api/v1/config` with `GET /api/v1/client-config`, moved the ASR fields under `config`, introduced the config registry, and moved recognition into `useTranscribeAudio`. The file reflects none of it.
- `conversation-input-shared-hooks/spec.md` documents the pre-refactor `useAudioTranscription` signature.

The practical cost is not abstract. `asr-model.md` is the only spec that appears to answer "when is the microphone visible?", and its answer speaks of one microphone. A reader following it concludes the action-bar microphone records an audio attachment and files a bug against correct code — which happened.

The planning constraint is that this change edits specs and two test fixtures only. No runtime behavior moves.

## Goals / Non-Goals

**Goals:**

- Leave exactly one authoritative statement of each fact about the ASR configuration surface and the voice entry points.
- Remove the self-contradiction where `client-config-endpoint` declares `GET /api/v1/config` removed while `asr-model.md` specifies it as live.
- Make `conversation-input-shared-hooks` describe the hook that exists.
- Delete mock fields that no longer correspond to the hook's return type.

**Non-Goals:**

- Changing any runtime behavior, endpoint, prop, or i18n key.
- Editing `voice-recording-ui`, `voice-dictation`, or `voice-transcription/spec.md` — all three were verified accurate.
- Re-litigating the two-entry-point design itself. It is specified, implemented, and covered by tests.
- Auditing spec drift outside the voice and ASR-config surface.

## Decisions

### Delete `asr-model.md` rather than repair it

Each of its seven requirements was traced to a current owner (the table in `proposal.md`). Every fact survives in `config-registry-and-env-provider`, `client-config-endpoint`, `app-config-context`, `voice-transcription/spec.md`, or `voice-dictation` — and survives there in a more accurate form, since those specs were maintained through the changes that `asr-model.md` missed.

_Alternative considered — rewrite it to the corrected config surface (env vars, client-config endpoint, AppConfigContext)._ Rejected after checking the owners: that surface is not merely also documented elsewhere, it is documented in more detail elsewhere, down to the `appId` query parameter and the provider's auth-gated fetch. Keeping a second copy recreates exactly the failure mode being fixed — AGENTS.md's rule that the same fact must not be maintained twice is what allowed this file to rot unnoticed for two changes.

_Alternative considered — leave the file and add a "superseded, see X" banner._ Rejected: a reader who greps for `isTranscriptionSupported` still lands on stale normative text, and OpenSpec has no notion of a deprecated spec that `validate` would enforce.

### Represent the deletion as seven `REMOVED` requirements, each with an explicit owner

The delta lists all seven under `## REMOVED Requirements`, and each `**Migration**` line names the capability and requirement that now carries the fact. This makes the deletion reviewable: a reviewer disagreeing with one row can check that one owner rather than re-deriving the whole file. It also leaves a durable record in the archive of where each fact went, which a bare `git rm` would not.

### `MODIFIED` for the hook requirement, not `REMOVED` + `ADDED`

`useAudioTranscription hook` keeps its name and its role; only its signature and internals changed. `MODIFIED` with the full replacement block preserves the requirement's identity across the archive. The requirement name in `conversation-input-shared-hooks` matches the existing header exactly, as `MODIFIED` requires.

### Restate the two capability flags in the hook requirement

The corrected requirement spells out `isAudioMessageSupported` and `isVoiceRecordingSupported` separately, with a scenario where they diverge (ASR configured, model without audio support). `voice-dictation` already owns this rule at the product level; repeating the flag derivation here is not a duplicate fact but the hook's own return contract, which is what this capability documents.

## Risks / Trade-offs

- **A fact lives only in `asr-model.md` and the coverage table missed it** → Each of the seven migration lines names a specific requirement in a specific spec; verification is reading those seven. The spec-review task makes this an explicit step rather than an assumption.
- **`openspec archive` may leave an empty `asr-model.md` rather than deleting the file** → The tasks include an explicit check after archiving, and delete the file directly if a stub remains. The delta is the record of intent either way; the file's disappearance is a mechanical follow-up, not a semantic one.
- **Removing mock fields could hide a real gap if a test asserted on them** → Both fixtures only spread the mock into a `vi.mock` return; neither asserts on `handleUploadAudio` or `isTranscriptionSupported`. The affected suites are run as part of the change to confirm.
- **Deleting a spec file loses its git-blame trail for readers who look there first** → Accepted. The archived change carries the full removal rationale, and `client-config-endpoint` already models this pattern with its explicit "GET /api/v1/config is removed" requirement.

## Migration Plan

No deployment step. The change is spec text plus two test fixtures; rollback is `git revert`.

## Open Questions

- ~~Does `openspec archive` delete a spec file when every requirement in it is removed, or leave an empty document?~~ **Moot.** Task 2.1 deleted `asr-model.md` directly, so the archive ran with `--skip-specs` and never had a spec file to reconcile. The question stands unanswered for a future change that leaves the deletion to the archive step.
