import { NextApiResponse } from 'next';

import { Message, Role } from '@/src/types/chat';
import { DialAIEntityModel } from '@/src/types/openai';

import { errorsMessages } from '@/src/constants/errors';

import { OpenAIError } from './error';
import { logger } from './logger';

import { Tiktoken, get_encoding } from '@dqbd/tiktoken';
import { Blob } from 'buffer';

// This is very conservative calculations of tokens (1 token = 1 byte)
export const getBytesTokensSize = (str: string): number => {
  return new Blob([str]).size;
};

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

  let encoding: Tiktoken | undefined;
  if (tokenizer && tokenizer.encoding && tokenizer.tokensPerMessage) {
    encoding = get_encoding(tokenizer.encoding);
    calculateTokensSize = (str) =>
      encoding ? encoding.encode(str).length : getBytesTokensSize(str);
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

  encoding?.free();
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
        .send(
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
