import { NextApiResponse } from 'next';

import { Message, Role } from '@/src/types/chat';
import { DialAIEntityModel } from '@/src/types/openai';

import { errorsMessages } from '@/src/constants/errors';

import { OpenAIError } from './error';
import { logger } from './logger';

import { Blob } from 'buffer';

// This is very conservative calculations of tokens (1 token = 1 byte)
export const getTokensSize = (str: string): number => {
  return new Blob([str]).size;
};

export function limitMessagesByTokens(
  promptToSend: string | undefined,
  messages: Message[],
  limits: DialAIEntityModel['limits'],
): Message[] {
  if (!limits || !limits.maxRequestTokens) {
    return messages;
  }

  const promptToEncode: string = promptToSend ?? '';
  const promptTokensSize = getTokensSize(promptToEncode);

  let fullTokensSize = promptTokensSize;
  let messagesToSend: Message[] = [];

  const length = Math.min(messages.length, 1000);
  for (let i = length - 1; i >= 0; i--) {
    if (!messages[i]) {
      break;
    }
    const currentMessageTokensSize = getTokensSize(messages[i].content);

    if (fullTokensSize + currentMessageTokensSize > limits.maxRequestTokens) {
      break;
    }
    fullTokensSize += currentMessageTokensSize;
    messagesToSend = [messages[i], ...messagesToSend];
  }
  return messagesToSend;
}

export function getMessageCustomContent(
  message: Message,
): Partial<Message> | undefined {
  return (
    (message.custom_content?.state || message.custom_content?.attachments) && {
      custom_content: {
        attachments:
          message.role !== Role.Assistant
            ? message.custom_content?.attachments
            : undefined,
        state: message.custom_content?.state,
      },
    }
  );
}

export const chatErrorHandler = ({
  error,
  res,
  msg,
  isStreamingError,
}: {
  error: OpenAIError | unknown;
  res: NextApiResponse;
  msg?: string;
  isStreamingError?: boolean;
}): void => {
  const postfix = isStreamingError ? '\0' : '';
  const fieldName = isStreamingError ? 'errorMessage' : 'message';

  logger.error(error, msg);
  if (error instanceof OpenAIError) {
    // Rate limit errors and gateway errors https://platform.openai.com/docs/guides/error-codes/api-errors
    if (['429', '504'].includes(error.code)) {
      return res
        .status(500)
        .send(JSON.stringify({ [fieldName]: errorsMessages[429] }) + postfix);
    }
    if (error.code === 'content_filter') {
      return res
        .status(500)
        .se.send(
          JSON.stringify({ [fieldName]: errorsMessages.contentFiltering }) +
            postfix,
        );
    }
  }

  return res
    .status(500)
    .send(
      JSON.stringify({ [fieldName]: errorsMessages.generalServer }) + postfix,
    );
};
