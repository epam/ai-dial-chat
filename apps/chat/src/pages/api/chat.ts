import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { getConfigurationValue } from '@/src/utils/app/form-schema';
import {
  doesModelAllowAddons,
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

import { ChatBody } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';

import { DEFAULT_SYSTEM_PROMPT } from '@/src/constants/default-server-settings';
import { DEFAULT_TEMPERATURE } from '@/src/constants/default-ui-settings';
import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from './auth/[...nextauth]';

import { Message, Role } from '@epam/ai-dial-shared';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  const {
    id,
    messages,
    prompt,
    temperature,
    selectedAddons,
    model,
    assistantModel,
  } = req.body as ChatBody;

  try {
    const token = await getToken({ req });

    if (
      !id ||
      !model ||
      (!!assistantModel && model.type !== EntityType.Assistant) ||
      (!prompt && !messages?.length)
    ) {
      return res.status(400).send(errorsMessages[400]);
    }

    let promptToSend = prompt;
    if (!doesModelAllowSystemPrompt(model)) {
      promptToSend = '';
    } else if (!promptToSend && model.type === EntityType.Model) {
      promptToSend = DEFAULT_SYSTEM_PROMPT;
    }

    let temperatureToUse = temperature;
    if (!doesModelAllowTemperature(model)) {
      temperatureToUse = 1;
    } else if (
      !temperatureToUse &&
      temperatureToUse !== 0 &&
      model.type !== EntityType.Application
    ) {
      temperatureToUse = DEFAULT_TEMPERATURE;
    }

    // For assistant submodel features, limits, tokenizer should be used
    const limits =
      model.type === EntityType.Assistant
        ? assistantModel!.limits
        : model.limits;
    const features =
      model.type === EntityType.Assistant
        ? assistantModel!.features
        : model.features;
    const tokenizer =
      model.type === EntityType.Assistant
        ? assistantModel!.tokenizer
        : model.tokenizer;

    let messagesToSend: Message[] = limitMessagesByTokens({
      promptToSend,
      messages,
      limits,
      features,
      tokenizer,
    });

    const configurationValue = getConfigurationValue(
      messages.find(getConfigurationValue),
    );

    messagesToSend = messagesToSend.map((message) => ({
      ...getUserMessageCustomContent(message),
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
      selectedAddonsIds:
        selectedAddons?.length && doesModelAllowAddons(model)
          ? selectedAddons
          : undefined,
      assistantModelId: assistantModel?.id,
      userJWT: token?.access_token as string,
      chatId: id,
      jobTitle: token?.jobTitle as string,
      maxRequestTokens: features?.truncatePrompt
        ? limits?.maxRequestTokens
        : undefined,
      configurationSchemaValue: configurationValue,
    });
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = stream.getReader();
    const processStream = async () => {
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
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
