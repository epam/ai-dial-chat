import { NextApiRequest, NextApiResponse } from 'next';

import { DialAIError } from '@/src/types/error';
import { DialAIEntityModel } from '@/src/types/models';

import { errorsMessages } from '@/src/constants/errors';

import { logger } from './logger';

import { Message, Role } from '@epam/ai-dial-shared';
import { Tiktoken, TiktokenEncoding, get_encoding } from 'tiktoken';

// This is a very conservative calculation of tokens (1 token = 1 byte)
export const getBytesTokensSize = (str: string): number => {
  return new Blob([str]).size;
};

// Note: This cache stores Tiktoken instances indefinitely. Consider implementing
// a cleanup mechanism if memory usage becomes a concern in long-running processes.
const encodings: Partial<Record<TiktokenEncoding, Tiktoken | undefined>> = {};
export function limitMessagesByTokens({
  promptToSend,
  messages,
  limits,
  features,
  tokenizer,
  request,
}: {
  promptToSend: string | undefined;
  messages: Message[];
  limits: DialAIEntityModel['limits'];
  features: DialAIEntityModel['features'];
  tokenizer: DialAIEntityModel['tokenizer'];
  request: NextApiRequest;
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

  // Limit processing to 1000 messages to prevent excessive computation
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
      'User sent messages cannot be empty after limiting messages by tokens',
      400,
      request,
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
  return message.custom_content?.state ||
    message.custom_content?.attachments?.length ||
    message.custom_content?.form_value ||
    message.custom_content?.form_schema
    ? {
        custom_content: {
          attachments:
            message.role !== Role.Assistant &&
            message.custom_content?.attachments?.length
              ? message.custom_content?.attachments
              : undefined,
          state: message.custom_content?.state,
          form_value: message.custom_content?.form_value,
          form_schema: message.custom_content?.form_schema,
        },
      }
    : undefined;
}

export function getUserMessageCustomContent(
  message: Message,
): Partial<Message> | undefined {
  if (
    message.role === Role.Assistant &&
    !message.custom_content?.state &&
    !message.custom_content?.form_schema
  ) {
    return;
  }
  return getMessageCustomContent(message);
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

type ErrorMessageKeys = keyof typeof errorsMessages;

const ERROR_CONFIG: Record<
  string,
  { status: number; messageKey: ErrorMessageKeys }
> = {
  '400': { status: 400, messageKey: 400 },
  '401': { status: 401, messageKey: 401 },
  '403': { status: 403, messageKey: 403 },
  '404': { status: 404, messageKey: 404 },
  '429': { status: 429, messageKey: 429 },
  '504': { status: 504, messageKey: 'timeoutError' },
  content_filter: { status: 400, messageKey: 'contentFiltering' },
  '410': { status: 410, messageKey: 410 },
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
  let statusCode = 500;

  logger.error(error, msg);

  if (error instanceof DialAIError && ERROR_CONFIG[error.code]) {
    const config = ERROR_CONFIG[error.code];
    statusCode = config.status;
    const errorMessage = errorsMessages[config.messageKey];
    fallbackErrorMessage =
      typeof errorMessage === 'function'
        ? errorMessage('entity')
        : errorMessage;
  }

  const responseBody = getResponseBody(
    fieldName,
    error instanceof DialAIError ? error.displayMessage : undefined,
    fallbackErrorMessage,
  );

  return res.status(statusCode).send(JSON.stringify(responseBody) + postfix);
};
