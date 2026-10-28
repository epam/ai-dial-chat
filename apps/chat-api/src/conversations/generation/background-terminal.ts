import { extractDialErrorMessage } from '../../common/dial/dial-error.mapper';
import type { GenerationTerminalEvent } from '../conversation-generation.service';
import {
  BackgroundGenerationStatus,
  type BackgroundGenerationDto,
} from '../dto/background-generation.dto';
import type {
  ServerOwnedMessageFields,
  StoredMessage,
} from './background-message';
import { CoreResponseStatus, type CoreResponse } from './core-responses.client';
import {
  RESPONSES_FAILED_MESSAGE,
  RESPONSES_INCOMPLETE_MESSAGE,
} from './responses.adapter';

/**
 * The attach terminal event matching a message's stored background status.
 * @param message - the message as stored after finalization
 */
export const toStoredTerminalEvent = (
  message: StoredMessage | undefined,
): GenerationTerminalEvent => {
  switch (message?.backgroundGeneration?.status) {
    case BackgroundGenerationStatus.Completed:
      return { type: 'done' };
    case BackgroundGenerationStatus.Stopped:
      return { type: 'stopped' };
    default:
      return {
        type: 'error',
        ...(message?.streamErrorMessage
          ? { message: message.streamErrorMessage }
          : {}),
      };
  }
};

/**
 * Joins the answer text of a stored Responses object's output: only `message` items and
 * their `output_text` parts, so reasoning text is never saved (the live stream drops it
 * too).
 * @param response - stored response retrieved from DIAL Core
 */
export const extractOutputText = (response: CoreResponse): string =>
  (response.output ?? [])
    .filter((item) => item.type === undefined || item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === undefined || part.type === 'output_text')
    .map((part) => part.text ?? '')
    .join('');

/**
 * Whether a stored response's job is still running.
 * @param status - status reported by DIAL Core
 */
export const isRunningStatus = (status: string): boolean =>
  status === CoreResponseStatus.Queued ||
  status === CoreResponseStatus.InProgress;

/**
 * Maps a stored DIAL Core response to the message's new server-owned fields, or `null`
 * while the job is still running. `response === null` means Core no longer knows the
 * job (expired or deleted).
 * @param stored - the pending message as stored
 * @param response - retrieved Core response, or `null` for "not found"
 * @param responseId - the job's id as the caller knows it; kept when storing it failed
 */
export const toTerminalFields = (
  stored: StoredMessage,
  response: CoreResponse | null,
  responseId?: string,
): ServerOwnedMessageFields | null => {
  const base = {
    custom_content: stored.custom_content,
    responseId: stored.responseId ?? responseId,
  };
  const withStatus = (
    status: BackgroundGenerationStatus,
  ): BackgroundGenerationDto => ({
    ...(stored.backgroundGeneration as BackgroundGenerationDto),
    status,
  });
  if (response === null) {
    return {
      ...base,
      content: stored.content ?? '',
      backgroundGeneration: withStatus(BackgroundGenerationStatus.Failed),
      streamErrorMessage: '',
    };
  }
  if (isRunningStatus(response.status)) return null;
  switch (response.status) {
    case CoreResponseStatus.Completed:
      return {
        ...base,
        content: extractOutputText(response),
        backgroundGeneration: withStatus(BackgroundGenerationStatus.Completed),
      };
    case CoreResponseStatus.Cancelled:
      return {
        ...base,
        content: extractOutputText(response),
        backgroundGeneration: withStatus(BackgroundGenerationStatus.Stopped),
        wasStoppedByUser: true,
      };
    case CoreResponseStatus.Incomplete:
      return {
        ...base,
        content: extractOutputText(response),
        backgroundGeneration: withStatus(BackgroundGenerationStatus.Failed),
        streamErrorMessage: RESPONSES_INCOMPLETE_MESSAGE,
      };
    default:
      return {
        ...base,
        content: extractOutputText(response),
        backgroundGeneration: withStatus(BackgroundGenerationStatus.Failed),
        streamErrorMessage:
          extractDialErrorMessage(response.error) ?? RESPONSES_FAILED_MESSAGE,
      };
  }
};
