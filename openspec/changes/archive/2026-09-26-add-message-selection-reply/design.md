## Context

The user confirmed that Reply should use the same attachment mechanism as recorded audio. `useVoiceRecorder.ts:205` creates a `File`; `Input.tsx` passes recorded files through `buildAttachments`/`addAttachments`. `useAttachments.ts:271` already consumes host-supplied `pendingDropFiles` and calls the same validation/upload path. `ConversationView.tsx:534` resolves whether the current deployment permits `text/plain`.

`ConversationMessageItem` renders the reusable `MessageBubble`, whose body is separate from attachments, actions and stage output. There is no message-selection Reply action today. `InputHandle` currently exposes only `getCaretPosition`, and `ConversationInput` does not forward that handle. Avoid relying on an existing focus method that is not present.

Existing specs have an unrelated documentation discrepancy: `conversation-input-attachments` still describes a URL-string upload result, while `attachment-send-flow` and current `useAttachments` use `{ url, name }`. This feature follows the implemented `{ url, name }` contract; correcting the older spec is a separate follow-up, not a new upload API in this change.

## Goals / Non-Goals

**Goals:** native selection in completed user/assistant message bodies; an accessible floating Reply action; exact selected text as a normal uploaded text file; preservation of the current draft; all existing attachment limits and lifecycle behavior.

**Non-Goals:** quotation metadata, automatic source links, special history rendering, editing-message integration, new API/storage formats, global selection context, or exact visual duplication of Claude's quote tile. The supplied screenshot establishes the interaction; the confirmed file approach uses DIAL's existing attachment tile.

## Decisions

### 1. Keep reusable selection mechanics in libraries and integration in the app

Export `useMessageSelectionReply` from `@epam/ai-dial-chat-hooks/conversation`, implemented in `libs/chat-hooks/src/conversation/useMessageSelectionReply/useMessageSelectionReply.ts` and mounted once by `ConversationView`. It owns the selection snapshot (text, body identity, conversation identity, cloned range and anchor rect), Reply-generated pending files, and a monotonically increasing focus-request token. It exposes stable body-registration callbacks, activation, dismissal and consumed-batch acknowledgement. It resets on conversation change/unmount and eligibility loss. Attachment state itself remains in `useAttachments`; no context or browser storage is added.

Expose an optional `contentRef?: React.Ref<HTMLDivElement>` on the message-bubble props and forward it through `MessageBubble` to the actual user/assistant text wrapper. It must exclude `beforeContent`, `afterContent`, attachment trays, stage output and action rows. The app registers those roots with the reusable selection hook. Keep existing markup behavior, collapse and markdown rendering intact.

This is preferable to querying library-private CSS classes or message-wide DOM text: those approaches can capture action labels and silently break when layout changes. The message bubble exposes only its DOM ref. The selection hook handles DOM mechanics without knowing the host conversation/deployment policy.

### 2. Snapshot native selection and render one action

Use `selectionchange` plus pointer/keyboard completion to observe a single non-collapsed range wholly inside one registered body. Reject whitespace-only text (using trim only for eligibility), selections containing only controls/hidden content, and all selections spanning bodies. Read visible text through native selection; preserve that snapshot verbatim rather than extracting Markdown source or HTML. Code/table text is eligible. Inline citations, annotations, links and decorative nodes do not invalidate a range containing message prose. A cloned fragment is checked for text outside excluded controls; native selected text is still captured verbatim, including any marker labels included by the browser. Source-body mutation invalidates the snapshot.

Render the exported `MessageSelectionReply` from `libs/conversation-messages/src/components/MessageSelectionReply/MessageSelectionReply.tsx` once in the active view. Anchor above a visible selection rect, flip below if necessary, and clamp to the visible viewport. Recompute or dismiss on scroll/resize; dismiss when no selected rect is visible. Support `visualViewport` changes for mobile keyboard/zoom. Batch geometry reads in animation frames; clean up listeners/observers and cancel pending frames.

Do not prevent native text selection, copy or touch handles. Preserve the captured selection when focus moves onto Reply (including Tab and pointer activation). Escape, pointer interaction elsewhere, a new invalid selection, source removal/change, conversation change, edit mode or loss of eligibility closes it. Consume the snapshot once, clear browser selection after activation, and avoid duplicate enqueue on repeat events. A deliberate new selection may attach the same text again.

Use a semantic button with a visible localized label and focus ring. Keyboard users can Tab from the selection to Reply and activate with Enter/Space without losing the snapshot. Touch targets are at least 44px; no hover-only behavior. Do not introduce a focus trap or `role=menu` for one button. Implementation confirmed the 2.0 `Button` and `ButtonVariant` contracts through the configured UI-kit MCP `getEntityDetails` tool. Reply uses `ButtonVariant.Neutral`, `ElementSize.Small`, a 32px desktop height (44px mobile touch target), a 16px icon and opaque `layer-raised`/`layer-base` backgrounds with primary text.

### 3. Produce an ordinary file and reuse the existing queue

On activation recheck current eligibility and create `new File([selectedText], 'reply-' + crypto.randomUUID() + '.txt', { type: 'text/plain' })` in the host-agnostic hook. No BOM, HTML, Markdown serialization, source metadata, localized prefix or automatic newline is added. The name never embeds selected text. Pass it through `pendingDropFiles`, which already accepts raw files for the normal validation/upload path; do not use `pendingAttachments`, which skips uploading because it expects uploaded attachments.

