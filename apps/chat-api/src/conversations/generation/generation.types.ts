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
 * (DIAL Core rejects the key's mere presence, even as `null`).
 */
export interface ResponsesApiRequestBody {
  model: string;
  input: ResponsesInputItem[];
  stream: true;
  store: false;
}

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
  | ResponsesUnknownEvent;

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
