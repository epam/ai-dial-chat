# Spec Delta

## ADDED Requirements

### Requirement: The hook accepts an interrupted-generation message

`useConversationStream` SHALL accept an optional `generationInterruptedMessage` string, the text shown on an assistant message whose generation was lost (`generation-resume-on-refresh` "An unresolved placeholder is shown as interrupted without blocking the chat"). It SHALL default to an English sentence exported next to the persistence default, so a host that passes nothing still shows readable text. The hook SHALL read only this resolved string: it SHALL NOT import i18n, read the language, or decide the wording per host, and `libs/chat-hooks` stays free of host integration knowledge.

`apps/chat` SHALL pass the translated string wherever it mounts the hook (the conversation page and the application-editor preview chat), using the key `chat.generationInterrupted` declared in `apps/chat/src/constants/translation-keys.ts` and defined in `apps/chat/src/i18n/locales/en.json`. The `chat-hooks` README SHALL document the option and its default.

#### Scenario: Host supplies the interrupted text

- **WHEN** the hook is mounted with `generationInterruptedMessage: 'Interrupted'` and a resume finds nothing producing an unresolved placeholder
- **THEN** the message's `streamErrorMessage` is `Interrupted`

#### Scenario: Host omits the option

- **WHEN** the hook is mounted without `generationInterruptedMessage` and a resume finds nothing producing an unresolved placeholder
- **THEN** the message's `streamErrorMessage` is the English default