Combine Reply files with the existing `usePageFileDrag` pending batch using `useMemo`; use a stable consume callback that acknowledges only the batch delivered to the input. Preserve files queued after that batch was rendered, and never clear the independent DIAL file-picker queue. The existing host-agnostic `libs/chat-hooks/src/usePageFileDrag/usePageFileDrag.ts` now appends drops and acknowledges only the captured batch, so an earlier acknowledgement cannot discard a later drop. Guard effect replay so one activation cannot produce duplicate files/uploads under Strict Mode. If the existing consumer needs a narrow replay guard, change only that handoff and test it; do not refactor attachment state generally.

Add optional `focusRequestId?: number` to `InputProps` and the corresponding `ConversationInputProps` contract. A changed token requests textarea focus without changing its value/caret; omission preserves current behavior. The hook increments it with Reply activation; the app forwards the token to the composer. Forward it through `ConversationInput`; the library does not know about Reply. This avoids DOM-query focusing and unnecessary changes to the existing imperative handle.

The existing `onUploadAttachment`, `validateAttachment`, MIME/size/count checks, upload rate limit, stored filename conflict handling, progress, retry/removal and URL serialization are reused. An accepted ready attachment alone is sendable, just like other files. Upload/validation failure retains the ordinary error card. Count-limit rejection uses existing feedback. Successful send clears the tray; synchronous/rejected send retains it. A later stream failure follows existing conversation retry semantics, not a new draft-restoration mechanism. Removing the tile does not delete the stored file.

### 4. Derive availability at the app edge

Enable selection Reply only when the active view has an editable composer, an upload callback, a selected deployment permitting text attachments, and is not in edit mode or streaming a response. Read-only/shared views do not wire it. This conservative initial rule avoids routing files into edit inputs or mutating a draft during send. Recheck on activation, because the model or mode can change after selection. There is no new `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` key or role permission; existing attachment availability remains authoritative. Size/count errors use existing validation rather than independent limits.

### 5. Accessibility, localization and isolation

Add `chat.reply` (Reply), `chat.replyAttachmentAdded` (Text attached) and `chat.replySelectionAvailable` (Reply to selected text is available) to the app's locale keys and English resource. Additional translations are outside the requested scope; existing RTL layout support remains unchanged. Translate at the app edge with `useTranslation`. Announce action availability and accepted attachment insertion through a polite status region without reading the selected text aloud or announcing successful upload prematurely. Existing errors retain their established feedback. The hidden action is unmounted.

Use logical spacing/alignment, mirror a directional Reply icon in RTL, pass `DIAL_KIT_ICON_STROKE` and `aria-hidden` for its decorative glyph, and retain at least 7:1 text contrast. Keep layout compatible with 360/900/1280/1920px and LTR/RTL. Geometry uses viewport coordinates; it must not be naively mirrored a second time in RTL.

Follow `.claude/rules/libs.md`, `.claude/rules/lib-styling.md` and AGENTS library isolation. No generated client, REST path, deployment, auth, feature flag, i18n, persistence or telemetry knowledge enters the changed libraries. The Reply action exposes `styles.colors`, `styles.typography`, root/button classes and a same-document `portalContainer`. Colors use `buildCssVars` and a CSS module with host-token and opaque fallback values. The default portal is `document.body`; an explicit null destination defers rendering. Hosts embedding a chat in a modal dialog pass a container inside the dialog, without a transformed ancestor that changes fixed-position coordinates. `react-dom` is declared as a peer for the portal. Use extensionless relative TypeScript imports and retain bundler resolution. Memoize root callbacks, file batches and consumer callbacks to avoid unnecessary effect replay and message-feed rerenders.

The headless hook owns DOM selection and raw-file production only. The application supplies eligibility and a scope identifier; translation, configured upload callbacks and deployment policy remain at the application edge. This lets another React host compose the exported hook, action and existing composer without copying application logic. Key the composer by conversation identity so accepted attachments and late uploads are isolated alongside the hook queue.

## Risks / Trade-offs

- Native touch menus can overlap a floating action -> place the action outside the selected rect, keep it within the visual viewport, preserve native selection and keep geometry handling scoped to viewport coordinates.
- Focusing Reply can collapse browser selection -> retain the snapshot only for interaction within that action, and invalidate it for all other changes.
- Uploads introduce latency/cost for short snippets -> explicitly accepted by the user; reuse limits and error states rather than adding inline attachment semantics.
- Two pending-file sources or Strict Mode replay can duplicate uploads -> batch-specific acknowledgement and replay regression tests.
- Native selection text differs from Markdown source -> intentional; attach what the user selected as plain text, including Unicode and line breaks.
- Stale selection can cross conversation boundaries -> conversation-scoped state and identity checks immediately before file creation; in-flight upload completion must not insert into another composer.

## Migration Plan

Ship additive optional library props and app integration together. No new endpoint, OpenAPI generation, cache key/TTL, analytics event, persisted schema or migration is required. Existing upload observability applies; never log selected content. Update the app/library READMEs and `docs/technical-requirements.md` in the implementation change and run docs validation. Roll back by removing app wiring and optional props; sent text files remain valid ordinary attachments.

## Open Questions

No unresolved product decisions. Assumptions recorded for the first version: both user and assistant completed bodies are eligible; Reply is unavailable during streaming or editing; the ordinary text-file card is sufficient; unsent files follow the existing draft lifetime. The concrete 2.0 button API was confirmed through the required UI-kit MCP during implementation. The unrelated older upload-result spec discrepancy is a separate follow-up.

### Selection completion

Hide Reply while a pointer selection or Shift-based keyboard selection is active. Selection-change events may schedule reads, but must not expose the action before release. Preserve action clicks; reset gesture state on pointer cancellation, blur and listener cleanup.
