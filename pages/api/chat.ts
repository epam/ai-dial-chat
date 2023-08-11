import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { OpenAIError, OpenAIStream } from '@/utils/server';

import { OpenAIEntityAddonID, OpenAIEntityModelID } from '../../types/openai';
import { ChatBody, Message } from '@/types/chat';

import { authOptions } from './auth/[...nextauth]';

import { errorsMessages } from '@/constants/errors';
// 1@ts-expect-error
// import wasm from '../../node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm?module';
// import wasm from '@dqbd/tiktoken/lite/tiktoken_bg.wasm';
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
  if (process.env.AUTH_DISABLED !== 'true' && !session) {
    return res.status(401).send(errorsMessages[401]);
  }

  try {
    const {
      model,
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

    for (let i = messages.length - 1; i >= 0; i--) {
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
    });
    res.setHeader('Transfer-Encoding', 'chunked');

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
        console.error('Error reading stream:', error);
        res.status(500);
      } finally {
        res.end();
      }
    };

    await processStream();
  } catch (error) {
    console.error(error);
    if (error instanceof OpenAIError) {
      // Rate limit errors and gateway errors https://platform.openai.com/docs/guides/error-codes/api-errors
      if (['429', '504'].includes(error.code)) {
        return res.status(500).send(errorsMessages[429]);
      }
      // return new Response('Error', { status: 500, statusText: error.message });
      return res.status(500).send(error.message);
    } else {
      // return new Response('Error', { status: 500 });
      return res.status(500).send('Error');
    }
  }
};

export default handler;
