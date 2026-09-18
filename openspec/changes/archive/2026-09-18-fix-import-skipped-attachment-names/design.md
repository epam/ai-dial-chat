## Context

Import collects unique skipped names for onWarning, but the queue retains only a code.

## Goals / Non-Goals

Goals: preserve names through the queue and display matching notification, tooltip, and accessible text. Non-goals: change export text, uploads, styles, publishing, or downstream versions.

## Decisions

Add optional `warningNames: string[]` to ConversationTransferJob and an optional names argument to warnJob. Import passes its unique names; retry clears warning metadata. Add a second optional names argument to jobWarningMessage, retaining code-only callbacks. The app formats names using formatTransferNameList (including the existing five-name overflow summary) and conversationImport.warningAttachmentSkipped, with conversationImport.jobWarningAttachmentSkipped as the absent/empty-name fallback.

Replacing the callback argument with a job would break consumers; an app map would duplicate state. Libraries carry only structured data: no i18n, endpoints, app context, or auth. No flags, telemetry, layout, or RTL changes. The existing focusable icon receives the same accessible text as its tooltip.

## Risks / Trade-offs

Older consumers need an updated label adapter. Retry must clear stale names.

## Migration Plan

Release shared/hooks/panel packages together through the existing process; consumers update packages and use the second callback argument. No data migration. Revert to roll back.
