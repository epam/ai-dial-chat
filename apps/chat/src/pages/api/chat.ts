import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import {
  excludeSystemMessages,
  getSystemMessageContent,
} from '@/src/utils/app/conversation';
import { getConfigurationValue } from '@/src/utils/app/form-schema';
import {
  doesModelAllowSystemPrompt,
  doesModelAllowTemperature,
} from '@/src/utils/app/models';
import { validateServerSession } from '@/src/utils/auth/session';
import { OpenAIStream } from '@/src/utils/server';
import {
  chatErrorHandler,
  getUserMessageCustomContent,
  limitMessagesByTokens,
} from '@/src/utils/server/chat';
import { getFullToken } from '@/src/utils/server/server';

import { ChatBody } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';

import { DEFAULT_SYSTEM_PROMPT } from '@/src/constants/default-server-settings';
import {
  DEFAULT_TEMPERATURE,
  FALLBACK_TEMPERATURE,
} from '@/src/constants/default-ui-settings';
import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from './auth/[...nextauth]';

import { Message, Role } from '@epam/ai-dial-shared';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  const { id, reference, messages, prompt, temperature, model } =
    req.body as ChatBody;

  try {
    const token = await getFullToken({ req });

    if (!id || !model || (!prompt && !messages?.length)) {
      return res.status(400).send(errorsMessages[400]);
    }

    let promptToSend = prompt;
    let filteredMessages = messages;
    if (!doesModelAllowSystemPrompt(model)) {
      // model doesn't support system prompt
      promptToSend = '';
      filteredMessages = excludeSystemMessages(messages);
    } else if (getSystemMessageContent(messages)) {
      // system prompt is already added by overlay
      promptToSend = '';
    } else if (!promptToSend && model.type === EntityType.Model) {
      // if no any system prompt was added
      promptToSend = DEFAULT_SYSTEM_PROMPT;
    }

    let temperatureToUse = temperature;
    if (!doesModelAllowTemperature(model)) {
      temperatureToUse = FALLBACK_TEMPERATURE;
    } else if (
      !temperatureToUse &&
      temperatureToUse !== 0 &&
      model.type !== EntityType.Application
    ) {
      temperatureToUse = DEFAULT_TEMPERATURE;
    }

    const { limits, features, tokenizer } = model;

    let messagesToSend: Message[] = limitMessagesByTokens({
      promptToSend,
      messages: filteredMessages,
      limits,
      features,
      tokenizer,
      request: req,
    });

    const configurationValue = getConfigurationValue(
      messages.find(getConfigurationValue),
    );

    messagesToSend = messagesToSend.map((message) => ({
      ...getUserMessageCustomContent(
        message,
        model.features?.assistantAttachmentsInRequest,
      ),
      role: message.role,
      content: message.content,
    }));
    messagesToSend =
      !promptToSend || promptToSend.trim().length === 0
        ? messagesToSend
        : [
            {
              role: Role.System,
              content: promptToSend,
            },
            ...messagesToSend,
          ];

    const stream = await OpenAIStream({
      model,
      temperature: temperatureToUse,
      messages: messagesToSend,
      userJWT: token?.token ?? '',
      chatReference: reference ?? id,
      jobTitle: token?.jobTitle,
      maxRequestTokens: features?.truncatePrompt
        ? limits?.maxRequestTokens
        : undefined,
      configurationSchemaValue: configurationValue,
    });
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Content-Type', 'application/octet-stream');

    const reader = stream.getReader();

    let clientAborted = false;
    res.on('close', () => {
      clientAborted = true;
      reader.cancel();
    });

    const processStream = async () => {
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (clientAborted) {
            break;
          }

          const { value, done } = await reader.read();

          if (done) {
            break;
          }
          res.write(value);
        }
        res.end();
      } catch (error) {
        return chatErrorHandler({
          error,
          res,
          msg: 'Error reading stream:',
          isStreamingError: true,
        });
      } finally {
        res.end();
      }
    };

    await processStream();
  } catch (error) {
    return chatErrorHandler({
      error,
      res,
      msg: `Error while sending chat request to '${model?.id}'`,
    });
  }
};

export default handler;
