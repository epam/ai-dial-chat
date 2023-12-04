import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { validateServerSession } from '@/src/utils/auth/session';
import { OpenAIError, OpenAIStream } from '@/src/utils/server';
import { getSortedEntities } from '@/src/utils/server/get-sorted-entities';
// 1@ts-expect-error
// import wasm from '../../node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm?module';
// import wasm from '@dqbd/tiktoken/lite/tiktoken_bg.wasm';
import { logger } from '@/src/utils/server/logger';

import { OpenAIEntityAddonID, OpenAIEntityModelID } from '../../types/openai';
import { ChatBody, Message } from '@/src/types/chat';

import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/src/constants/default-settings';
import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from './auth/[...nextauth]';

import tiktokenModel from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { Tiktoken, init } from '@dqbd/tiktoken/lite/init';
import { readFileSync } from 'fs';
import path from 'path';
import { validate } from 'uuid';

// export const config = {
//   runtime: 'edge',
// };

const wasm = readFileSync(
  path.resolve(
    __dirname,
    '../../../../node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm',
  ),
);

let encoding: Tiktoken;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const {
      modelId,
      messages,
      prompt,
      temperature,
      selectedAddons,
      assistantModelId,
      id,
    } = req.body as ChatBody;

    if (!id || !validate(id)) {
      return res.status(400).send(errorsMessages[400]);
    }

    if (!encoding) {
      await init((imports) => WebAssembly.instantiate(wasm, imports));
      encoding = new Tiktoken(
        tiktokenModel.bpe_ranks,
        tiktokenModel.special_tokens,
        tiktokenModel.pat_str,
      );
    }

    const token = await getToken({ req });
    const models = await getSortedEntities(token);
    const model = models.find(({ id }) => id === modelId);

    if (!model) {
      return res.status(403).send(errorsMessages[403]);
    }

    let promptToSend = prompt;
    if (!promptToSend && model.type === 'model') {
      promptToSend = DEFAULT_SYSTEM_PROMPT;
    }

    let temperatureToUse = temperature;
    if (temperatureToUse && model.type !== 'application') {
      temperatureToUse = DEFAULT_TEMPERATURE;
    }

    const promptToEncode: string = promptToSend ?? '';
    const prompt_tokens = encoding.encode(promptToEncode);

    let tokens_per_message = 0;
    if (
      model.id == OpenAIEntityModelID.GPT_3_5 ||
      model.id == OpenAIEntityModelID.GPT_3_5_AZ
    ) {
      tokens_per_message = 5;
    } else if (
      model.id == OpenAIEntityModelID.GPT_4 ||
      model.id == OpenAIEntityModelID.GPT_4_32K ||
      model.id === OpenAIEntityModelID.BISON_001
    ) {
      tokens_per_message = 4;
    }

    let tokenCount = prompt_tokens.length + tokens_per_message;
    let messagesToSend: Message[] = [];

    const length = Math.min(messages.length, 1000);
    for (let i = length - 1; i >= 0; i--) {
      if (!messages[i]) {
        break;
      }
      const message = {
        role: messages[i].role,
        content: messages[i].content,
        ...(messages[i].custom_content?.state && {
          custom_content: { state: messages[i].custom_content?.state },
        }),
      };
      const tokens = encoding.encode(message.content);

      if (tokenCount + tokens.length > model.requestLimit) {
        break;
      }
      tokenCount += tokens.length + tokens_per_message;
      messagesToSend = [message, ...messagesToSend];
    }

    tokenCount += 3;

    const stream = await OpenAIStream({
      model,
      systemPrompt: promptToSend,
      temperature: temperatureToUse,
      messages: messagesToSend,
      selectedAddons: selectedAddons as OpenAIEntityAddonID[],
      assistantModelId: assistantModelId as OpenAIEntityModelID | undefined,
      userJWT: token?.access_token as string,
      chatId: id,
      jobTitle: token?.jobTitle as string,
    });
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Content-Type', 'application/x-ndjson');

    const reader = stream.getReader();
    const processStream = async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          res.write(value);
        }
      } catch (error) {
        logger.error(error, 'Error reading stream:');
        res.status(500);
      } finally {
        res.end();
      }
    };

    await processStream();
  } catch (error) {
    logger.error(error);
    if (error instanceof OpenAIError) {
      // Rate limit errors and gateway errors https://platform.openai.com/docs/guides/error-codes/api-errors
      if (['429', '504'].includes(error.code)) {
        return res.status(500).send(errorsMessages[429]);
      }
      // return new Response('Error', { status: 500, statusText: error.message });
      return res.status(500).send(errorsMessages.generalServer);
    } else {
      return res.status(500).send('Error');
    }
  }
};

export default handler;
