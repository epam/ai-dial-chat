## ADDED Requirements

### Requirement: Voice recording props on ConversationInput

`ConversationInputProps` (and the inner `InputProps`) SHALL accept three new optional props:

```ts
isTranscriptionSupported?: boolean
onUploadAudio?: (file: File, contentType: string) => Promise<string>
onTranscribeAudio?: (audioUrl: string) => Promise<string>
```

These props are host-injected. The lib MUST NOT compute `isTranscriptionSupported` internally or know about DIAL Core semantics. When all three are absent, the mic button is hidden and the voice bar is never rendered.

#### Scenario: All three props absent — no mic button

- **WHEN** `ConversationInput` is rendered without `isTranscriptionSupported`, `onUploadAudio`, or `onTranscribeAudio`
- **THEN** no mic button is rendered and no voice bar is ever shown

#### Scenario: isTranscriptionSupported true — mic button present

- **WHEN** `isTranscriptionSupported` is `true` and the callbacks are provided
- **THEN** the mic button is rendered in the action bar
