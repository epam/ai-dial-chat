## ADDED Requirements

### Requirement: Adapter maps `web_search_call` output items to one `Stage` per item

`ResponsesAdapter.relay` SHALL recognize `response.output_item.added`, `response.output_item.done`, `response.web_search_call.in_progress`, `response.web_search_call.searching`, and `response.web_search_call.completed`. When `response.output_item.added` carries `item.type === 'web_search_call'`, the adapter SHALL create exactly one `Stage` entry keyed by `index: output_index`, with `status: null`. The adapter SHALL record the `item_id -> output_index` mapping for the lifetime of the response so that later tool-specific lifecycle events (keyed only by `item_id`) resolve to the same `Stage.index`.

#### Scenario: Output-item added creates one running stage

- **WHEN** `response.output_item.added` arrives with `item.type: "web_search_call"`, `item_id: "ws_1"`, `output_index: 0`
- **THEN** exactly one `Stage` with `index: 0` and `status: null` is created

#### Scenario: Generic and tool-specific events for the same item do not duplicate stages

- **WHEN** `response.output_item.added` for `item_id: "ws_1"` is followed by `response.web_search_call.in_progress`, `response.web_search_call.searching`, and finally `response.web_search_call.completed`, all referencing `item_id: "ws_1"`
- **THEN** exactly one `Stage` entry exists for that item throughout, settling to `StageStatus.Completed`

#### Scenario: Two tool executions produce two ordered stages

- **WHEN** a response contains two `web_search_call` items with `output_index: 0` and `output_index: 1`, both completing successfully
- **THEN** the persisted `custom_content.stages` array contains two entries ordered by `index` matching their `output_index`

### Requirement: No-op tool lifecycle events do not duplicate or increment the unknown-event metric

`response.web_search_call.in_progress` and `response.web_search_call.searching` SHALL be recognized, intentional no-ops: they SHALL NOT create a new `Stage`, SHALL NOT change an existing stage's `status`, and SHALL NOT increment `generationUnknownEventsTotal`.

#### Scenario: Progress events are safe no-ops

- **WHEN** `response.web_search_call.in_progress` or `response.web_search_call.searching` arrives for an already-created stage
- **THEN** the stage's `status` remains `null` and `generationUnknownEventsTotal` is not incremented

### Requirement: Completion, failure, and malformed/out-of-order tool events settle or safely ignore a stage

`response.output_item.done` and `response.web_search_call.completed` SHALL settle the corresponding stage: a `web_search_call` item with a completed status maps to `StageStatus.Completed`; an explicit failed/incomplete status maps to `StageStatus.Failed`. A tool-specific lifecycle event referencing an `item_id` the adapter has not previously seen via `response.output_item.added` SHALL be logged (without payload content) and skipped rather than crash the stream or block subsequent text/terminal events. A malformed event (missing/invalid fields) SHALL be handled the same way.

#### Scenario: Explicit completion settles the stage as completed

- **WHEN** `response.output_item.done` arrives with `item.type: "web_search_call"`, `item.status: "completed"`
- **THEN** the corresponding stage's `status` becomes `StageStatus.Completed`

#### Scenario: Explicit failure settles the stage as failed

- **WHEN** `response.output_item.done` arrives with `item.type: "web_search_call"`, `item.status: "failed"` (or `"incomplete"`)
- **THEN** the corresponding stage's `status` becomes `StageStatus.Failed`

#### Scenario: Out-of-order tool event does not crash the stream

- **WHEN** `response.web_search_call.completed` arrives for an `item_id` never seen via `response.output_item.added`
- **THEN** the adapter logs a debug line with no payload content, does not create or update any stage, and continues processing subsequent events

#### Scenario: Malformed tool event does not crash the stream

- **WHEN** a `response.output_item.done` event is missing `item.type` or `output_index`
- **THEN** the adapter safely ignores the event without throwing and continues processing subsequent events

### Requirement: Reasoning and message output items never become stages

`response.output_item.added`/`.done` events whose `item.type` is `reasoning` or `message` SHALL NOT create or update any `Stage`.

#### Scenario: Reasoning output item is not staged

