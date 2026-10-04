## Context

The originating completion's catch calls `preserveUnsavedAnswer`; attach finalCheck calls `finish(undefined, hasGeneratedPayload(...))`. Both infer save failure from read failure. The original payload-retention fix remains necessary. The conversation page and application preview share the stream hook and `ConversationView`.

## Goals / Non-Goals

Goals: correct classification, retain payload, make recovery a GET, preserve race protection, cover both consumers. Non-goals: backend writes, protocol changes, browser persistence, and redesigning existing generation/persistence retry.

## Decisions

1. Keep reload errors in hook-local state keyed by conversation path and the buffered generation's identity. Expose `hasConversationReloadError`, `isReloadingConversation`, and `retryConversationReload` as additive result fields. Do not add a persisted message field or global context. A read failure does not call the stream-error logger with a fabricated persistence error.
2. Extract the initiating completion's reconciliation from lifecycle settlement so retry does not duplicate overlay or generation-lifecycle notifications. Preserve its supersession and displayed-path checks. Attach/watch finalCheck retains the buffer on a rejected read and registers itself as its retry; ownership guards apply before and after awaits.
3. Serialize retries for a failure with a synchronous in-flight guard, and expose pending state for the UI. Navigation hides notifications belonging to other paths; newer generations invalidate prior failure state. Unmount invalidates display writes. Successful ordinary reloads on revisiting a conversation accept authoritative server content rather than restoring a failed-read buffer over it.
4. Add an app-owned reload notification below the message list, passed via optional `ConversationView` props from both consumers. Reuse existing UI controls and localize all text in supported locale files. Use logical text alignment, wrapping, and a minimum 44px button target. Existing stream-error banners and regeneration actions are separate.
5. Library isolation: `chat-hooks` only calls its injected transport and exposes semantic state/actions; app-owned providers, endpoints, SDK configuration, i18n, logging, and component rendering stay in apps. No dependency, package-manifest, CSS, or generated-client change is required.
6. Effect cleanup invalidates retained read failures and their buffers, but preserves active generation ids and buffers. React StrictMode replays cleanup after the host's mount effect may have started a completion; clearing active ownership would cancel a deferred send or prevent an already-sent completion from settling. Mounted/display guards continue to prevent UI writes after a real unmount.

Alternatives: suppressing the GET error gives no recovery; changing only its text keeps the wrong action; encoding it in persisted `Message` mixes a local read outcome into stored conversation data. The hook-local state is the narrowest complete fix.

## Risks / Trade-offs

- Late GET after regeneration or navigation: retain buffer identity and path checks, with regression coverage.
- Empty placeholders and pending background jobs: use existing reconciliation, not a blanket successful-read replacement.
- The browser buffer remains ephemeral: the reload notification describes failed reading and does not claim durable saving.

## Migration Plan

Additive hook/view contract with no schema or endpoint change. Update hook/app READMEs and architecture text, sync the delta specs to main specs, validate docs, and run focused plus repository verification. Roll back the same code and specification change together.

## Open Questions

None; the user approved the previously described behavior. The existing regeneration action for real persistence errors is outside this change.
