import type { ConversationMessageDto } from '../dto/conversation-message.dto';

/**
 * One item of the Responses API `input` array — a flattened role/text pair
 * built from the existing conversation history (`buildConversationHistory`),
 * mirroring how the Chat Completions adapter builds `messages`.
 */
export interface ResponsesInputItem {
  role: string;
  content: string;
}

/**
 * First-iteration Responses request body. Always `stream: true` and
 * `store: false` — never carries `previous_response_id` or `conversation`
 * (DIAL Core rejects the key's mere presence, even as `null`). `temperature`
 * and `max_output_tokens` are optional Chat-side overrides: `temperature` is
 * included only when the resolved deployment explicitly supports it,
 * `max_output_tokens` only when the conversation carries a validated value —
 * see `ResponsesAdapter.buildRequest` for the omission rules.
 */
export interface ResponsesApiRequestBody {
  model: string;
  input: ResponsesInputItem[];
  stream: true;
  store: false;
  temperature?: number;
  max_output_tokens?: number;
}

/**
 * Runtime guard for `Conversation.maxOutputTokens` at the point it crosses
 * from persisted Chat data into the outbound Responses wire request. A bare
 * TypeScript type is not enough here — the persisted value may come from an
 * untrusted import/save payload that was never nested-validated (see
 * `design.md` Decision 4) — so this checks the actual runtime value: a
 * positive, finite integer within `Number.isSafeInteger` range. Anything
 * else (absent, `null`, `0`, negative, fractional, `NaN`, `Infinity`, or an
 * unsafe integer) must be omitted rather than forwarded.
 */
export const isValidMaxOutputTokens = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  Number.isSafeInteger(value) &&
  value > 0;

/** Responses SSE event types this adapter understands and normalizes. */
export interface ResponsesCreatedEvent {
  type: 'response.created';
  response?: { id?: string };
}

export interface ResponsesOutputTextDeltaEvent {
  type: 'response.output_text.delta';
  delta?: string;
}

export interface ResponsesCompletedEvent {
  type: 'response.completed';
  response?: { id?: string; status?: string };
}

export interface ResponsesIncompleteEvent {
  type: 'response.incomplete';
  response?: { id?: string; status?: string };
}

export interface ResponsesErrorEvent {
  type: 'error';
  error?: { message?: string; code?: string };
  message?: string;
  code?: string;
}

/**
 * Terminal failure event. Unlike `ResponsesErrorEvent` (a top-level `error`
 * frame), `response.failed` nests its error under `response.error`,
 * mirroring the OpenAI Responses API's `response.failed` payload shape.
 */
export interface ResponsesFailedEvent {
  type: 'response.failed';
  response?: { id?: string; error?: { message?: string; code?: string } };
}

/**
 * A new reasoning-summary part has started for the given `(item_id,
 * output_index, summary_index)` key. Structural marker only — never carries
 * summary text itself.
 */
export interface ResponsesReasoningSummaryPartAddedEvent {
  type: 'response.reasoning_summary_part.added';
  item_id?: string;
  output_index?: number;
  summary_index?: number;
}

/** Incremental reasoning-summary text fragment for a given key. */
export interface ResponsesReasoningSummaryTextDeltaEvent {
  type: 'response.reasoning_summary_text.delta';
  item_id?: string;
  output_index?: number;
  summary_index?: number;
  delta?: string;
}

/**
 * The full text of a reasoning-summary part, sent once the part is
 * finished. Used as a fallback when no prior delta was received for the
 * same key — see `ResponsesAdapter.relay`'s dedup logic.
 */
export interface ResponsesReasoningSummaryTextDoneEvent {
  type: 'response.reasoning_summary_text.done';
  item_id?: string;
  output_index?: number;
  summary_index?: number;
  text?: string;
}

/** A single Responses API output item, as carried by `output_item.added`/`.done`. */
export interface ResponsesOutputItem {
  id?: string;
  /** Discriminator, e.g. `'web_search_call'`, `'reasoning'`, `'message'`, `'function_call'`, etc. */
  type?: string;
  /** Present on `web_search_call` (and similar) items once settled, e.g. `'completed'`/`'failed'`/`'incomplete'`. */
  status?: string;
}

/**
 * A new output item has appeared in the response's output array. Only
 * `item.type === 'web_search_call'` is mapped to a `Stage` in this MVP —
 * `reasoning`/`message`/anything else is intentionally never staged.
 */
export interface ResponsesOutputItemAddedEvent {
  type: 'response.output_item.added';
  item?: ResponsesOutputItem;
  output_index?: number;
}

/** An output item has finished — carries its final `status` for settlement. */
export interface ResponsesOutputItemDoneEvent {
  type: 'response.output_item.done';
  item?: ResponsesOutputItem;
  output_index?: number;
}

