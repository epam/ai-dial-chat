import { NextApiResponse } from 'next';

import { DialAIError } from '@/src/types/error';
import { DialAIEntityModel } from '@/src/types/models';

import { errorsMessages } from '@/src/constants/errors';

import { logger } from './logger';

import { Tiktoken, TiktokenEncoding, get_encoding } from '@dqbd/tiktoken';
import { Message, Role } from '@epam/ai-dial-shared';
import { Blob } from 'buffer';

// This is very conservative calculations of tokens (1 token = 1 byte)
export const getBytesTokensSize = (str: string): number => {
  return new Blob([str]).size;
};

const encodings: Partial<Record<TiktokenEncoding, Tiktoken | undefined>> = {};

export function limitMessagesByTokens({
  promptToSend,
  messages,
  limits,
  features,
  tokenizer,
}: {
  promptToSend: string | undefined;
  messages: Message[];
  limits: DialAIEntityModel['limits'];
  features: DialAIEntityModel['features'];
  tokenizer: DialAIEntityModel['tokenizer'];
}): Message[] {
  if (!limits || !limits.maxRequestTokens || features?.truncatePrompt) {
    return messages;
  }

  let calculateTokensSize: (str: string) => number = getBytesTokensSize;
  let tokensPerMessage = 0;

  if (tokenizer && tokenizer.encoding && tokenizer.tokensPerMessage) {
    if (!encodings[tokenizer.encoding]) {
      encodings[tokenizer.encoding] = get_encoding(tokenizer.encoding);
    }
    calculateTokensSize = (str) =>
      tokenizer.encoding && encodings[tokenizer.encoding]
        ? encodings[tokenizer.encoding]!.encode(str).length
        : getBytesTokensSize(str);
    tokensPerMessage = tokenizer.tokensPerMessage;
  }

  const promptToEncode: string = promptToSend ?? '';
  const promptTokensSize = promptToEncode
    ? calculateTokensSize(promptToEncode) + tokensPerMessage
    : 0;

  let fullTokensSize = promptTokensSize;
  let messagesToSend: Message[] = [];

  const length = Math.min(messages.length, 1000);
  for (let i = length - 1; i >= 0; i--) {
    if (!messages[i]) {
      break;
    }
    const currentMessageTokensSize =
      calculateTokensSize(messages[i].content) + tokensPerMessage;

    if (fullTokensSize + currentMessageTokensSize > limits.maxRequestTokens) {
      break;
    }
    fullTokensSize += currentMessageTokensSize;
    messagesToSend = [messages[i], ...messagesToSend];
  }

  if (messagesToSend.length === 0) {
    throw new DialAIError(
      'User sended messages cannot be empty after limit messages by tokens process',
      '',
      '',
      '400',
    );
  }

  return messagesToSend;
}

export const hardLimitMessages = (messages: Message[]) => {
  let userMessageFound = false;
  return messages
    .reverse()
    .filter((message) => message.role !== Role.Assistant)
    .reduce((acc, current) => {
      if (current.role === Role.User && !userMessageFound) {
        acc.push(current);
        userMessageFound = true;
      } else if (current.role === Role.System) {
        acc.push(current);
      }
      return acc;
    }, [] as Message[]);
};

export function getMessageCustomContent(
  message: Message,
): Partial<Message> | undefined {
  if (message.role === Role.Assistant && !message.custom_content?.state) {
    return;
  }
  return message.custom_content?.state ||
    message.custom_content?.attachments?.length
    ? {
        custom_content: {
          attachments:
            message.role !== Role.Assistant &&
            message.custom_content?.attachments?.length
              ? message.custom_content?.attachments
              : undefined,
          state: message.custom_content?.state,
        },
      }
    : undefined;
}

const getResponseBody = (
  fieldName: string,
  displayMessage: string | undefined,
  fallbackMessage: string,
) => {
  return {
    [fieldName]: displayMessage ? displayMessage : fallbackMessage,
  };
};

export const chatErrorHandler = ({
  error,
  res,
  msg,
  isStreamingError,
}: {
  error: DialAIError | unknown;
  res: NextApiResponse;
  msg: string;
  isStreamingError?: boolean;
}): void => {
  const postfix = isStreamingError ? '\0' : '';
  const fieldName = isStreamingError ? 'errorMessage' : 'message';
  let fallbackErrorMessage = errorsMessages.generalServer;

  logger.error(error, msg);

  if (error instanceof DialAIError) {
    // Rate limit errors and gateway errors https://platform.openai.com/docs/guides/error-codes/api-errors
    if (['429', '504'].includes(error.code)) {
      fallbackErrorMessage = errorsMessages[429];
    } else if (error.code === 'content_filter') {
      fallbackErrorMessage = errorsMessages.contentFiltering;
    }
  }

  const responseBody = getResponseBody(
    fieldName,
    error instanceof DialAIError ? error.displayMessage : undefined,
    fallbackErrorMessage,
  );

  return res.status(500).send(JSON.stringify(responseBody) + postfix);
};
