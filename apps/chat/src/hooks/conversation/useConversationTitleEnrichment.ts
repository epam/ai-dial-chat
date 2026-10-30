import {
  type ConversationListItemDto,
  ConversationTitleStreamDoneEventDtoTypeEnum,
  ConversationTitleStreamDoneReason,
  ConversationTitleStreamErrorEventDtoTypeEnum,
  type ConversationTitleStreamEventDto,
  ConversationTitleStreamTitleEventDtoTypeEnum,
} from '@epam/ai-dial-chat-api-client';
import {
  useConversationTitleEnrichmentController,
  type ConversationTitleEnrichmentOptions,
} from '@epam/ai-dial-chat-hooks/conversation';
import { ConversationTitleRequestEnd } from '@epam/ai-dial-chat-hooks/conversation';
import { type Dispatch, type SetStateAction } from 'react';
import {
  CONVERSATION_TITLE_STREAM_MAX_ID_BYTES,
  CONVERSATION_TITLE_STREAM_MAX_IDS,
  isConversationTitleStreamUnsupported,
} from '../../server-api/conversation-title-stream';
import {
  getConversationTitles,
  streamConversationTitles,
} from '../../server-api/conversations.api';

const streamTitles: NonNullable<
  ConversationTitleEnrichmentOptions['streamTitles']
> = async (ids, signal, onTitle) => {
  const settled = new Set<string>();
  const run = async (): Promise<ConversationTitleRequestEnd> => {
    const requested = new Set(ids);
    let events: AsyncIterable<ConversationTitleStreamEventDto>;
    try {
      events = await streamConversationTitles(ids, signal);
    } catch (error) {
      return isConversationTitleStreamUnsupported(error)
        ? ConversationTitleRequestEnd.Unsupported
        : ConversationTitleRequestEnd.Stopped;
    }
    try {
      for await (const event of events) {
        if (signal.aborted) return ConversationTitleRequestEnd.Stopped;
        if (event.type === ConversationTitleStreamErrorEventDtoTypeEnum.Error) {
          return ConversationTitleRequestEnd.Stopped;
        }
        if (event.type === ConversationTitleStreamDoneEventDtoTypeEnum.Done) {
          const isTruthful =
            event.total === requested.size &&
            event.processed === settled.size &&
            (event.reason === ConversationTitleStreamDoneReason.Budget ||
              settled.size === requested.size);
          if (!isTruthful) return ConversationTitleRequestEnd.Stopped;
          return event.reason === ConversationTitleStreamDoneReason.Complete
            ? ConversationTitleRequestEnd.Complete
            : ConversationTitleRequestEnd.Budget;
        }
        /* Unknown or repeated IDs never mutate state. */
        if (!requested.has(event.id) || settled.has(event.id)) continue;
        settled.add(event.id);
        if (event.type === ConversationTitleStreamTitleEventDtoTypeEnum.Title)
          onTitle(event.id, event.title);
      }
    } catch {
      return ConversationTitleRequestEnd.Stopped;
    }
    /* EOF without a terminal event is an interruption, not completion. */
    return ConversationTitleRequestEnd.Stopped;
  };
  const end = await run();
  return { end, settledIds: [...settled] };
};
const options: ConversationTitleEnrichmentOptions = {
  getTitles: getConversationTitles,
  streamTitles,
  batchSize: 25,
  maxIds: CONVERSATION_TITLE_STREAM_MAX_IDS,
  maxBytes: CONVERSATION_TITLE_STREAM_MAX_ID_BYTES,
  flushMs: 100,
  maxPendingUpdates: 100,
  protectionMs: 315_000,
};
/** Resolves list titles using host transports and cache protection policy. */
export const useConversationTitleEnrichment = (
  userSub: string | undefined,
  setConversations: Dispatch<SetStateAction<ConversationListItemDto[]>>,
) =>
  useConversationTitleEnrichmentController(userSub, setConversations, options);
