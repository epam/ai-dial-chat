## Context

`libs/conversation-input/src/hooks/useVoiceRecorder.ts:196` currently derives an extension directly from the MIME subtype. `libs/attachment-input/src/utils/attachment.ts:228` instead normalizes MIME parameters and uses `MIME_TYPE_EXT_MAP`. `downloadAttachment` preserves an existing filename extension, exposing this mismatch on download.

## Goals / Non-Goals

Keep new recording filenames consistent with the shared attachment type labels, while preserving encoded bytes and the actual browser MIME type. Existing stored files, transport headers, UI layout, and recorder lifecycle are outside this change.

## Decisions

Use `normalizeMimeType` and `MIME_TYPE_EXT_MAP` from the already-declared `@epam/ai-dial-chat-shared` peer. Use the normalized subtype as the fallback for formats absent from the table. Normalize only for extension selection; retain the actual recorder MIME value, including codecs, on the file.

Apply this at file creation for both attachment and dictation callbacks. A download-only rename would leave storage and upload filenames inconsistent. A WebM-only special case would duplicate the table and leave the equivalent Ogg/MP4 mismatch.

Library isolation: this is pure MIME-to-extension mapping. The host still owns upload/download endpoints, configured clients, auth, and persistence. No new exports, dependencies, app knowledge, translations, feature flags, telemetry, or caching are introduced. RTL and accessibility behavior are unchanged.

## Risks / Trade-offs

- New Ogg and MP4 audio recordings also adopt the table's `.oga` and `.m4a` extensions. Parameterized regression cases verify these while preserving MIME and size.
- Existing `.webm` attachments retain their stored names. This fix applies to new recordings and does not migrate data.

## Migration Plan

Deploy the library change with the app. No API or storage migration is required. Revert the extension lookup to roll back.