- **WHEN** `response.output_item.added`/`.done` arrives with `item.type: "reasoning"`
- **THEN** no `Stage` entry is created or updated for that item

#### Scenario: Final message output item is not staged

- **WHEN** `response.output_item.added`/`.done` arrives with `item.type: "message"`
- **THEN** no `Stage` entry is created or updated for that item

### Requirement: Unfinished stages are settled to `Failed` on every terminal path, never left running

At the end of `relay`, for every return path (`completed`, `error`, `aborted`, `rejected` before a stream started), the adapter SHALL inspect `assembledMessage.custom_content?.stages` for any entry with `status: null` and, if found, SHALL write a corrective chunk marking each such entry `StageStatus.Failed` before returning. This applies equally when the response otherwise completes successfully but the expected tool-done event never arrived for a given item.

#### Scenario: Response failure settles a running stage as failed

- **WHEN** a `web_search_call` stage is still `status: null` when `response.failed` terminates the stream
- **THEN** the persisted stage's `status` becomes `StageStatus.Failed`, and previously accumulated text/other stages are preserved

#### Scenario: Response incomplete settles a running stage as failed

- **WHEN** a `web_search_call` stage is still `status: null` when `response.incomplete` terminates the stream
- **THEN** the persisted stage's `status` becomes `StageStatus.Failed`

#### Scenario: User abort settles a running stage as failed

- **WHEN** a `web_search_call` stage is still `status: null` when the request is aborted via the existing stop-generation AbortSignal
- **THEN** the persisted stage's `status` becomes `StageStatus.Failed`

#### Scenario: Successful response with a missing tool-done event still settles the stage

- **WHEN** `response.completed` terminates the stream successfully but no `response.output_item.done`/`response.web_search_call.completed` was ever observed for a created stage
- **THEN** that stage's `status` is settled to `StageStatus.Failed` rather than left `null`, and the response's text is still persisted as completed

### Requirement: Tool stage content excludes raw payloads and unreviewed model-derived details

A `web_search_call` stage's `name`/`tag` SHALL communicate a human-readable tool category (e.g. a `tag` of `"Web Search"`). The stage SHALL NOT include raw output-item JSON, function arguments, credentials, approval payloads, headers, tool results, or an unreviewed search query. No `include` request values SHALL be added to the outbound Responses request to enrich stage content.

#### Scenario: Stage content contains no raw upstream payload

- **WHEN** a `web_search_call` stage is created and settled
- **THEN** its `name`/`tag`/`content` contain only the human-readable category, never raw item JSON or arguments

### Requirement: Only `web_search_call` is wired into the generic tool-stage mapper in this change

Output item types other than `web_search_call`, `reasoning`, and `message` (including `file_search_call`, `code_interpreter_call`, `image_generation_call`, `mcp_call` and MCP list/approval items, `function_call`, `custom_tool_call`, `computer_call`, and any shell/apply-patch/tool-search call items) SHALL NOT be mapped to a `Stage` by this change. They SHALL fall through the existing safe unknown-item handling — no stage is created, no crash occurs, and no execution is implied.

#### Scenario: Unsupported output item type does not create a stage or crash

- **WHEN** a response contains an output item of a type not in the supported set (e.g. `function_call`)
- **THEN** no `Stage` is created for that item, and the stream continues processing text/terminal events normally

### Requirement: Tool-stage identity and no-op handling never inflate the unknown-event metric

Every event type explicitly named in this capability's requirements — recognized-and-mapped or recognized-and-intentionally-ignored — SHALL NOT increment `generationUnknownEventsTotal`. Only event types outside this set retain the existing sanitized/truncated unknown-event behavior.

#### Scenario: All handled tool lifecycle events are excluded from the unknown-event metric

- **WHEN** a stream contains `response.output_item.added`, `response.output_item.done`, and all three `response.web_search_call.*` events
- **THEN** none of them increment `generationUnknownEventsTotal`

#### Scenario: Truly unknown events retain existing behavior

- **WHEN** a stream contains an event type not recognized by any adapter requirement (old or new)
- **THEN** it is handled exactly as before this change — sanitized/truncated label recorded on `generationUnknownEventsTotal`, debug-logged without payload content
