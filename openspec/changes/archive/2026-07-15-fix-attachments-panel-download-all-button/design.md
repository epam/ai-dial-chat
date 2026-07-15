## Context

The conversation sources panel (`libs/source-panel`, host-rendered by `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`) lists a conversation's uploaded and generated attachments, plus quoted sources. When the panel has content, it renders a top-right "Download all" `DialGhostIconButton` (icon `IconDownload`, `aria-label` from `labels.downloadAllLabel`). Today that button is `disabled` unconditionally with no `onClick` — a stub that was never wired up (`libs/source-panel/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`).

Per-attachment download already works: clicking an individual `AttachmentCard` calls `onAttachmentClick`, which the app wires to `useAttachmentAction().handleAttachmentClick` (`apps/chat/src/hooks/attachment/useAttachmentAction.ts`). For DIAL-hosted files it resolves a download URL via `resolveDialFileDownloadUrl` (`apps/chat/src/utils/dial-file.ts`) and triggers a browser download via `triggerAnchorDownload` (`libs/chat-shared/src/utils/file-download.ts`). Non-DIAL / reference-only attachments are not downloadable and are routed to a viewer instead.

`libs/source-panel` must stay host-agnostic per the library isolation rule: it cannot know about `/api/v1/files/download`, DIAL file IDs, or anchor-based downloads. All of that stays in the app; the lib only exposes a callback slot.

## Goals / Non-Goals

**Goals:**

- Make the Download-all button functional: clicking it downloads every currently-downloadable attachment shown in the panel (`uploaded` + `generated`).
- Keep the button disabled only when there is nothing downloadable, mirroring the panel's existing empty-state logic instead of a hardcoded literal.
- Reuse the exact same per-file download mechanism already used for individual attachment clicks, so behavior (URL resolution, filename, DIAL-only gating) stays consistent between the two entry points.
- Preserve `libs/source-panel` isolation: the lib only gains a generic `onDownloadAll?: () => void` prop; it does not gain any knowledge of file URLs, DIAL, or the download transport.

**Non-Goals:**

- No zip/archive bundling of multiple files into one download (out of scope for this bug fix; `apps/chat/src/utils/zip-export.ts` builds a different, conversation-export-specific archive format and is not reused here).
- No change to which attachments are considered "downloadable" beyond what `handleAttachmentClick` already does today (DIAL-hosted files only).
- No change to the Search button, which remains a separate, already-tracked disabled stub.

## Decisions

**1. Sequential per-file downloads via the existing single-file mechanism, not a new bulk API or zip.**
The simplest fix that matches the reported bug ("button should be active and allow downloading files") is to trigger the same `resolveDialFileDownloadUrl` + `triggerAnchorDownload` flow once per downloadable attachment. This avoids introducing new backend surface, new archive-format code, or duplicate download logic. Alternative considered: build a zip via `fflate` (as `zip-export.ts` does for full conversation export) — rejected as scope creep for a bug fix; it also changes user expectations (one file vs. an archive) beyond what the issue asks for.

**2. Extract a reusable `downloadAttachment(attachment)` function out of `useAttachmentAction`'s click branch, then call it in a loop for "download all".**
`handleAttachmentClick` currently mixes "download if DIAL-hosted" with "open viewer otherwise" in one branch. The design factors the download-only branch into its own function so both the single-click path and the new download-all path call one piece of logic — avoiding duplicated URL-resolution code. Alternative considered: duplicate the URL-resolution snippet inline in the new handler — rejected, violates DRY and risks the two paths drifting.

**3. `onDownloadAll` prop added to `ConversationSourcesPanelProps`; lib computes `disabled` from the prop's presence, not from re-deriving attachment counts.**
`disabled={!onDownloadAll}` keeps the lib's job simple (render a button, wire a callback) and pushes the "is there anything downloadable" decision to the app, which already owns `uploaded`/`generated` and already computes `isEmpty`. The app passes `onDownloadAll={hasDownloadable ? handleDownloadAll : undefined}`, where `hasDownloadable` checks whether at least one of `uploaded`/`generated` has a DIAL-hosted URL. Alternative considered: pass raw attachment arrays into the lib so it can decide "empty" itself — rejected, that duplicates the isEmpty logic already in the app and risks the two disagreeing.

**4. Sequential triggering with a small stagger, not `Promise.all`.**
Multiple simultaneous `<a download>` clicks in quick succession can be silently blocked by some browsers' popup/download-throttling heuristics. The existing single-download flow doesn't need this since it's one user click at a time; "download all" fires N downloads programmatically, so the app-level handler triggers them with a minimal delay between each (e.g. via sequential `await` + a short `setTimeout`), matching a common browser-safe pattern for multi-file download triggers.

## Risks / Trade-offs

- **[Risk] Many attachments (10+) could still hit a browser's simultaneous-download limit or trigger a "this site is trying to download multiple files" permission prompt, even with staggering.** → Mitigation: out of scope to fully solve here (would require the zip approach explicitly excluded above); staggering reduces but doesn't eliminate this. Acceptable for this bug-fix scope since the reported issue is "button does nothing," not "too many files fail."
- **[Risk] Reference-only / non-DIAL attachments are silently skipped by "download all," which could look like a partial failure to the user.** → Mitigation: this mirrors existing single-click behavior exactly (those attachments already aren't downloadable one at a time), so no new inconsistency is introduced. No additional error UI is added since none exists for the single-click case today.

## Migration Plan

No data migration. Purely a client-side prop/behavior change gated behind existing component boundaries; ships as a normal frontend release. Rollback is a plain revert of the touched files.
