## Context

The library owns the live draft, attachment tray, and inline-start content. The parent chat passes Send message to `sendTooltip`; pg-chat currently passes Type a message first unconditionally. The published package consumed by pg-chat does not yet support separate text for the empty state.

## Goals / Non-Goals

Goals: let hosts opt into a distinct empty tooltip while retaining the current parent behavior and all send restrictions.

Non-goals: click-triggered validation, new composer state, app changes in this repository, new translations, or package publication.

## Decisions

Add `emptyMessageTooltip?: string` to both public prop interfaces and resolve it in `Input` using `hasSendableContent`. A nullish fallback preserves old callers and lets an explicit empty string suppress the empty-state tooltip. `ConversationInput` already forwards input props through its rest spread. `SendButton` remains presentation-only.

Use content presence rather than `canSend`: missing models, blocked uploads, and host-disabled sending do not imply an empty message. Attachments and inline-start skills count as content, consistent with existing sendability.

Keep localization in hosts. pg-chat will use `sendTooltip={t(ChatI18nKeys.SendMessage)}` and `emptyMessageTooltip={t(ChatI18nKeys.SendDisabledTooltip)}` once a compatible package is released. No app/API/context imports enter the library, and no additional hooks or memoization are needed.

## Risks / Trade-offs

- Compatibility regression: cover callers that omit the new prop with empty and populated messages.
- Stale hint: test typing, clearing, prop changes, and reset after sending against the actual component.
- Unreleased API: keep pg-chat integration as a patch until it consumes a compatible package; do not invent a registry version.

## Migration Plan

Release the library through its existing release process, update pg-chat's dependency, and apply the two-prop wiring at both composer call sites. Parent callers need no migration. Removing the new prop restores the previous behavior.

## Open Questions

None for implementation. The release version will be assigned by the existing publishing workflow.
