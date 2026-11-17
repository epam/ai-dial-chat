## Context

`ConversationStreamingService.streamCompletion` runs one foreground or background completion:

1. it registers a lease with `ConversationGenerationService`;
2. under a preparation deadline it checks the hidden model, resolves the generation API, reads the conversation and builds the history;
3. a background completion is handed to `BackgroundGenerationService`;
4. a foreground completion writes the start state with its marker, opens the relay, re-reads the conversation every 10 s for a stop request, and writes the terminal state on completion, stop, abort or error.

Before this change all of it lived in one generator of about 400 lines, with the deadline and marker helpers as private methods of the same 1185-line class.

## Goals / Non-Goals

**Goals**
- Each phase is a named method or collaborator that can be read without the others.
- Call sites name the arguments they pass.
- Behavior stays identical. `conversation-streaming.service.spec.ts` passes with only its call helper rewritten.

**Non-Goals**
- No change to the generation registry, the adapters or the background path.
- The `streamCompletion` spec is not split into per-collaborator specs; the collaborators are tested through the service, as before.
- The 500-line and 120-line targets of the plan are not met in full: the service is 816 lines and `relayAndFinalize` is 128 lines. Splitting further would separate the relay loop from the terminal write, which share the abort and stop state.

## Decisions

### D1. One `StreamCompletionRequest` object

The 16 parameters become fields of `StreamCompletionRequest` (`streaming/stream-completion-request.ts`). `ConversationService` binds `streamCompletion` from the streaming service, so its type follows. Specs read `calls[0][0].<field>` instead of an index.

### D2. Collaborators are plain classes the service constructs

`GenerationPreparation` and `ForegroundGenerationLock` are created in the service constructor from the same config values, and receive the service's own `Logger`.

- **Why not Nest providers:** the constructor signature and the spec's `TestingModule` stay unchanged, and the spec's `service['logger']` spies still observe every log line.

### D3. The terminal write is chosen by a pure function

`toTerminalWrite` maps the four relay outcomes to a `TerminalWrite` (status and partial message). The aborted outcome and the `finally` branch share `toInterruptedWrite`.

## Risks / Trade-offs

- **A spec mock missed during the migration** would read `undefined`. Mitigation: `tsc` over app and spec sources together, and the full `chat-api` test run.