/** `web_search_call` lifecycle event, keyed only by `item_id` (no `output_index`). */
export interface ResponsesWebSearchCallEvent {
  type:
    | 'response.web_search_call.in_progress'
    | 'response.web_search_call.searching'
    | 'response.web_search_call.completed';
  item_id?: string;
}

/** Catch-all for event types not in the handled allowlist above. */
export interface ResponsesUnknownEvent {
  type: string;
}

export type ResponsesSseEvent =
  | ResponsesCreatedEvent
  | ResponsesOutputTextDeltaEvent
  | ResponsesCompletedEvent
  | ResponsesIncompleteEvent
  | ResponsesErrorEvent
  | ResponsesFailedEvent
  | ResponsesReasoningSummaryPartAddedEvent
  | ResponsesReasoningSummaryTextDeltaEvent
  | ResponsesReasoningSummaryTextDoneEvent
  | ResponsesOutputItemAddedEvent
  | ResponsesOutputItemDoneEvent
  | ResponsesWebSearchCallEvent
  | ResponsesUnknownEvent;

/**
 * Explicit terminal lifecycle state for a Responses SSE stream, replacing a
 * `terminalError: string | null` / `isDone: boolean` pair so precedence
 * between competing terminal signals (`response.failed`, `response.incomplete`,
 * a top-level `error`, an invalid-status `response.completed`, and the
 * compatibility `[DONE]` marker) is explicit rather than encoded in loosely
 * related booleans.
 */
export enum ResponsesTerminalState {
  Success = 'success',
  Failed = 'failed',
  Incomplete = 'incomplete',
  StreamError = 'stream_error',
}

/**
 * Once recorded, a non-`Success` signal must never be overwritten by a later
 * `[DONE]` marker or by reaching end-of-stream — see
 * `responses.adapter.ts`'s `handleEvent`/post-loop logic.
 */
export interface ResponsesTerminalSignal {
  state: ResponsesTerminalState;
  message?: string;
}

/**
 * One reasoning-summary text fragment, keyed by its upstream identity
 * (`itemId`/`outputIndex`/`summaryIndex`) so `apply-chunk.server.ts` can
 * upsert-and-concatenate it into `custom_content.reasoning_summaries`. See
 * design.md Decision 2.
 */
export interface ReasoningSummaryChunk {
  /** Upstream reasoning output item id — primary correlation key. */
  itemId: string;
  /** Position of the reasoning item in the response's output array. */
  outputIndex: number;
  /** Position of this summary part within the reasoning item. */
  summaryIndex: number;
  /** Incremental or (fallback) complete summary text fragment for this key. */
  text: string;
}

/**
 * Provider-neutral tool-stage discriminator set on a Responses-origin
 * `Stage` chunk. Never a raw Responses API item-type string — resolved to a
 * localized label only at the `apps/chat` boundary.
 */
export enum ToolStageKind {
  WebSearch = 'web_search',
}

/**
 * Minimal `Stage`-shaped chunk entry the Responses adapter emits — the same
 * shape `apply-chunk.server.ts`'s existing `mergeStages` already merges by
 * `index`, with an additional optional `toolKind` marker.
 */
export interface NormalizedStageChunk {
  index: number;
  name?: string;
  status?: string | null;
  tag?: string;
  toolKind?: ToolStageKind;
}

/**
 * Normalized chunk shape both adapters emit, identical to the
 * `chat.completion.chunk` shape DIAL Core's Chat Completions endpoint
 * already sends and `apply-chunk.server.ts` already understands — the
 * Responses adapter translates its native SSE events into this shape rather
 * than forwarding them as-is.
 */
export interface NormalizedStreamChunk {
  id?: string;
  choices?: Array<{
    delta?: {
      content?: string;
      responseId?: string;
      custom_content?: {
        reasoning_summaries?: ReasoningSummaryChunk[];
        stages?: NormalizedStageChunk[];
      };
    };
  }>;
}

/**
 * Mutable timing bag both adapters write into so `ConversationService` can
 * record time-to-first-delta without either adapter depending on the
 * metrics module directly.
 */
export interface GenerationRelayTiming {
  firstDeltaAt?: number;
}

/**
 * Outcome of relaying one upstream generation call, shared by both the
 * Chat Completions and Responses adapters so `ConversationService` can
 * finalize/persist the result identically regardless of which adapter ran.
 */
export type GenerationRelayOutcome =
  | {
      outcome: 'rejected';
      status: number;
      errorMessage: string;
      assembledMessage: ConversationMessageDto;
    }
  | { outcome: 'completed'; assembledMessage: ConversationMessageDto }
  | { outcome: 'aborted'; assembledMessage: ConversationMessageDto }
  | {
      outcome: 'error';
      error: unknown;
      assembledMessage: ConversationMessageDto;
    };
