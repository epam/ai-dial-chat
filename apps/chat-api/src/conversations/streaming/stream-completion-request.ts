import type { MessageCustomContentDto } from '../dto/message-custom-content.dto';
import type { CompletionMode } from '../dto/send-completion.dto';

/** One foreground or background completion request, as `ConversationStreamingService.streamCompletion` receives it. */
export interface StreamCompletionRequest {
  /** Conversation path relative to `bucket`; also the generation-registry key. */
  conversationPath: string;
  /** Caller's bearer token. */
  token: string;
  /** Caller's session bucket. */
  bucket: string;
  /** Client-generated id of this generation. */
  generationId: string;
  mode: CompletionMode;
  /** User message text for `Append`/`Edit` modes. */
  message?: string;
  /** Index of the message to edit or regenerate from. */
  messageIndex?: number;
  /** Deployment the user has selected now. */
  model: string;
  customContent?: MessageCustomContentDto;
  /** Registry owner of the generation (the resolved principal key). */
  ownerKey: string;
  /** Called once, right before the first chunk, when the SSE headers should be sent. */
  onReadyToStream: () => void;
  /** Caller's subject claim, used for capability resolution. */
  sub: string;
  clientChannelId?: string;
  timezone?: string;
  lang?: string;
  jobTitle?: string;
}
