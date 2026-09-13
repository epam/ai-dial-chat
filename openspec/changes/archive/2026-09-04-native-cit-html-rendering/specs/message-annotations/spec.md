## MODIFIED Requirements

### Requirement: Annotation filtering in `useAnnotations`

`libs/quotations/src/utils/useAnnotations.ts` SHALL export a `useAnnotations` hook that:

- Accepts a `message: Message` and an `isStreaming: boolean` argument.
- When `isStreaming` is `false`, returns the full annotation list resolved via `resolveMessageAnnotations(message)` (which prefers `message.custom_content.annotations` and falls back to normalizing `message.custom_fields.annotations`).
- When `isStreaming` is `true`, returns `[]` unconditionally — every selector family, including `html_tag`, is suppressed until the message finishes streaming. (An earlier revision of this requirement let `html_tag` annotations through mid-stream; that carve-out was reverted because a `<cit>` tag split across an SSE chunk boundary can cause the HTML parser to swallow subsequently-streamed text as the tag's content — see the `citation-marker` capability's "Citation markers injected into rendered assistant message text" requirement.)
- Skips annotations that have no `body.source.attachment.url`.
- Handles `undefined` or `null` annotation items gracefully (skips them without throwing).

**i18n**: none.
**RTL**: none — hook returns data only.
**Memoisation**: the returned `annotations` array SHALL be referentially stable when the inputs have not changed (use `useMemo` keyed on `[isStreaming, message]`).

#### Scenario: Completed message returns annotations directly

- **WHEN** `useAnnotations` is called with `isStreaming: false` and a message containing two annotations
- **THEN** it returns the two `Annotation` objects immediately

#### Scenario: Annotations without source are excluded from the returned array

- **WHEN** the message contains two annotations, one with `body.source.attachment.url` and one without
- **THEN** only the annotation with a source URL is included in the returned array

#### Scenario: Undefined annotation items are skipped

- **WHEN** `message.custom_content.annotations` contains a `null` or `undefined` entry
- **THEN** `useAnnotations` returns without throwing and the nullish entry is absent from the result

#### Scenario: Streaming suppresses every selector family, including html_tag

- **WHEN** `useAnnotations` is called with `isStreaming: true` and the message's resolved annotations contain one `text_character_range` annotation and one `html_tag` annotation
- **THEN** it returns `[]`
