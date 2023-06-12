import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { getHeaders } from '../../utils/server/getHeaders';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { OpenAIError, OpenAIStream } from '@/utils/server';

import { OpenAIModelID, OpenAIModels } from '../../types/openai';
import { fallbackModelID } from '../../types/openai';
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

// export const config = {
//   runtime: 'edge',
// };

const wasm = readFileSync(
  path.resolve(
    __dirname,
    '../../../../node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm',
  ),
);

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).send(errorsMessages[401]);
  }

  try {
    const {
      model: _model,
      messages,
      key,
      prompt,
      temperature,
      id,
    } = req.body as ChatBody;

    await init((imports) => WebAssembly.instantiate(wasm, imports));
    const encoding = new Tiktoken(
      tiktokenModel.bpe_ranks,
      tiktokenModel.special_tokens,
      tiktokenModel.pat_str,
    );

    let promptToSend = prompt;
    if (!promptToSend) {
      promptToSend = DEFAULT_SYSTEM_PROMPT;
    }

    let temperatureToUse = temperature;
    if (temperatureToUse == null) {
      temperatureToUse = DEFAULT_TEMPERATURE;
    }

    console.log(promptToSend);
    const prompt_tokens = encoding.encode(promptToSend);

    // let tokenCount = prompt_tokens.length;
    // let messagesToSend: Message[] = [];

    const model =
      OpenAIModels[_model.id as OpenAIModelID] ?? OpenAIModels[fallbackModelID];

    let tokens_per_message = 0;
    if (model.id == OpenAIModelID.GPT_3_5 || model.id == OpenAIModelID.GPT_3_5_AZ) {
      tokens_per_message = 5;
    } else if (model.id == OpenAIModelID.GPT_4 || model.name == OpenAIModelID.GPT_4_32K || model.name === OpenAIModelID.BISON_001) {
      tokens_per_message = 4;
    }

    let tokenCount = prompt_tokens.length + tokens_per_message;
    let messagesToSend: Message[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = {
        role: messages[i].role,
        content: messages[i].content,
      };
      const tokens = encoding.encode(message.content);

      if (tokenCount + tokens.length > model.requestLimit) {
        break;
      }
      tokenCount += tokens.length + tokens_per_message;
      messagesToSend = [message, ...messagesToSend];
    }

    tokenCount += 3;

    encoding.free();

    const stream = await OpenAIStream(
      model,
      promptToSend,
      temperatureToUse,
      key,
      messagesToSend,
      getHeaders(session, id),
      tokenCount,
    );
    res.setHeader('Transfer-Encoding', 'chunked');
    // return new Response(stream);
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
