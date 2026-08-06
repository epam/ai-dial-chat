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
